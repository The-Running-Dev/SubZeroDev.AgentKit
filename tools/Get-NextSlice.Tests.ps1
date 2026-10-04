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
    # One open pull request as gh prints it: this repository's, into main, unless overridden.
    function Pr([int] $Number, [string] $Head, [string] $BaseRef = 'main', [bool] $Fork = $false) {
        @{ number = $Number; headRefName = $Head; baseRefName = $BaseRef; isCrossRepository = $Fork; url = "https://example.test/pull/$Number" }
    }
    function PrJson([object[]] $Prs) { ConvertTo-Json -InputObject @($Prs) -Compress -Depth 3 }
    function Set-File($F, [string] $Path, [string] $Text) {
        $full = Join-Path $F.Work $Path
        New-Item -ItemType Directory -Path (Split-Path $full) -Force | Out-Null
        [IO.File]::WriteAllText($full, $Text)
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
        $r = Invoke-NextObject $f (PrJson (Pr 42 'slice/S3-third'))
        $r.State | Should -Be 'Resume'
        $r.Reason | Should -Be 'OpenPullRequest'
        $r.Slice | Should -Be 'S3'
        $r.PullRequest | Should -Be 42
        $r.Branch | Should -Be 'slice/S3-third'
    }

    It 'does not mistake slice/S10 for S1' {
        $f = New-Fixture $ThreeSlices
        $r = Invoke-NextObject $f (PrJson (Pr 7 'slice/S10-other'))
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
    }

    It 'ignores an origin slice branch the default branch already contains' {
        $f = New-Fixture $ThreeSlices
        Git-Fixture $f.Seed @('push','-q','origin','main:slice/S1-first') | Out-Null
        $r = Invoke-NextObject $f
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
    }

    It 'ignores a fork''s pull request and one into another branch, and blocks on two for one slice' {
        $f = New-Fixture $ThreeSlices
        $r = Invoke-NextObject $f (PrJson @((Pr 5 'slice/S3-third' -Fork $true), (Pr 6 'slice/S3-third' 'release')))
        $r.State | Should -Be 'Start'
        $r.Slice | Should -Be 'S1'
        $r = Invoke-NextObject $f (PrJson @((Pr 8 'slice/S3-third'), (Pr 9 'slice/S3-again')))
        $r.ExitCode | Should -Be 1
        $r.State | Should -Be 'Blocked'
        $r.Reason | Should -Be 'AmbiguousPullRequest'
        $r.Detail | Should -Match '#8 slice/S3-third, #9 slice/S3-again'
    }

    Context 'a run interrupted before it committed everything' {
        It 'resumes a branch with no commits yet, carrying on with its own edits and guarding the rest' {
            $f = New-Fixture $ThreeSlices
            Set-File $f 'notes/user.txt' 'user work'
            (Invoke-NextObject $f).State | Should -Be 'Start'
            Git-Fixture $f.Work @('switch','-q','-c','slice/S1-first','origin/main') | Out-Null
            Set-File $f 'src/impl.txt' 'slice work'
            $r = Invoke-NextObject $f
            $r.State | Should -Be 'Resume'
            $r.Reason | Should -Be 'EmptyBranch'
            $r.Branch | Should -Be 'slice/S1-first'
            @($r.GuardedFiles) | Should -Be @('notes/user.txt')
            @($r.OwnFiles) | Should -Be @('src/impl.txt')
        }

        It 'keeps edits made after the first commit as the slice''s own' {
            $f = New-Fixture $ThreeSlices
            Set-File $f 'notes/user.txt' 'user work'
            (Invoke-NextObject $f).State | Should -Be 'Start'
            Git-Fixture $f.Work @('switch','-q','-c','slice/S1-first','origin/main') | Out-Null
            Set-File $f 'src/a.txt' 'committed'
            Git-Fixture $f.Work @('add','src/a.txt') | Out-Null
            Git-Fixture $f.Work @('commit','-qm','first') | Out-Null
            Set-File $f 'src/a.txt' 'edited after'
            Set-File $f 'src/b.txt' 'new after'
            $r = Invoke-NextObject $f
            $r.Reason | Should -Be 'UnmergedBranch'
            @($r.GuardedFiles) | Should -Be @('notes/user.txt')
            @($r.OwnFiles | Sort-Object) | Should -Be @('src/a.txt','src/b.txt')
        }

        It 'guards every dirty file when there is no record for the slice' {
            $f = New-Fixture $ThreeSlices
            Git-Fixture $f.Work @('switch','-q','-c','slice/S1-first','origin/main') | Out-Null
            Set-File $f 'src/impl.txt' 'whose?'
            $r = Invoke-NextObject $f
            $r.State | Should -Be 'Resume'
            @($r.GuardedFiles) | Should -Be @('src/impl.txt')
            @($r.OwnFiles).Count | Should -Be 0
        }

        It 'does not reuse another slice''s record' {
            $f = New-Fixture $ThreeSlices
            (Invoke-NextObject $f '[]' @('-Slice','S3')).State | Should -Be 'Start'
            Git-Fixture $f.Work @('switch','-q','-c','slice/S1-first','origin/main') | Out-Null
            Set-File $f 'src/impl.txt' 'whose?'
            @((Invoke-NextObject $f).GuardedFiles) | Should -Be @('src/impl.txt')
        }
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
        @($r.GuardedFiles | Sort-Object) | Should -Be @('design/30-slices.md','notes/scratch.txt')
        @($r.OwnFiles).Count | Should -Be 0
        (Git-Fixture $f.Work @('status','--porcelain')) | Should -Be $before -Because 'the ownership record lives in the git directory, not the tree'
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
