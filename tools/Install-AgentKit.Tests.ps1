#Requires -Version 7.0
#Requires -Modules Pester
BeforeAll {
    $script:KitSource = Split-Path -Parent $PSScriptRoot
    $script:FrontDoor = Join-Path $script:KitSource 'setup.ps1'
    function Git-Fixture([string] $Repo, [string[]] $Arguments) {
        # Use the same line-ending policy for fixture writes/clones and setup's
        # child Git calls; host core.autocrlf must not manufacture a dirty clone.
        $output = & git -C $Repo -c core.autocrlf=false -c user.email=test@example.com -c user.name=Test @Arguments 2>&1
        if ($LASTEXITCODE) { throw "$output" }
        $output
    }
    function New-Fixture([string] $Base) {
        $origin = Join-Path $Base 'local origin'
        $homeDir = Join-Path $Base 'temporary home'
        $project = Join-Path $Base 'project'
        foreach ($dir in @($origin,$homeDir,$project)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        foreach ($relative in @('setup.ps1','AGENTS.shared.md','.claude/COMPANIONS.md','tools/Install-AgentKit.ps1','tools/Get-AgentKitSkill.ps1','tools/Invoke-CodexCommand.ps1','tools/Start-AgentKitCodex.ps1','skills/help/SKILL.md','skills/slice/SKILL.md','skills/resume/SKILL.md')) {
            $dest = Join-Path $origin $relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $script:KitSource $relative) -Destination $dest
        }
        New-Item -ItemType Directory -Path (Join-Path $origin 'templates') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $origin 'templates/example.md') -Value 'template'
        Set-Content -LiteralPath (Join-Path $origin 'AGENTS.md') -Value 'PROJECT-ONLY-RULE-MUST-NOT-LOAD-GLOBALLY'
        Set-Content -LiteralPath (Join-Path $project 'keep.txt') -Value 'project stays unchanged'
        Git-Fixture $origin @('init','-q','-b','main') | Out-Null
        Git-Fixture $origin @('add','setup.ps1','AGENTS.shared.md','AGENTS.md','.claude/COMPANIONS.md','tools/Install-AgentKit.ps1','tools/Get-AgentKitSkill.ps1','tools/Invoke-CodexCommand.ps1','tools/Start-AgentKitCodex.ps1','skills/help/SKILL.md','skills/slice/SKILL.md','skills/resume/SKILL.md','templates/example.md') | Out-Null
        Git-Fixture $origin @('commit','-qm','fixture') | Out-Null
        Git-Fixture $origin @('tag','v2026.09.17') | Out-Null
        @{ Origin=$origin; Home=$homeDir; Root=(Join-Path $homeDir '.agent-kit'); Codex=(Join-Path $Base 'custom codex home'); Project=$project }
    }
    function Run-Setup($F, [hashtable] $Options=@{}) {
        $optionsCopy = @{} + $Options
        if (-not $optionsCopy.ContainsKey('Source')) { $optionsCopy.Source=$F.Origin }
        if (-not $optionsCopy.ContainsKey('Hosts')) { $optionsCopy.Hosts=@('claude','codex','copilot') }
        $json = ConvertTo-Json -InputObject $optionsCopy -Compress -Depth 8
        $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
        $entry = $script:FrontDoor.Replace("'","''")
        # Capture the exception message, not a width-wrapped/CLIXML terminal view.
        $code = "`$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64')) | ConvertFrom-Json -AsHashtable; try { & '$entry' @p } catch { [Console]::Error.WriteLine(`$_.Exception.Message); exit 1 }"
        $psi = [Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME $(if ($IsWindows) {'pwsh.exe'} else {'pwsh'})))
        $psi.ArgumentList.Add('-NoProfile'); $psi.ArgumentList.Add('-EncodedCommand')
        $psi.ArgumentList.Add([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code)))
        $psi.Environment['HOME']=$F.Home; $psi.Environment['USERPROFILE']=$F.Home
        $psi.Environment['AGENTKIT_HOME']=$F.Root; $psi.Environment['CODEX_HOME']=$F.Codex
        $psi.Environment['GIT_CONFIG_COUNT']='1'; $psi.Environment['GIT_CONFIG_KEY_0']='core.autocrlf'; $psi.Environment['GIT_CONFIG_VALUE_0']='false'
        $psi.WorkingDirectory=$F.Project; $psi.RedirectStandardOutput=$true; $psi.RedirectStandardError=$true; $psi.UseShellExecute=$false
        $proc = [Diagnostics.Process]::Start($psi)
        $stdout = $proc.StandardOutput.ReadToEndAsync(); $stderr = $proc.StandardError.ReadToEndAsync()
        $proc.WaitForExit()
        [pscustomobject]@{ ExitCode=$proc.ExitCode; Output=($stdout.Result + $stderr.Result) }
    }
    function Read-State($F) { Get-Content -LiteralPath (Join-Path $F.Home '.agent-kit-state/installed.json') -Raw | ConvertFrom-Json -AsHashtable }
    function Assert-Success($Result) { $Result.ExitCode | Should -Be 0 -Because $Result.Output }
    function Get-FixtureSnapshot($F) {
        $snap = [ordered]@{}
        foreach ($dir in @((Join-Path $F.Home '.claude'),(Join-Path $F.Home '.copilot'),$F.Codex)) {
            if (Test-Path -LiteralPath $dir) {
                foreach ($file in Get-ChildItem -LiteralPath $dir -Recurse -Force -File) { $snap[$file.FullName]=(Get-FileHash -LiteralPath $file.FullName).Hash }
            }
        }
        ConvertTo-Json $snap -Compress
    }
}
Describe 'Global front door with isolated homes and local Git origin' {
    BeforeEach { $f = New-Fixture (Join-Path $TestDrive ([guid]::NewGuid().ToString())) }
    It 'fresh setup delegates to the selected installer and globally registers all hosts without project copies' {
        $result = Run-Setup $f; Assert-Success $result
        $state = Read-State $f
        $state.registrations.Count | Should -Be 12
        $state.commit | Should -Be (Git-Fixture $f.Origin @('rev-parse','HEAD'))
        $state.requestedVersion | Should -Be 'latest stable'
        foreach ($path in @('.claude/skills/help/SKILL.md','.copilot/skills/help/SKILL.md')) { (Join-Path $f.Home $path) | Should -Exist }
        (Join-Path $f.Codex 'skills/help/SKILL.md') | Should -Exist
        (Join-Path $f.Codex 'skills/help-routed/SKILL.md') | Should -Exist
        @(Get-ChildItem -LiteralPath $f.Project).Count | Should -Be 1
        $result.Output | Should -Match 'Verified: canonical runtime'
    }
    It 'reruns with identical registration bytes and no backup churn' {
        Assert-Success (Run-Setup $f)
        $before = Get-FixtureSnapshot $f
        $manifestBefore = Get-Content (Join-Path $f.Home '.agent-kit-state/installed.json') -Raw
        Assert-Success (Run-Setup $f)
        (Get-Content (Join-Path $f.Home '.agent-kit-state/installed.json') -Raw) | Should -BeExactly $manifestBefore
        (Get-FixtureSnapshot $f) | Should -BeExactly $before
    }
    It 'adopts the existing correct canonical clone' {
        Git-Fixture $f.Origin @('clone','-q',$f.Origin,$f.Root) | Out-Null
        $result=Run-Setup $f; Assert-Success $result
        $result.Output | Should -Not -Match "Clone '"
    }
    It 'refuses occupied non-repository root without deleting its contents' {
        New-Item -ItemType Directory -Path $f.Root | Out-Null
        Set-Content (Join-Path $f.Root 'mine.txt') 'mine'
        $result=Run-Setup $f
        $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'occupied'
        Get-Content (Join-Path $f.Root 'mine.txt') | Should -Be 'mine'
    }
    It 'clones into a pre-existing empty root rather than refusing it as occupied' {
        New-Item -ItemType Directory -Path $f.Root | Out-Null
        $result=Run-Setup $f; Assert-Success $result
        $result.Output | Should -Not -Match 'occupied'
        (Join-Path $f.Root '.git') | Should -Exist
    }
    It 'refuses wrong origin unless Force explicitly repoints the correct runtime clone' {
        Assert-Success (Run-Setup $f)
        Git-Fixture $f.Root @('remote','set-url','origin','https://example.invalid/foreign.git') | Out-Null
        $result=Run-Setup $f; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'Wrong origin'
        Assert-Success (Run-Setup $f @{Force=$true})
        (Git-Fixture $f.Root @('remote','get-url','origin')) | Should -Be $f.Origin
    }
    It 'refuses dirty checkout and preserves changes without Force' {
        Assert-Success (Run-Setup $f)
        Add-Content (Join-Path $f.Root 'AGENTS.shared.md') 'local edit'
        $result=Run-Setup $f; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'uncommitted changes'
        Get-Content (Join-Path $f.Root 'AGENTS.shared.md') -Raw | Should -Match 'local edit'
        Assert-Success (Run-Setup $f @{Force=$true})
    }
    It 'orders annotated and lightweight date tags by date and numeric revision rather than creation' {
        Git-Fixture $f.Origin @('tag','-a','v2026.09.19.2','-m','annotated') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.09.19.10') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.09.18') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.99.99') | Out-Null
        Git-Fixture $f.Origin @('tag','v2027.01.01-rc1') | Out-Null
        Assert-Success (Run-Setup $f)
        (Read-State $f).version | Should -Be 'v2026.09.19.10'
        Assert-Success (Run-Setup $f @{Version='v2026.09.19.2'})
        (Read-State $f).commit | Should -Be (Git-Fixture $f.Origin @('rev-parse','v2026.09.19.2^{commit}'))
    }
    It 'never falls back to main when stable releases are absent' {
        Git-Fixture $f.Origin @('tag','-d','v2026.09.17') | Out-Null
        $result=Run-Setup $f; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'No valid stable release'
        Assert-Success (Run-Setup $f @{Version='main'})
    }
    It 'does not mistake an unpublished local tag for the newest stable release' {
        Assert-Success (Run-Setup $f)
        Git-Fixture $f.Root @('tag','v2099.01.01') | Out-Null
        Assert-Success (Run-Setup $f)
        (Read-State $f).version | Should -Be 'v2026.09.17'
    }
    It 'selects unreleased branch and SHA only explicitly and rolls back to the stable tag' {
        Add-Content (Join-Path $f.Origin 'AGENTS.shared.md') 'unreleased'
        Git-Fixture $f.Origin @('commit','-qam','unreleased') | Out-Null
        $sha=Git-Fixture $f.Origin @('rev-parse','HEAD')
        Assert-Success (Run-Setup $f)
        (Read-State $f).commit | Should -Not -Be $sha
        Assert-Success (Run-Setup $f @{Version='main'})
        (Read-State $f).commit | Should -Be $sha
        Assert-Success (Run-Setup $f @{Version=$sha})
        (Read-State $f).commit | Should -Be $sha
        Assert-Success (Run-Setup $f @{Version='v2026.09.17'})
        (Read-State $f).commit | Should -Not -Be $sha
    }
    It 'refuses a legacy release before moving HEAD' {
        Assert-Success (Run-Setup $f)
        $before=Git-Fixture $f.Root @('rev-parse','HEAD')
        Git-Fixture $f.Origin @('rm','setup.ps1') | Out-Null
        Git-Fixture $f.Origin @('commit','-qm','legacy shape') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.09.18') | Out-Null
        $result=Run-Setup $f; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'predates the global front door'
        (Git-Fixture $f.Root @('rev-parse','HEAD')) | Should -Be $before
    }
    It 'does not silently reset a locally diverged branch' {
        Assert-Success (Run-Setup $f @{Version='main'})
        Add-Content (Join-Path $f.Root 'AGENTS.shared.md') 'local commit'
        Git-Fixture $f.Root @('commit','-qam','local') | Out-Null
        $before=Git-Fixture $f.Root @('rev-parse','HEAD')
        $result=Run-Setup $f @{Version='main'}; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'unpublished or divergent'
        (Git-Fixture $f.Root @('rev-parse','HEAD')) | Should -Be $before
    }
    It 'reports fetch failure as Git failure rather than divergence and preserves HEAD' {
        Assert-Success (Run-Setup $f)
        $before=Git-Fixture $f.Root @('rev-parse','HEAD')
        $missing=Join-Path $TestDrive 'missing-origin'
        $result=Run-Setup $f @{Source=$missing;Force=$true}; $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match 'git fetch'
        $result.Output | Should -Not -Match 'unpublished or divergent'
        (Git-Fixture $f.Root @('rev-parse','HEAD')) | Should -Be $before
    }
    It 'fresh and existing dry runs write no host or checkout changes' {
        $result=Run-Setup $f @{DryRun=$true}; Assert-Success $result
        $f.Root | Should -Not -Exist
        Assert-Success (Run-Setup $f)
        $before=Get-FixtureSnapshot $f
        Assert-Success (Run-Setup $f @{DryRun=$true;Prefix='ak-'})
        (Get-FixtureSnapshot $f) | Should -BeExactly $before
    }
    It 'every adapter has valid frontmatter and absolute runtime paths despite spaces' {
        Assert-Success (Run-Setup $f)
        foreach ($entry in (Read-State $f).registrations) {
            $content=Get-Content (Join-Path $entry.path 'SKILL.md') -Raw
            $content | Should -Match "(?s)^---\nname: $($entry.name)\ndescription: '[^\n]+'\n(?:disable-model-invocation: true\n)?---"
            $content | Should -Match ([regex]::Escape($f.Root.Replace('\','/')))
            $content | Should -Not -Match '\.\./\.\./\.claude/COMPANIONS[.]md'
            $content | Should -Not -Match '(?<![\w/\\])(?:AGENTS[.]shared[.]md|tools/|templates/)'
        }
    }
    It 'all pointers name AGENTS.shared.md and never the kit project AGENTS.md' {
        Assert-Success (Run-Setup $f)
        foreach ($path in (Read-State $f).pointerBlocks.Keys) {
            $body=Get-Content -LiteralPath $path -Raw
            $body | Should -Match ([regex]::Escape(($f.Root.Replace('\','/') + '/AGENTS.shared.md')))
            $body | Should -Not -Match ([regex]::Escape(($f.Root.Replace('\','/') + '/AGENTS.md')))
            $body | Should -Not -Match 'PROJECT-ONLY'
        }
    }
    It 'foreign same-named skill survives byte-for-byte and is reported' {
        $path=Join-Path $f.Codex 'skills/help/SKILL.md'
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        [IO.File]::WriteAllText($path,'foreign bytes')
        $result=Run-Setup $f; Assert-Success $result
        [IO.File]::ReadAllText($path) | Should -BeExactly 'foreign bytes'
        $result.Output | Should -Match 'Skipped collisions:.*help'
        (Join-Path (Split-Path $path -Parent) '.agentkit-owner') | Should -Not -Exist
    }
    It 'edited managed skills survive refresh and uninstall' {
        Assert-Success (Run-Setup $f)
        $path=Join-Path $f.Codex 'skills/help/SKILL.md'
        [IO.File]::WriteAllText($path,'my edited core')
        Assert-Success (Run-Setup $f)
        [IO.File]::ReadAllText($path) | Should -BeExactly 'my edited core'
        Assert-Success (Run-Setup $f @{Uninstall=$true})
        [IO.File]::ReadAllText($path) | Should -BeExactly 'my edited core'
    }
    It 'prefix change removes only unchanged previous managed registrations' {
        Assert-Success (Run-Setup $f)
        $path=Join-Path $f.Codex 'skills/help/SKILL.md'
        [IO.File]::WriteAllText($path,'keep customized')
        Assert-Success (Run-Setup $f @{Prefix='ak-'})
        $path | Should -Exist
        (Join-Path $f.Codex 'skills/slice') | Should -Not -Exist
        (Join-Path $f.Codex 'skills/ak-slice/SKILL.md') | Should -Exist
        (Join-Path $f.Codex 'skills/ak-slice-routed/SKILL.md') | Should -Exist
    }
    It 'uninstall removes managed entries and leaves unrelated hooks and rules text' {
        Assert-Success (Run-Setup $f)
        $settingsPath=Join-Path $f.Home '.claude/settings.json'
        $settings=Get-Content $settingsPath -Raw | ConvertFrom-Json -AsHashtable
        $settings.hooks.SessionEnd = @($settings.hooks.SessionEnd) + @(@{hooks=@(@{type='command';command='pwsh';args=@('-File','/foreign/tools/Measure-Session.ps1')})})
        $settings | ConvertTo-Json -Depth 20 | Set-Content $settingsPath
        Add-Content (Join-Path $f.Codex 'AGENTS.md') 'keep user rules'
        Assert-Success (Run-Setup $f @{Uninstall=$true})
        (Join-Path $f.Codex 'skills/help') | Should -Not -Exist
        (Join-Path $f.Home '.claude/skills/help') | Should -Not -Exist
        (Join-Path $f.Home '.copilot/skills/help') | Should -Not -Exist
        $f.Root | Should -Exist
        (Get-Content $settingsPath -Raw) | Should -Match '/foreign/tools/Measure-Session.ps1'
        (Get-Content (Join-Path $f.Codex 'AGENTS.md') -Raw) | Should -Match 'keep user rules'
    }
    It 'uninstall Force removes only the validated canonical checkout' {
        Assert-Success (Run-Setup $f)
        Assert-Success (Run-Setup $f @{Uninstall=$true;Force=$true})
        $f.Root | Should -Not -Exist
        (Join-Path $f.Project 'keep.txt') | Should -Exist
    }
    It 'updating after a removed core cleans stale managed registrations' {
        Assert-Success (Run-Setup $f)
        Git-Fixture $f.Origin @('rm','skills/help/SKILL.md') | Out-Null
        Git-Fixture $f.Origin @('commit','-qm','remove help') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.09.18') | Out-Null
        Assert-Success (Run-Setup $f)
        (Join-Path $f.Codex 'skills/help') | Should -Not -Exist
        (Join-Path $f.Codex 'skills/help-routed') | Should -Not -Exist
        (Join-Path $f.Home '.claude/skills/help') | Should -Not -Exist
    }
    It 'retargeted legacy manifest links survive refresh and uninstall' {
        Git-Fixture $f.Origin @('clone','-q',$f.Origin,$f.Root) | Out-Null
        $stateDir = Join-Path $f.Home '.agent-kit-state'
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
        @{installRoot=$f.Root;source=$f.Origin;hosts=@{claude=@('help')}} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $stateDir 'installed.json')
        $foreign = Join-Path $TestDrive 'foreign skill target'
        New-Item -ItemType Directory -Path $foreign -Force | Out-Null
        Set-Content (Join-Path $foreign 'SKILL.md') 'foreign skill'
        $skillsDir = Join-Path $f.Home '.claude/skills'
        New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
        $link = Join-Path $skillsDir 'help'
        New-Item -ItemType $(if ($IsWindows) {'Junction'} else {'SymbolicLink'}) -Path $link -Target $foreign | Out-Null
        Assert-Success (Run-Setup $f)
        (Get-Item $link).Target | Should -Be $foreign
        Assert-Success (Run-Setup $f @{Uninstall=$true})
        Get-Content (Join-Path $foreign 'SKILL.md') | Should -Be 'foreign skill'
        $link | Should -Exist
    }
    It 'preserves edited pointer blocks instead of silently refreshing or deleting them' {
        Assert-Success (Run-Setup $f)
        $path = Join-Path $f.Codex 'AGENTS.md'
        $text = (Get-Content $path -Raw).Replace('AgentKit shared rules:', 'User customized shared rules:')
        [IO.File]::WriteAllText($path, $text)
        $result=Run-Setup $f; Assert-Success $result
        [IO.File]::ReadAllText($path) | Should -BeExactly $text
        Assert-Success (Run-Setup $f @{Uninstall=$true})
        [IO.File]::ReadAllText($path) | Should -BeExactly $text
    }
    It 'upgrades exact legacy pointers but preserves recognizable customized legacy blocks' {
        Git-Fixture $f.Origin @('clone','-q',$f.Origin,$f.Root) | Out-Null
        $stateDir = Join-Path $f.Home '.agent-kit-state'
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
        $claude = Join-Path $f.Home '.claude/CLAUDE.md'
        $codex = Join-Path $f.Codex 'AGENTS.md'
        $target = (Join-Path $f.Root 'AGENTS.md').Replace('\','/')
        $block = "<!-- agentkit-pointer:start -->`nAgentKit shared rules, installed at '$($f.Root)'. Regenerated by tools/Install-AgentKit.ps1 -`nedit outside this block, never inside it.`n`n@$target`n<!-- agentkit-pointer:end -->"
        foreach ($path in @($claude,$codex)) {
            New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
            [IO.File]::WriteAllText($path, $block)
        }
        $custom = $block.Replace('edit outside this block', 'my customized instruction')
        [IO.File]::WriteAllText($codex, $custom)
        @{installRoot=$f.Root;source=$f.Origin;pointers=@{claude=$claude;codex=$codex}} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $stateDir 'installed.json')
        $result=Run-Setup $f; Assert-Success $result
        [IO.File]::ReadAllText($claude) | Should -Match 'AGENTS[.]shared[.]md'
        [IO.File]::ReadAllText($codex) | Should -BeExactly $custom
        $result.Output | Should -Match 'Skipped collisions:'
    }
    It 'failed setup after checkout reports previous commit and recovery without resetting' {
        Assert-Success (Run-Setup $f)
        $previous = (Read-State $f).commit
        Git-Fixture $f.Origin @('rm','tools/Get-AgentKitSkill.ps1') | Out-Null
        Git-Fixture $f.Origin @('commit','-qm','incomplete runtime') | Out-Null
        Git-Fixture $f.Origin @('tag','v2026.09.18') | Out-Null
        $result=Run-Setup $f
        $result.ExitCode | Should -Not -Be 0
        $result.Output | Should -Match ([regex]::Escape("Previous commit: $previous"))
        $result.Output | Should -Match 'Recovery:'
        (Git-Fixture $f.Root @('rev-parse','HEAD')) | Should -Be (Git-Fixture $f.Origin @('rev-parse','HEAD'))
    }
    It 'a selected-host update retains ownership of other installed hosts' {
        Assert-Success (Run-Setup $f)
        Assert-Success (Run-Setup $f @{Hosts=@('codex')})
        (Read-State $f).registrations.Count | Should -Be 12
        Assert-Success (Run-Setup $f @{Uninstall=$true})
        (Join-Path $f.Home '.claude/skills/help') | Should -Not -Exist
    }
}
Describe 'Canonical skill dependencies' {
    It 'resolves kit-owned dependencies of every shipped skill and preserves project companions' {
        foreach ($skill in Get-ChildItem (Join-Path $script:KitSource 'skills') -Directory) {
            $body = & (Join-Path $script:KitSource 'tools/Get-AgentKitSkill.ps1') -Command $skill.Name
            if ($skill.Name -ne 'install-all') { $body | Should -Not -Match '(?<![\w/\\])(?:AGENTS[.]shared[.]md|\.\./\.\./\.claude/COMPANIONS[.]md|tools/|templates/)' }
            else { $body | Should -Match '(?m)^- `tools/\*[.]ps1`'; $body | Should -Match '(?m)^- `AGENTS[.]shared[.]md`' }
            $body | Should -Match ([regex]::Escape("skills/$($skill.Name)/SKILL-local.md"))
        }
    }
}
