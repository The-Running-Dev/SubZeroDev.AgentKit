#Requires -Version 7.0
#Requires -Modules Pester

<#
  Sync-Kit.ps1 has no exit-calling wrapper - it runs to completion and returns $report on
  the pipeline - so most tests here invoke it end-to-end via `&` against real git repos
  under $TestDrive, the same "not worth mocking" reasoning Test-WriteSurface.Tests.ps1 gives
  for its own script: the point of this script is comparing git blobs and on-disk files
  correctly, so fixture git repos exercise that for real.

  The Invoke-GitRaw encoding tests need direct access to that function so they can flip
  [Console]::OutputEncoding around a single call - dot-sourcing with a KitRoot that does not
  exist throws inside Resolve-KitRoot, which runs after every function in the script is
  already defined, so the throw is caught and the functions survive in this scope.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Sync-Kit.ps1'

    function New-GitRepo {
        param([Parameter(Mandatory)][string] $Path)
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        & git init --quiet -b main $Path | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'initial' | Out-Null
        $Path
    }

    function Add-GitCommit {
        param([Parameter(Mandatory)][string] $Path, [Parameter(Mandatory)][string] $RelPath, [Parameter(Mandatory)][string] $Content, [string] $Message = 'update')
        $full = Join-Path $Path $RelPath
        $parent = Split-Path -Parent $full
        if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        [System.IO.File]::WriteAllText($full, $Content, [System.Text.UTF8Encoding]::new($false))
        & git -C $Path add $RelPath | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' commit --quiet -m $Message | Out-Null
        (& git -C $Path rev-parse HEAD).Trim()
    }

    function Write-KitJson {
        param([Parameter(Mandatory)][string] $TargetRepo, [Parameter(Mandatory)][string] $RecordedSha)
        $dir = Join-Path $TargetRepo '.claude'
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        [pscustomobject]@{ commit = $RecordedSha } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir 'kit.json') -NoNewline
    }
}

Describe 'Sync-Kit' {

    Context 'target content matching the recorded blob, once line endings are normalised' {

        It 'a target checked out with CRLF, whose text otherwise matches the recorded blob, reports Updated - not Divergent-Skipped' {
            $kit = New-GitRepo -Path (Join-Path $TestDrive 'kit-crlf')
            $target = New-GitRepo -Path (Join-Path $TestDrive 'target-crlf')

            $baseText = "line one`nline two`n"
            $baseSha = Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content $baseText -Message 'base'
            Write-KitJson -TargetRepo $target -RecordedSha $baseSha

            # Simulate a Windows checkout under core.autocrlf=true: on-disk CRLF, same text.
            $targetDir = Join-Path $target 'tools'
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $targetDir 'Foo.ps1'), ($baseText -replace "`n", "`r`n"), [System.Text.UTF8Encoding]::new($false))

            # Advance the kit so tools/Foo.ps1 differs from the recorded sha and the script
            # has to fall through to the target-vs-recorded comparison at all.
            Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "line one`nline two`nline three`n" -Message 'head' | Out-Null

            $report = & $script:ScriptPath -TargetRepo $target -KitRoot $kit -RecordedSha $baseSha -DryRun

            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'
            $row | Should -Not -BeNullOrEmpty
            $row.Status | Should -Be 'WouldUpdated'
        }

        It 'a target that genuinely edited the file - not just its line endings - still reports Divergent-Skipped' {
            $kit = New-GitRepo -Path (Join-Path $TestDrive 'kit-divergent')
            $target = New-GitRepo -Path (Join-Path $TestDrive 'target-divergent')

            $baseText = "line one`nline two`n"
            $baseSha = Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content $baseText -Message 'base'
            Write-KitJson -TargetRepo $target -RecordedSha $baseSha

            $targetDir = Join-Path $target 'tools'
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $targetDir 'Foo.ps1'), "line one`r`nline two - locally edited`r`n", [System.Text.UTF8Encoding]::new($false))

            Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "line one`nline two`nline three`n" -Message 'head' | Out-Null

            $report = & $script:ScriptPath -TargetRepo $target -KitRoot $kit -RecordedSha $baseSha -DryRun

            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'
            $row | Should -Not -BeNullOrEmpty
            $row.Status | Should -Be 'Divergent-Skipped'
        }
    }

    Context 'core command files, per .claude/COMPANIONS.md' {

        BeforeAll {
            <#
              Every fixture here needs the same three things: a kit holding a core command at a
              base sha, a target that was given that base, and the kit moved on since -
              otherwise the script short-circuits on "no upstream change" and never reaches the
              branch under test. Only what the target has on disk differs between the cases.
            #>
            function New-CorePair {
                param([Parameter(Mandatory)][string] $Name, [Parameter(Mandatory)][string] $TargetCoreText)

                $kit = New-GitRepo -Path (Join-Path $TestDrive "kit-$Name")
                $target = New-GitRepo -Path (Join-Path $TestDrive "target-$Name")

                $baseSha = Add-GitCommit -Path $kit -RelPath 'skills/slice/SKILL.md' -Content "core body`n" -Message 'base'
                Write-KitJson -TargetRepo $target -RecordedSha $baseSha

                $dir = Join-Path $target 'skills/slice'
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                [System.IO.File]::WriteAllText((Join-Path $dir 'SKILL.md'), $TargetCoreText, [System.Text.UTF8Encoding]::new($false))

                Add-GitCommit -Path $kit -RelPath 'skills/slice/SKILL.md' -Content "core body`nnew upstream line`n" -Message 'head' | Out-Null

                [pscustomobject]@{ Kit = $kit; Target = $target; BaseSha = $baseSha; CommandsDir = $dir }
            }
        }

        It 'an unedited core is taken outright - no reconciliation pass' {
            $f = New-CorePair -Name 'core-clean' -TargetCoreText "core body`n"

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -DryRun

            ($report | Where-Object Path -eq 'skills/slice/SKILL.md').Status | Should -Be 'WouldUpdated'
        }

        It 'an edited core with no companion is Unmigrated-Blocked and is not overwritten' {
            $f = New-CorePair -Name 'core-unmigrated' -TargetCoreText "core body, locally edited`n"

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha

            $row = $report | Where-Object Path -eq 'skills/slice/SKILL.md'
            $row.Status | Should -Be 'Unmigrated-Blocked'
            $row.Detail | Should -Match 'SKILL-local\.md'
            # Not a dry run: the point is that the local edit survived a real sync.
            [System.IO.File]::ReadAllText((Join-Path $f.CommandsDir 'SKILL.md')) | Should -Be "core body, locally edited`n"
        }

        It 'an edited core with a companion beside it is Superseded - taken outright, and said so' {
            $f = New-CorePair -Name 'core-superseded' -TargetCoreText "core body, locally edited`n"
            [System.IO.File]::WriteAllText((Join-Path $f.CommandsDir 'SKILL-local.md'), "## vocabulary`n`nUnits, not slices.`n", [System.Text.UTF8Encoding]::new($false))

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha

            ($report | Where-Object Path -eq 'skills/slice/SKILL.md').Status | Should -Be 'Superseded'
            [System.IO.File]::ReadAllText((Join-Path $f.CommandsDir 'SKILL.md')) | Should -Be "core body`nnew upstream line`n"
        }

        It 'a frontmatter-only companion is absent, so the core stays Unmigrated-Blocked' {
            $f = New-CorePair -Name 'core-fm-only' -TargetCoreText "core body, locally edited`n"
            [System.IO.File]::WriteAllText((Join-Path $f.CommandsDir 'SKILL-local.md'), "---`ndescription: reserved`n---`n`n", [System.Text.UTF8Encoding]::new($false))

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -DryRun

            ($report | Where-Object Path -eq 'skills/slice/SKILL.md').Status | Should -Be 'Unmigrated-Blocked'
        }

        It 'the companion itself is never in scope - the kit ships none, so nothing reads or writes it' {
            $f = New-CorePair -Name 'core-companion-untouched' -TargetCoreText "core body`n"
            $companion = Join-Path $f.CommandsDir 'SKILL-local.md'
            [System.IO.File]::WriteAllText($companion, "## vocabulary`n`nUnits, not slices.`n", [System.Text.UTF8Encoding]::new($false))

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha

            $report | Where-Object Path -like '*-local.md' | Should -BeNullOrEmpty
            [System.IO.File]::ReadAllText($companion) | Should -Be "## vocabulary`n`nUnits, not slices.`n"
        }

        It 'a non-command kit-owned file keeps the old Divergent-Skipped handling' {
            $kit = New-GitRepo -Path (Join-Path $TestDrive 'kit-tool-divergent')
            $target = New-GitRepo -Path (Join-Path $TestDrive 'target-tool-divergent')
            $baseSha = Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "base`n" -Message 'base'
            Write-KitJson -TargetRepo $target -RecordedSha $baseSha
            $dir = Join-Path $target 'tools'
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $dir 'Foo.ps1'), "base, edited`n", [System.Text.UTF8Encoding]::new($false))
            Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "base`nmore`n" -Message 'head' | Out-Null

            $report = & $script:ScriptPath -TargetRepo $target -KitRoot $kit -RecordedSha $baseSha -DryRun

            ($report | Where-Object Path -eq 'tools/Foo.ps1').Status | Should -Be 'Divergent-Skipped'
        }

        <#
          Regression guard. This script dot-sources Test-Companion.ps1 for the absence rule,
          which re-runs that script's param() block in this scope - and both scripts name their
          input -TargetRepo. Without the snapshot/restore around the dot-source, -TargetRepo
          silently became the current working directory and every comparison ran against the
          wrong repository while still reporting plausible-looking rows.
        #>
        It 'dot-sourcing Test-Companion.ps1 does not clobber this script''s own -TargetRepo' {
            $f = New-CorePair -Name 'param-clobber' -TargetCoreText "core body`n"
            Push-Location $TestDrive
            try {
                $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -DryRun
            } finally {
                Pop-Location
            }

            ($report | Where-Object Path -eq 'skills/slice/SKILL.md').Status | Should -Be 'WouldUpdated'
        }
    }

    Context 'target content matching the pre-#20 encoding-corruption pattern (#42)' {

        BeforeAll {
            function New-CorruptedPair {
                <#
                Simulates what a24541e's missing StandardOutputEncoding baked into a target's
                on-disk bytes before that fix: the recorded blob's UTF-8 bytes, mis-decoded
                under code page 437 (the host the bug report came from), written straight to
                the target file - not a real local edit, but byte-for-byte different from the
                recorded blob all the same.
                #>
                param([Parameter(Mandatory)][string] $Name)

                $kit = New-GitRepo -Path (Join-Path $TestDrive "kit-$Name")
                $target = New-GitRepo -Path (Join-Path $TestDrive "target-$Name")
                $correctText = "line one em dash `u{2014} end`n"
                $baseSha = Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content $correctText -Message 'base'
                Write-KitJson -TargetRepo $target -RecordedSha $baseSha

                $cp437 = [System.Text.Encoding]::GetEncoding(437)
                $corruptedText = $cp437.GetString([System.Text.Encoding]::UTF8.GetBytes($correctText))
                $dir = Join-Path $target 'tools'
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                $targetPath = Join-Path $dir 'Foo.ps1'
                [System.IO.File]::WriteAllText($targetPath, $corruptedText, [System.Text.UTF8Encoding]::new($false))

                $headText = "$correctText more`n"
                Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content $headText -Message 'head' | Out-Null

                [pscustomobject]@{
                    Kit = $kit; Target = $target; BaseSha = $baseSha
                    TargetPath = $targetPath; CorrectText = $correctText; CorruptedText = $corruptedText; HeadText = $headText
                }
            }
        }

        It 'is still Divergent-Skipped by default, but the Detail names the corruption pattern' {
            $f = New-CorruptedPair -Name 'corrupt-detect'

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -DryRun
            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'

            $row.Status | Should -Be 'Divergent-Skipped'
            $row.Detail | Should -Match 'pre-#20'
            $row.Detail | Should -Match 'RepairCorruption'
        }

        It 'a genuine ASCII-only local edit is never flagged as this corruption pattern' {
            $kit = New-GitRepo -Path (Join-Path $TestDrive 'kit-ascii-edit')
            $target = New-GitRepo -Path (Join-Path $TestDrive 'target-ascii-edit')
            $baseSha = Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "base`n" -Message 'base'
            Write-KitJson -TargetRepo $target -RecordedSha $baseSha
            $dir = Join-Path $target 'tools'
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $dir 'Foo.ps1'), "base, edited`n", [System.Text.UTF8Encoding]::new($false))
            Add-GitCommit -Path $kit -RelPath 'tools/Foo.ps1' -Content "base`nmore`n" -Message 'head' | Out-Null

            $report = & $script:ScriptPath -TargetRepo $target -KitRoot $kit -RecordedSha $baseSha -DryRun -RepairCorruption
            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'

            $row.Status | Should -Be 'Divergent-Skipped'
            $row.Detail | Should -Not -Match 'pre-#20'
            [System.IO.File]::ReadAllText((Join-Path $dir 'Foo.ps1')) | Should -Be "base, edited`n"
        }

        It '-RepairCorruption reports WouldRepairedCorruption and writes nothing in a dry run' {
            $f = New-CorruptedPair -Name 'corrupt-dryrun'

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -DryRun -RepairCorruption
            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'

            $row.Status | Should -Be 'WouldRepairedCorruption'
            [System.IO.File]::ReadAllText($f.TargetPath) | Should -Be $f.CorruptedText
        }

        It '-RepairCorruption without -DryRun overwrites the corrupted file with the kit''s head content' {
            $f = New-CorruptedPair -Name 'corrupt-apply'

            $report = & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha -RepairCorruption
            $row = $report | Where-Object Path -eq 'tools/Foo.ps1'

            $row.Status | Should -Be 'RepairedCorruption'
            [System.IO.File]::ReadAllText($f.TargetPath) | Should -Be $f.HeadText
        }

        It 'without -RepairCorruption, the corrupted file is left untouched even on a real (non-dry-run) sync' {
            $f = New-CorruptedPair -Name 'corrupt-untouched'

            & $script:ScriptPath -TargetRepo $f.Target -KitRoot $f.Kit -RecordedSha $f.BaseSha | Out-Null

            [System.IO.File]::ReadAllText($f.TargetPath) | Should -Be $f.CorruptedText
        }
    }

    Context 'Invoke-GitRaw decodes git output as UTF-8 regardless of the console default' {

        BeforeAll {
            $script:PreDotSourceErrorActionPreference = $ErrorActionPreference
            # Any KitRoot that does not exist throws inside Resolve-KitRoot - which runs
            # after every function below it is defined - so the functions survive the throw.
            try {
                . $script:ScriptPath -TargetRepo $TestDrive -KitRoot (Join-Path $TestDrive 'does-not-exist') -RecordedSha 'deadbeef' -ErrorAction Stop
            } catch {
                # expected - Resolve-KitRoot's throw, functions are already defined by now
            }

            $script:EncodingRepo = New-GitRepo -Path (Join-Path $TestDrive 'encoding-repo')
            # An em dash: multi-byte in UTF-8, decodes to different-length garbage under the
            # OEM code page (ibm437) the bug report's host had as its console default.
            Add-GitCommit -Path $script:EncodingRepo -RelPath 'file.md' -Content "line one em dash `u{2014} end`n" -Message 'em dash' | Out-Null
        }

        AfterAll {
            $ErrorActionPreference = $script:PreDotSourceErrorActionPreference
            Set-StrictMode -Off
        }

        It 'decodes a non-ASCII git blob correctly even when Console.OutputEncoding is a non-UTF8 code page' {
            $original = [Console]::OutputEncoding
            try {
                [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(437)
                $content = Invoke-GitRaw -GitArgs @('show', 'HEAD:file.md') -WorkingDir $script:EncodingRepo
            } finally {
                [Console]::OutputEncoding = $original
            }

            $content | Should -Be "line one em dash `u{2014} end`n"
        }
    }

    Context 'Resolve-KitRoot honors $env:AGENTKIT_HOME per AGENTS.md''s home-install convention' {

        BeforeAll {
            $script:PriorAgentKitHome = $env:AGENTKIT_HOME
            $script:PreDotSourceErrorActionPreference = $ErrorActionPreference

            # $script:ScriptPath lives inside this real checkout, which has a .git folder, so
            # dot-sourcing it directly always resolves self-hosted and never exercises the
            # $env:AGENTKIT_HOME branch. Copy it to a TestDrive location with no .git anywhere
            # above it, so Resolve-KitRoot's self-hosted check genuinely misses there.
            $fixtureDir = Join-Path $TestDrive 'no-git-fixture/tools'
            New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
            $script:FixtureScript = Join-Path $fixtureDir 'Sync-Kit.ps1'
            Copy-Item -LiteralPath $script:ScriptPath -Destination $script:FixtureScript

            # As in the Invoke-GitRaw Context above: dot-source with a -KitRoot that does not
            # exist, so Resolve-KitRoot throws on Resolve-Path immediately - after every
            # function in the script is already defined - leaving Resolve-KitRoot itself
            # callable directly, against the fixture's own $PSScriptRoot, for the tests below.
            try {
                . $script:FixtureScript -TargetRepo $TestDrive -KitRoot (Join-Path $TestDrive 'does-not-exist-explicit') -RecordedSha 'deadbeef' -ErrorAction Stop
            } catch {
                # expected - Resolve-KitRoot's throw, functions are already defined by now
            }
        }

        AfterEach {
            $env:AGENTKIT_HOME = $script:PriorAgentKitHome
        }

        AfterAll {
            $ErrorActionPreference = $script:PreDotSourceErrorActionPreference
            Set-StrictMode -Off
        }

        It 'resolves the install root from $env:AGENTKIT_HOME when no self-hosted checkout is available' {
            $agentKitHome = New-GitRepo -Path (Join-Path $TestDrive 'agentkit-home-valid')
            $env:AGENTKIT_HOME = $agentKitHome

            Resolve-KitRoot -Explicit '' | Should -Be (Resolve-Path -LiteralPath $agentKitHome).Path
        }

        It 'ignores $env:AGENTKIT_HOME when it has no .git, and falls through to $HOME/.agent-kit or the not-found throw' {
            $env:AGENTKIT_HOME = Join-Path $TestDrive 'agentkit-home-without-git'
            New-Item -ItemType Directory -Path $env:AGENTKIT_HOME -Force | Out-Null
            $fallbackRoot = Join-Path $HOME '.agent-kit'
            if (Test-Path -LiteralPath (Join-Path $fallbackRoot '.git')) {
                Set-ItResult -Skipped -Because 'this machine already has a real home install at $HOME/.agent-kit'
                return
            }

            { Resolve-KitRoot -Explicit '' } | Should -Throw "*$fallbackRoot*"
        }
    }
}
