#Requires -Version 7.0
#Requires -Modules Pester
BeforeAll {
    $script:Script = Join-Path $PSScriptRoot 'Get-NextSlice.ps1'
    function Git-Fixture([string] $Repo, [string[]] $Arguments) {
        $output = & git -C $Repo -c core.autocrlf=false -c user.email=test@example.com -c user.name=Test @Arguments 2>&1
        if ($LASTEXITCODE) { throw "$output" }
        $output
    }
    function Write-Plan([string] $Repo, [string] $Text, [string] $Message = 'plan') {
        $dir = Join-Path $Repo 'design'
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        [IO.File]::WriteAllText((Join-Path $dir '30-slices.md'), $Text)
        Git-Fixture $Repo @('add','design/30-slices.md') | Out-Null
        Git-Fixture $Repo @('commit','-qm',$Message) | Out-Null
    }
    # A bare origin whose main carries $Plan, and a clone of it to run against.
    function New-Fixture([string] $Plan) {
        $base = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
        $origin = Join-Path $base 'origin.git'; $seed = Join-Path $base 'seed'; $work = Join-Path $base 'work'
        New-Item -ItemType Directory -Path $base -Force | Out-Null
        Git-Fixture $base @('init','-q','--bare','-b','main',$origin) | Out-Null
        Git-Fixture $base @('clone','-q',$origin,$seed) | Out-Null
        Git-Fixture $seed @('switch','-q','-c','main') | Out-Null
        Write-Plan $seed $Plan
        Git-Fixture $seed @('push','-q','origin','main') | Out-Null
        Git-Fixture $base @('clone','-q',$origin,$work) | Out-Null
        @{ Origin = $origin; Seed = $seed; Work = $work }
    }
    function Invoke-NextObject($F, [string] $Prs = '[]', [string[]] $Extra = @()) {
        $json = & pwsh -NoProfile -Command "& '$($script:Script)' -RepoRoot '$($F.Work)' -PullRequestsJson '$Prs' -Quiet $($Extra -join ' ') | ConvertTo-Json -Compress; exit `$LASTEXITCODE"
        $code = $LASTEXITCODE
        $obj = ($json | Select-Object -Last 1) | ConvertFrom-Json
        $obj | Add-Member -NotePropertyName ExitCode -NotePropertyValue $code -PassThru
    }
    $script:ThreeSlices = @"
# Slices

## S1 - First
Status: todo
Depends on: none

## S2 - Second
Status: todo
Depends on: S1

## S3 - Third
Status: todo
Depends on: none

## Landed

| S0 | retired |
"@
}

Describe 'Get-NextSlice' {
    It 'starts the first slice whose dependencies are done' {
        $f = New-Fixture $ThreeSlices
        $r = Invoke-NextObject $f
        $r.ExitCode | Should -Be 0
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
        $r.Base | Should -Be 'origin/main'
        @($r.DirtyFiles).Count | Should -Be 0
    }

    It 'resumes an interrupted slice from its branch, not the branch''s unmerged Status: done' {
        $f = New-Fixture $ThreeSlices
        Git-Fixture $f.Work @('switch','-q','-c','slice/S1-first') | Out-Null
        Write-Plan $f.Work ($ThreeSlices -replace '(?s)(## S1 - First\r?\nStatus: )todo', '$1done') 'S1 work, marked done before merge'
        $r = Invoke-NextObject $f
        $r.State | Should -Be 'Resume'
        $r.Reason | Should -Be 'UnmergedBranch'
        $r.Slice | Should -Be 'S1'
        $r.Branch | Should -Be 'slice/S1-first'
    }

    It 'resumes a slice with an open pull request ahead of starting an earlier one' {
        $f = New-Fixture $ThreeSlices
        $r = Invoke-NextObject $f '[{"number":42,"headRefName":"slice/S3-third","url":"https://example.test/pull/42"}]'
        $r.State | Should -Be 'Resume'
        $r.Reason | Should -Be 'OpenPullRequest'
        $r.Slice | Should -Be 'S3'
        $r.PullRequest | Should -Be 42
        $r.Branch | Should -Be 'slice/S3-third'
    }

    It 'does not mistake slice/S10 for S1' {
        $f = New-Fixture $ThreeSlices
        $r = Invoke-NextObject $f '[{"number":7,"headRefName":"slice/S10-other","url":"u"}]'
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
    }

    It 'ignores a slice branch the default branch already contains' {
        $f = New-Fixture $ThreeSlices
        Git-Fixture $f.Work @('branch','slice/S1-first') | Out-Null
        $r = Invoke-NextObject $f
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
    }

    It 'reads the plan from origin when the local default branch is behind' {
        $f = New-Fixture $ThreeSlices
        Write-Plan $f.Seed ($ThreeSlices -replace '(?s)(## S1 - First\r?\nStatus: )todo', '$1done') 'S1 merged'
        Git-Fixture $f.Seed @('push','-q','origin','main') | Out-Null
        $r = Invoke-NextObject $f
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S2'
        (Get-Content (Join-Path $f.Work 'design/30-slices.md') -Raw) | Should -Match 'S1 - First\r?\nStatus: todo' -Because 'the working copy is never updated by this script'
    }

    It 'stops with git''s error when the fetch fails' {
        $f = New-Fixture $ThreeSlices
        Git-Fixture $f.Work @('remote','set-url','origin',(Join-Path $TestDrive 'missing.git')) | Out-Null
        $r = Invoke-NextObject $f
        $r.ExitCode | Should -Be 1
        $r.State | Should -Be 'Blocked'
        $r.Reason | Should -Be 'FetchFailed'
        $r.Detail | Should -Match 'missing'
    }

    It 'reports the plan finished, counting Landed slices as done' {
        $f = New-Fixture "## S4 - Last`nStatus: done`nDepends on: S0`n`n## Landed`n`n| S0 | old |`n"
        $r = Invoke-NextObject $f
        $r.ExitCode | Should -Be 0
        $r.State | Should -Be 'Finished'
    }

    It 'blocks with the gap when no remaining slice can start' {
        $f = New-Fixture "## S1 - A`nStatus: todo`nDepends on: S2`n`n## S2 - B`nStatus: todo`nDepends on: S1`n"
        $r = Invoke-NextObject $f
        $r.ExitCode | Should -Be 1
        $r.Reason | Should -Be 'NoEligibleSlice'
        $r.Detail | Should -Match 'S1 waits on S2; S2 waits on S1'
    }

    It 'lists the uncommitted files and leaves them exactly as they were' {
        $f = New-Fixture $ThreeSlices
        New-Item -ItemType Directory -Path (Join-Path $f.Work 'notes') | Out-Null
        Set-Content -LiteralPath (Join-Path $f.Work 'notes/scratch.txt') -Value 'user work'
        Add-Content -LiteralPath (Join-Path $f.Work 'design/30-slices.md') -Value 'a user edit'
        $before = Git-Fixture $f.Work @('status','--porcelain')
        $r = Invoke-NextObject $f
        @($r.DirtyFiles | Sort-Object) | Should -Be @('design/30-slices.md','notes/scratch.txt')
        (Git-Fixture $f.Work @('status','--porcelain')) | Should -Be $before
        (Git-Fixture $f.Work @('branch','--show-current')) | Should -Be 'main'
    }

    It 'takes the slice named by -Slice, and refuses one already done' {
        $f = New-Fixture $ThreeSlices
        (Invoke-NextObject $f '[]' @('-Slice','S3')).Slice | Should -Be 'S3'
        $done = New-Fixture "## S1 - A`nStatus: done`n"
        $r = Invoke-NextObject $done '[]' @('-Slice','1')
        $r.State | Should -Be 'Blocked'
        $r.Reason | Should -Be 'AlreadyDone'
    }
}
