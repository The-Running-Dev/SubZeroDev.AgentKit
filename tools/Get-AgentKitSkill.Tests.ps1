#Requires -Version 7.0
#Requires -Modules Pester
BeforeAll {
    $script:KitSource = Split-Path -Parent $PSScriptRoot
    $script:Files = @('tools/Get-AgentKitSkill.ps1','skills/help/SKILL.md','AGENTS.shared.md','.claude/COMPANIONS.md')
    function Git-Fixture([string] $Repo, [string[]] $Arguments) {
        $output = & git -C $Repo -c core.autocrlf=false -c user.email=test@example.com -c user.name=Test @Arguments 2>&1
        if ($LASTEXITCODE) { throw "$output" }
        $output
    }
    function Add-Commit([string] $Repo, [string] $Subject) {
        Add-Content -LiteralPath (Join-Path $Repo 'CHANGES.txt') -Value $Subject
        Git-Fixture $Repo @('add','CHANGES.txt') | Out-Null
        Git-Fixture $Repo @('commit','-qm',$Subject) | Out-Null
    }
    function Add-Release([string] $Repo, [string] $Tag, [string] $Subject = 'Newer') {
        Add-Commit $Repo $Subject
        Git-Fixture $Repo @('tag',$Tag) | Out-Null
    }
    # An installed runtime at the first release, recorded the way setup.ps1 records it.
    function New-Fixture([string] $Base, [string] $Requested = 'latest stable', [string] $Version = 'v2026.09.17') {
        $origin = Join-Path $Base 'origin'
        $homeDir = Join-Path $Base 'home'
        $root = Join-Path $homeDir '.agent-kit'
        New-Item -ItemType Directory -Path $origin, $homeDir -Force | Out-Null
        foreach ($relative in $script:Files) {
            $dest = Join-Path $origin $relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $script:KitSource $relative) -Destination $dest
        }
        Git-Fixture $origin @('init','-q','-b','main') | Out-Null
        Git-Fixture $origin (@('add') + $script:Files) | Out-Null
        Git-Fixture $origin @('commit','-qm','fixture') | Out-Null
        Git-Fixture $origin @('tag','v2026.09.17') | Out-Null
        Git-Fixture $homeDir @('clone','-q',$origin,$root) | Out-Null
        if ($Version -eq 'main') { Git-Fixture $root @('checkout','-q','main') | Out-Null }
        else { Git-Fixture $root @('checkout','-q','--detach',$Version) | Out-Null }
        $state = Join-Path $homeDir '.agent-kit-state'
        New-Item -ItemType Directory -Path $state -Force | Out-Null
        $manifest = [ordered]@{ schemaVersion=2; installRoot=[IO.Path]::GetFullPath($root); source=$origin; requestedVersion=$Requested; version=$Version }
        Set-Content -LiteralPath (Join-Path $state 'installed.json') -Value (ConvertTo-Json $manifest)
        @{ Origin=$origin; Home=$homeDir; Root=$root; State=$state }
    }
    function Invoke-Reader($F, [string] $Session = 's1', [hashtable] $Environment = @{}, [string[]] $Arguments = @('-Command','help')) {
        $psi = [Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME $(if ($IsWindows) {'pwsh.exe'} else {'pwsh'})))
        foreach ($a in @('-NoProfile','-File',(Join-Path $F.Root 'tools/Get-AgentKitSkill.ps1')) + $Arguments) { $psi.ArgumentList.Add($a) }
        $psi.Environment['HOME']=$F.Home; $psi.Environment['USERPROFILE']=$F.Home
        foreach ($name in @('CLAUDE_CODE_SESSION_ID','CODEX_THREAD_ID','CODEX_SESSION_ID','AGENTKIT_AUTO_UPDATE','AGENTKIT_HOME')) { $null = $psi.Environment.Remove($name) }
        $psi.Environment['CLAUDE_CODE_SESSION_ID'] = $Session
        foreach ($key in $Environment.Keys) { $psi.Environment[$key] = $Environment[$key] }
        $psi.WorkingDirectory=$F.Home; $psi.RedirectStandardOutput=$true; $psi.RedirectStandardError=$true; $psi.UseShellExecute=$false
        $proc = [Diagnostics.Process]::Start($psi)
        $out = $proc.StandardOutput.ReadToEndAsync(); $err = $proc.StandardError.ReadToEndAsync()
        $proc.WaitForExit()
        [pscustomobject]@{ ExitCode=$proc.ExitCode; Output=$out.Result.Trim(); Error=$err.Result }
    }
    function Should-BeBodyOnly($R) {
        $R.ExitCode | Should -Be 0 -Because $R.Error
        $R.Output | Should -Match '^AgentKit canonical runtime:'
        $R.Output | Should -Match 'name: help'
    }
}

Describe 'Get-AgentKitSkill update check' {
    BeforeEach {
        $script:f = New-Fixture (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
    }

    It 'shows the changes and the upgrade command ahead of the body when a newer stable release exists' {
        Add-Commit $f.Origin 'Add the widget command (#401)'
        Add-Commit $f.Origin 'Fix the gadget (#402)'
        Git-Fixture $f.Origin @('tag','-a','v2026.09.18','-m','release') | Out-Null
        Add-Commit $f.Origin 'Unreleased work on main'

        $r = Invoke-Reader $f
        $r.ExitCode | Should -Be 0 -Because $r.Error
        $r.Output | Should -Match '(?s)^=== AgentKit update available ===.*end AgentKit update notice ===\s+AgentKit canonical runtime:.*name: help'
        $r.Output | Should -Match 'Installed: v2026[.]09[.]17'
        $r.Output | Should -Match 'Available: v2026[.]09[.]18'
        $r.Output | Should -Match 'What changed \(2 commits\)'
        $r.Output | Should -Match 'Add the widget command \(#401\)'
        $r.Output | Should -Match 'Fix the gadget \(#402\)'
        $r.Output | Should -Not -Match 'Unreleased work on main'
        $r.Output | Should -Match ([regex]::Escape("setup.ps1'"))
        $r.Output | Should -Match 'ask whether to upgrade'
        # The check never moves the checkout; upgrading is setup.ps1's job after a yes.
        (Git-Fixture $f.Root @('describe','--tags')) | Should -Be 'v2026.09.17'
    }

    It 'checks only on the first read of a session' {
        Add-Release $f.Origin 'v2026.09.19'
        (Invoke-Reader $f 'same').Output | Should -Match 'update available'
        Should-BeBodyOnly (Invoke-Reader $f 'same')
        (Invoke-Reader $f 'other').Output | Should -Match 'update available'
    }

    It 'is on by default, and off by config or environment' {
        Add-Release $f.Origin 'v2026.09.19'
        Should-BeBodyOnly (Invoke-Reader $f 'env' @{ AGENTKIT_AUTO_UPDATE='0' })
        $set = Invoke-Reader $f 'x' @{} @('-SetAutoUpdate','Off')
        $set.ExitCode | Should -Be 0 -Because $set.Error
        (Get-Content (Join-Path $f.State 'config.json') -Raw | ConvertFrom-Json).autoUpdate | Should -BeFalse
        Should-BeBodyOnly (Invoke-Reader $f 'cfg')
        Invoke-Reader $f 'x' @{} @('-SetAutoUpdate','On') | Out-Null
        (Invoke-Reader $f 'cfg2').Output | Should -Match 'update available'
    }

    It 'is silent when the runtime is already current' {
        Add-Commit $f.Origin 'Unreleased only'
        Should-BeBodyOnly (Invoke-Reader $f)
    }

    It 'never offers an update to a pinned release' {
        $pinned = New-Fixture (Join-Path $TestDrive 'pinned') 'v2026.09.17'
        Add-Release $pinned.Origin 'v2026.09.19'
        Should-BeBodyOnly (Invoke-Reader $pinned)
    }

    It 'follows the branch a branch install tracks and upgrades with the same -Version' {
        $branch = New-Fixture (Join-Path $TestDrive 'branch') 'main' 'main'
        Add-Commit $branch.Origin 'Main moved on'
        $r = Invoke-Reader $branch
        $r.Output | Should -Match 'Available: origin/main'
        $r.Output | Should -Match 'Main moved on'
        $r.Output | Should -Match "-Version 'main'"
    }

    It 'is silent for a checkout that is not the recorded install root' {
        Add-Release $f.Origin 'v2026.09.19'
        $manifest = Get-Content (Join-Path $f.State 'installed.json') -Raw | ConvertFrom-Json -AsHashtable
        $manifest.installRoot = Join-Path $f.Home 'elsewhere'
        Set-Content -LiteralPath (Join-Path $f.State 'installed.json') -Value (ConvertTo-Json $manifest)
        Should-BeBodyOnly (Invoke-Reader $f)
    }

    It 'still returns the body when the origin cannot be reached' {
        Git-Fixture $f.Root @('remote','set-url','origin',(Join-Path $f.Home 'missing origin')) | Out-Null
        Should-BeBodyOnly (Invoke-Reader $f)
    }
}
