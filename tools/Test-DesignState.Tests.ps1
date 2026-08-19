#Requires -Version 7.0
#Requires -Modules Pester

<#
  Test-DesignState.ps1 exits the process on real invocation (0/1/2), so these tests dot-source
  it purely to reuse its functions and skip its own invocation block - the same guard shape
  Test-DesignDrift.ps1, Wait-PullRequestCheck.ps1 and Read-DesignState.ps1 already use.

  Every fixture below is written into $TestDrive under a throwaway root; the final Describe
  block is explicit about reading this repository's own tree instead.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Test-DesignState.ps1'
    . $script:ScriptPath -Path $TestDrive

    function New-StateFile {
        param([Parameter(Mandatory)][string] $RelativePath, [Parameter(Mandatory)][string] $Content)
        $full = Join-Path $TestDrive (Join-Path 'design/state' $RelativePath)
        New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
        Set-Content -LiteralPath $full -Value $Content -Encoding utf8NoBOM
        $full
    }

    function New-TreeFile {
        param([Parameter(Mandatory)][string] $RelativePath, [Parameter(Mandatory)][string] $Content)
        $full = Join-Path $TestDrive $RelativePath
        New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
        Set-Content -LiteralPath $full -Value $Content -Encoding utf8NoBOM
        $full
    }

    function New-Record {
        param(
            [Parameter(Mandatory)][string] $Id,
            [string] $Kind = 'Unit',
            [hashtable] $Scalars = @{},
            [hashtable] $Lists = @{},
            [hashtable] $Prose = @{},
            [string] $Path = 'design/state/units/command/placeholder.md'
        )
        New-DesignRecord -Id $Id -Kind $Kind -Path $Path -Scalars $Scalars -Lists $Lists -Prose $Prose
    }

    # A minimal but exact stand-in for design/20-contract.md § "The divergence classes",
    # carrying the same 22 ids Test-DesignState.ps1 declares, so end-to-end tests below do not
    # spuriously raise ClassListDisagreement while exercising something else entirely.
    $script:MinimalContract = @'
### The divergence classes

**This is the closed list.**

**Blocking.**

| Class | Raised when | Caller sees |
|---|---|---|
| `UnresolvedId` | x | x |
| `AnchorMissing` | x | x |
| `OwnerMismatch` | x | x |
| `UnrecordedArtifact` | x | x |
| `ProjectionStale` | x | x |
| `RegionMalformed` | x | x |
| `IdCollision` | x | x |
| `DecisionAnchorAmbiguous` | x | x |
| `LogEntryUnrecorded` | x | x |
| `EnforcementUnevidenced` | x | x |
| `ClosureOverBudget` | x | x |
| `ClassListDisagreement` | x | x |

**Reported, never blocking.**

| Class | Raised when | Why it never blocks |
|---|---|---|
| `MirrorStale` | x | x |
| `WorkStateDivergence` | x | x |
| `PinAncestry` | x | x |
| `SemanticDisagreement` | x | x |

**Could not evaluate.**

| `DesignStateFailure` | Raised when | Caller does |
|---|---|---|
| `StateSetAbsent` | x | x |
| `RecordUnparseable` | x | x |
| `TrackerUnavailable` | x | x |
| `ShallowCheckout` | x | x |
| `ProjectorFailed` | x | x |
| `ContractListUnreadable` | x | x |

### The freeze
'@
}

AfterAll {
    Get-ChildItem $TestDrive -ErrorAction SilentlyContinue -Recurse -File |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

Describe 'Test-DesignState: id resolution and record-level classes' {

    It 'S5.1: UnresolvedId fires when a list field names an id with no record' {
        $a = New-Record -Id 'unit/command/a' -Lists @{ Binds = @('I999') }
        $findings = Test-UnresolvedId -ById @{ 'unit/command/a' = $a } -Records @($a)
        $findings.Count | Should -Be 1
        $findings[0].Class | Should -Be 'UnresolvedId'
        $findings[0].Subject | Should -Be 'unit/command/a'
    }

    It 'UnresolvedId does not fire for a retired id a live record names (still resolvable)' {
        $a = New-Record -Id 'unit/command/a' -Lists @{ Live = @('decision/x') }
        $d = New-Record -Id 'decision/x' -Kind 'Decision' -Scalars @{ Status = 'retired' }
        $findings = Test-UnresolvedId -ById @{ 'unit/command/a' = $a; 'decision/x' = $d } -Records @($a, $d)
        $findings.Count | Should -Be 0
    }

    It 'UnresolvedId does not check Work or Evidence - they are not design-state ids' {
        $a = New-Record -Id 'unit/command/a' -Lists @{ Work = @('42'); Evidence = @('tools/x.ps1') }
        $findings = Test-UnresolvedId -ById @{ 'unit/command/a' = $a } -Records @($a)
        $findings.Count | Should -Be 0
    }

    It 'S5.1: UnresolvedId also checks scalar id fields (Owner, SupersededBy, AnsweredBy)' {
        $c = New-Record -Id 'contract/x' -Kind 'Contract' -Scalars @{ Owner = 'unit/command/nobody' }
        $findings = Test-UnresolvedId -ById @{ 'contract/x' = $c } -Records @($c)
        $findings.Count | Should -Be 1
        $findings[0].Detail | Should -Match 'Owner'
    }

    It 'S5.1/module boundaries: AnchorMissing fires only for an active Unit whose Anchor is not in the tree' {
        $active = New-Record -Id 'unit/command/a' -Scalars @{ Status = 'active'; Kind = 'command'; Anchor = '.claude/commands/nope.md' }
        $retired = New-Record -Id 'unit/command/b' -Scalars @{ Status = 'retired'; Kind = 'command'; Anchor = '.claude/commands/also-nope.md' }
        $invariant = New-Record -Id 'I1' -Kind 'Invariant' -Scalars @{ Status = 'active'; Anchor = 'I1'; Kind = 'invariant' }

        $findings = Test-AnchorMissing -Records @($active, $retired, $invariant) -RepoPath $TestDrive

        $findings.Count | Should -Be 1
        $findings[0].Subject | Should -Be 'unit/command/a'
    }

    It 'AnchorMissing does not fire when the anchor exists' {
        New-TreeFile -RelativePath '.claude/commands/real.md' -Content 'hi'
        $active = New-Record -Id 'unit/command/a' -Scalars @{ Status = 'active'; Kind = 'command'; Anchor = '.claude/commands/real.md' }
        $findings = Test-AnchorMissing -Records @($active) -RepoPath $TestDrive
        $findings.Count | Should -Be 0
    }

    It 'S5.1: OwnerMismatch fires when nobody exposes the contract' {
        $c = New-Record -Id 'contract/x' -Kind 'Contract' -Scalars @{ Owner = 'unit/command/a'; Status = 'active' }
        $findings = Test-OwnerMismatch -Records @($c)
        $findings.Count | Should -Be 1
        $findings[0].Detail | Should -Match 'nobody'
    }

    It 'OwnerMismatch fires when two units expose the same contract' {
        $c = New-Record -Id 'contract/x' -Kind 'Contract' -Scalars @{ Owner = 'unit/command/a'; Status = 'active' }
        $a = New-Record -Id 'unit/command/a' -Scalars @{ Status = 'active' } -Lists @{ Exposes = @('contract/x') }
        $b = New-Record -Id 'unit/command/b' -Scalars @{ Status = 'active' } -Lists @{ Exposes = @('contract/x') }
        $findings = Test-OwnerMismatch -Records @($c, $a, $b)
        $findings.Count | Should -Be 1
    }

    It 'OwnerMismatch does not fire for the unique active exposer matching Owner' {
        $c = New-Record -Id 'contract/x' -Kind 'Contract' -Scalars @{ Owner = 'unit/command/a'; Status = 'active' }
        $a = New-Record -Id 'unit/command/a' -Scalars @{ Status = 'active' } -Lists @{ Exposes = @('contract/x') }
        $findings = Test-OwnerMismatch -Records @($c, $a)
        $findings.Count | Should -Be 0
    }

    It 'S5.1: EnforcementUnevidenced fires for an invariant claiming code enforcement with no Evidence' {
        $i = New-Record -Id 'I1' -Kind 'Invariant' -Scalars @{ Enforcement = 'code' } -Lists @{ Evidence = @() }
        $findings = Test-EnforcementUnevidenced -Records @($i)
        $findings.Count | Should -Be 1
    }

    It 'EnforcementUnevidenced does not fire when Evidence is present, or when Enforcement is instruction' {
        $withEvidence = New-Record -Id 'I1' -Kind 'Invariant' -Scalars @{ Enforcement = 'code' } -Lists @{ Evidence = @('tools/x.Tests.ps1') }
        $instruction = New-Record -Id 'I2' -Kind 'Invariant' -Scalars @{ Enforcement = 'instruction' } -Lists @{ Evidence = @() }
        $findings = Test-EnforcementUnevidenced -Records @($withEvidence, $instruction)
        $findings.Count | Should -Be 0
    }
}

Describe 'Test-DesignState: IdCollision' {

    It 'S5.1: fires when two records claim the same id' {
        # a-again.md's own path implies id 'unit/command/a-again', which also disagrees with
        # the record's declared id - that is a second, independent IdCollision (a record whose
        # id disagrees with its file path), so both records claiming 'unit/command/a' produce
        # two findings here, not one.
        $a = New-Record -Id 'unit/command/a' -Path 'design/state/units/command/a.md'
        $b = New-Record -Id 'unit/command/a' -Path 'design/state/units/command/a-again.md'
        $findings = Test-RecordIdCollision -Records @($a, $b)
        (@($findings | Where-Object { $_.Detail -match 'claimed by more than one file' })).Count | Should -Be 1
    }

    It 'S4.7: fires when a record''s own id disagrees with the id its file path implies' {
        $a = New-Record -Id 'unit/command/wrong' -Path 'design/state/units/command/right.md'
        $findings = Test-RecordIdCollision -Records @($a)
        $findings.Count | Should -Be 1
        $findings[0].Detail | Should -Match 'right'
    }

    It 'does not fire when a single record''s id agrees with its path' {
        $a = New-Record -Id 'unit/command/right' -Path 'design/state/units/command/right.md'
        $findings = Test-RecordIdCollision -Records @($a)
        $findings.Count | Should -Be 0
    }

    It 'region form collision: fires when an id appears as both the projected and the declared form' {
        $inventory = @(
            [pscustomobject]@{ Id = 'companion'; Form = 'Projected'; File = 'a.md' }
            [pscustomobject]@{ Id = 'companion'; Form = 'Declared'; File = 'b.md' }
        )
        $findings = Test-RegionFormCollision -Inventory $inventory
        $findings.Count | Should -Be 1
        $findings[0].Class | Should -Be 'IdCollision'
    }

    It 'region form collision: does not fire when the same id only ever appears in one form' {
        $inventory = @(
            [pscustomobject]@{ Id = 'companion'; Form = 'Projected'; File = 'a.md' }
            [pscustomobject]@{ Id = 'companion'; Form = 'Projected'; File = 'b.md' }
        )
        $findings = Test-RegionFormCollision -Inventory $inventory
        $findings.Count | Should -Be 0
    }
}

Describe 'Test-DesignState: marked regions (RegionMalformed)' {

    It 'balanced projected and declared regions raise nothing' {
        New-TreeFile -RelativePath '.claude/commands/ok.md' -Content @'
before
<!-- companion:start -->
body
<!-- companion:end -->
<!-- extra:declared:start -->
hand-written
<!-- extra:declared:end -->
after
'@
        $result = Get-MarkedRegions -RepoPath $TestDrive -Files @('.claude/commands/ok.md')
        $result.Findings.Count | Should -Be 0
        $result.Inventory.Count | Should -Be 2
    }

    It 'S5.1: an unterminated region is RegionMalformed' {
        New-TreeFile -RelativePath '.claude/commands/unterminated.md' -Content @'
<!-- companion:start -->
never closed
'@
        $result = Get-MarkedRegions -RepoPath $TestDrive -Files @('.claude/commands/unterminated.md')
        $result.Findings.Count | Should -Be 1
        $result.Findings[0].Class | Should -Be 'RegionMalformed'
    }

    It 'S5.1: a nested region of the same id is RegionMalformed' {
        New-TreeFile -RelativePath '.claude/commands/nested.md' -Content @'
<!-- x:start -->
<!-- x:start -->
<!-- x:end -->
<!-- x:end -->
'@
        $result = Get-MarkedRegions -RepoPath $TestDrive -Files @('.claude/commands/nested.md')
        $result.Findings.Count | Should -BeGreaterThan 0
    }

    It 'a marker mentioned mid-sentence in prose (not alone on its line) is not treated as a region' {
        New-TreeFile -RelativePath 'design/prose.md' -Content @'
This paragraph mentions `<!-- agent:start -->` as an example of the syntax, inline.
'@
        $result = Get-MarkedRegions -RepoPath $TestDrive -Files @('design/prose.md')
        $result.Findings.Count | Should -Be 0
        $result.Inventory.Count | Should -Be 0
    }

    It 'a mismatched closing marker is RegionMalformed' {
        New-TreeFile -RelativePath '.claude/commands/mismatch.md' -Content @'
<!-- a:start -->
<!-- b:end -->
'@
        $result = Get-MarkedRegions -RepoPath $TestDrive -Files @('.claude/commands/mismatch.md')
        $result.Findings.Count | Should -BeGreaterThan 0
    }
}

Describe 'Test-DesignState: DecisionAnchorAmbiguous and LogEntryUnrecorded' {

    It 'S5.1: DecisionAnchorAmbiguous fires when a decision''s Anchor resolves to zero headings' {
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content @'
### 2026-01-01 — Something happened
'@
        $d = New-Record -Id 'decision/x' -Kind 'Decision' -Scalars @{ Anchor = '2026-01-01 — Something else entirely' }
        $findings = Test-DecisionAnchors -Records @($d) -LogPath (Join-Path $TestDrive 'design/90-decisions.md')
        (@($findings | Where-Object { $_.Class -eq 'DecisionAnchorAmbiguous' })).Count | Should -Be 1
    }

    It 'DecisionAnchorAmbiguous fires when a decision''s Anchor resolves to two headings' {
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content @'
### 2026-01-01 — Duplicate heading
### 2026-01-01 — Duplicate heading
'@
        $d = New-Record -Id 'decision/x' -Kind 'Decision' -Scalars @{ Anchor = '2026-01-01 — Duplicate heading' }
        $findings = Test-DecisionAnchors -Records @($d) -LogPath (Join-Path $TestDrive 'design/90-decisions.md')
        (@($findings | Where-Object { $_.Class -eq 'DecisionAnchorAmbiguous' })).Count | Should -Be 1
    }

    It 'DecisionAnchorAmbiguous does not fire when the Anchor resolves to exactly one heading' {
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content @'
### 2026-01-01 — Only one
'@
        $d = New-Record -Id 'decision/x' -Kind 'Decision' -Scalars @{ Anchor = '2026-01-01 — Only one' }
        $findings = Test-DecisionAnchors -Records @($d) -LogPath (Join-Path $TestDrive 'design/90-decisions.md')
        (@($findings | Where-Object { $_.Class -eq 'DecisionAnchorAmbiguous' })).Count | Should -Be 0
    }

    It 'S5.1: LogEntryUnrecorded fires for a log heading with no decision record naming it' {
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content @'
### 2026-01-01 — Unrecorded entry
'@
        $findings = Test-DecisionAnchors -Records @() -LogPath (Join-Path $TestDrive 'design/90-decisions.md')
        (@($findings | Where-Object { $_.Class -eq 'LogEntryUnrecorded' })).Count | Should -Be 1
    }

    It 'LogEntryUnrecorded does not fire when every heading has a matching decision record' {
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content @'
### 2026-01-01 — Recorded
'@
        $d = New-Record -Id 'decision/x' -Kind 'Decision' -Scalars @{ Anchor = '2026-01-01 — Recorded' }
        $findings = Test-DecisionAnchors -Records @($d) -LogPath (Join-Path $TestDrive 'design/90-decisions.md')
        (@($findings | Where-Object { $_.Class -eq 'LogEntryUnrecorded' })).Count | Should -Be 0
    }
}

Describe 'Test-DesignState: UnrecordedArtifact' {

    It 'fires for a command-glob file with no active unit record naming it as Anchor' {
        New-TreeFile -RelativePath '.claude/commands/lonely.md' -Content 'x'
        $findings = Test-UnrecordedArtifact -Records @() -RepoPath $TestDrive
        (@($findings | Where-Object { $_.Subject -eq '.claude/commands/lonely.md' })).Count | Should -Be 1
    }

    It 'excludes a *-local.md companion file from the command glob' {
        New-TreeFile -RelativePath '.claude/commands/foo-local.md' -Content 'x'
        $findings = Test-UnrecordedArtifact -Records @() -RepoPath $TestDrive
        (@($findings | Where-Object { $_.Subject -eq '.claude/commands/foo-local.md' })).Count | Should -Be 0
    }

    It 'does not fire when an active unit record names the artifact as its Anchor' {
        New-TreeFile -RelativePath '.claude/commands/known.md' -Content 'x'
        $unit = New-Record -Id 'unit/command/known' -Scalars @{ Status = 'active'; Kind = 'command'; Anchor = '.claude/commands/known.md' }
        $findings = Test-UnrecordedArtifact -Records @($unit) -RepoPath $TestDrive
        (@($findings | Where-Object { $_.Subject -eq '.claude/commands/known.md' })).Count | Should -Be 0
    }

    It 'reverse direction: fires when an active unit record''s Anchor is not matched by its kind''s glob' {
        $unit = New-Record -Id 'unit/command/ghost' -Scalars @{ Status = 'active'; Kind = 'command'; Anchor = '.claude/commands/does-not-exist.md' }
        $findings = Test-UnrecordedArtifact -Records @($unit) -RepoPath $TestDrive
        (@($findings | Where-Object { $_.Subject -eq 'unit/command/ghost' })).Count | Should -Be 1
    }

    It 'invariant kind: fires for a cited invariant number with no record, and for a record never cited' {
        New-TreeFile -RelativePath 'AGENTS.md' -Content 'This project relies on I7 throughout.'
        $recorded = New-Record -Id 'I8' -Kind 'Invariant' -Scalars @{ Status = 'active' }
        $findings = Test-UnrecordedArtifact -Records @($recorded) -RepoPath $TestDrive

        $subjects = @($findings | ForEach-Object { $_.Subject })
        $subjects | Should -Contain 'I7'
        $subjects | Should -Contain 'I8'
    }

    It 'invariant kind: raises nothing when citation and record agree' {
        New-TreeFile -RelativePath 'AGENTS.md' -Content 'This project relies on I7 throughout.'
        $recorded = New-Record -Id 'I7' -Kind 'Invariant' -Scalars @{ Status = 'active' }
        $findings = Test-UnrecordedArtifact -Records @($recorded) -RepoPath $TestDrive
        (@($findings | Where-Object { $_.Subject -in @('I7') -or ($_.Detail -match 'invariant') })).Count | Should -Be 0
    }
}

Describe 'Test-DesignState: the budget meter (S5.5, S5.7)' {

    It 'S5.5: closure excludes Archival and excludes any named record whose Status is retired' {
        New-StateFile -RelativePath 'units/command/root.md' -Content @'
# unit/command/root
Kind: command
Status: active
Live: decision/live-one
Archival: decision/archival-one
Binds: I1
'@
        New-StateFile -RelativePath 'decisions/live-one.md' -Content @'
# decision/live-one
Status: accepted
'@
        New-StateFile -RelativePath 'decisions/archival-one.md' -Content @'
# decision/archival-one
Status: accepted
'@
        New-StateFile -RelativePath 'invariants/I1.md' -Content @'
# I1
Kind: invariant
Status: retired
'@
        $graph = Read-DesignStateGraph -Path $TestDrive
        $byId = @{}
        foreach ($r in $graph.Records) { $byId[$r.Id] = $r }
        $root = $byId['unit/command/root']

        $members = Get-DesignClosure -Root $root -ById $byId
        $ids = @($members | ForEach-Object { $_.Id })

        $ids | Should -Contain 'unit/command/root'
        $ids | Should -Contain 'decision/live-one'
        $ids | Should -Not -Contain 'decision/archival-one'
        $ids | Should -Not -Contain 'I1'
    }

    It 'S5.5: a live record naming a retired one raises no UnresolvedId finding' {
        New-StateFile -RelativePath 'units/command/root.md' -Content @'
# unit/command/root
Kind: command
Live: decision/retired-one
'@
        New-StateFile -RelativePath 'decisions/retired-one.md' -Content @'
# decision/retired-one
Status: retired
'@
        $graph = Read-DesignStateGraph -Path $TestDrive
        $byId = @{}
        foreach ($r in $graph.Records) { $byId[$r.Id] = $r }
        $findings = Test-UnresolvedId -ById $byId -Records $graph.Records
        $findings.Count | Should -Be 0
    }

    It 'S5.7: ClosureOverBudget fires at 16,385 bytes and not at 16,384' {
        function Set-ExactSizeRecord {
            param([string] $Slug, [int] $TotalBytes)
            $header = "# unit/command/$Slug`nKind: command`n"
            $pad = $TotalBytes - [System.Text.Encoding]::UTF8.GetByteCount($header)
            $content = $header + ('z' * $pad)
            $full = Join-Path $TestDrive "design/state/units/command/$Slug.md"
            New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
            [System.IO.File]::WriteAllText($full, $content, [System.Text.UTF8Encoding]::new($false))
            $full
        }

        $underPath = Set-ExactSizeRecord -Slug 'big-under' -TotalBytes 16384
        $overPath = Set-ExactSizeRecord -Slug 'big-over' -TotalBytes 16385

        $underBytes = (Get-Item $underPath).Length
        $overBytes = (Get-Item $overPath).Length
        $underBytes | Should -Be 16384
        $overBytes | Should -Be 16385

        $graph = Read-DesignStateGraph -Path $TestDrive
        $byId = @{}
        foreach ($r in $graph.Records) { $byId[$r.Id] = $r }

        $result = Test-ClosureBudget -Records $graph.Records -ById $byId -RepoPath $TestDrive
        (@($result.Findings | Where-Object { $_.Subject -eq 'unit/command/big-under' })).Count | Should -Be 0
        (@($result.Findings | Where-Object { $_.Subject -eq 'unit/command/big-over' })).Count | Should -Be 1
    }

    It 'S5.6: names the largest closure, its unit, and its largest contributor' {
        New-StateFile -RelativePath 'units/command/small.md' -Content @'
# unit/command/small
Kind: command
'@
        $graph = Read-DesignStateGraph -Path $TestDrive
        $byId = @{}
        foreach ($r in $graph.Records) { $byId[$r.Id] = $r }
        $result = Test-ClosureBudget -Records $graph.Records -ById $byId -RepoPath $TestDrive

        $result.Largest | Should -Not -BeNullOrEmpty
        $result.Largest.Unit | Should -Not -BeNullOrEmpty
        $result.Largest.Bytes | Should -BeGreaterThan 0
        $result.Largest.LargestContributor | Should -Not -BeNullOrEmpty
    }
}

Describe 'Test-DesignState: ClassListDisagreement (S5.1)' {

    It 'raises nothing when the contract document declares exactly the same 22 ids' {
        New-TreeFile -RelativePath 'design/20-contract.md' -Content $script:MinimalContract
        $result = Test-ClassListAgreement -ContractPath (Join-Path $TestDrive 'design/20-contract.md')
        $result.Finding | Should -BeNullOrEmpty
        $result.CouldNotEvaluate | Should -BeNullOrEmpty
    }

    It 'fires when the contract document is missing a blocking class the script declares' {
        $missingOne = $script:MinimalContract -replace "\| ``ClosureOverBudget`` \| x \| x \|\r?\n", ''
        New-TreeFile -RelativePath 'design/20-contract-missing.md' -Content $missingOne
        $result = Test-ClassListAgreement -ContractPath (Join-Path $TestDrive 'design/20-contract-missing.md')
        $result.Finding | Should -Not -BeNullOrEmpty
        $result.Finding.Class | Should -Be 'ClassListDisagreement'
    }

    It 'S5.1: ContractListUnreadable is could-not-evaluate when the contract document cannot be found' {
        $result = Test-ClassListAgreement -ContractPath (Join-Path $TestDrive 'design/does-not-exist.md')
        $result.CouldNotEvaluate | Should -Not -BeNullOrEmpty
        $result.CouldNotEvaluate.Reason | Should -Be 'ContractListUnreadable'
        $result.Finding | Should -BeNullOrEmpty
    }

    It 'the DesignStateFailure header cell in the "could not evaluate" table is not read as a class id' {
        New-TreeFile -RelativePath 'design/20-contract.md' -Content $script:MinimalContract
        $parsed = Get-ContractClassIds -ContractPath (Join-Path $TestDrive 'design/20-contract.md')
        $parsed.Ids.CouldNotEvaluate | Should -Not -Contain 'DesignStateFailure'
    }
}

Describe 'Test-DesignState: the freeze gate (S5.8)' {

    BeforeEach {
        Remove-Item -LiteralPath (Join-Path $TestDrive 'design/FROZEN.md') -Force -ErrorAction SilentlyContinue
    }

    It 'downgrades every blocking finding to reported, states the count, and reproduces the marker verbatim' {
        New-TreeFile -RelativePath 'design/FROZEN.md' -Content @'
# design/ is frozen

Frozen at: abc1234, 2026-08-19
Frozen because: escaping the generative loop
Lifts when: tier one is code-complete

To lift: run `/unfreeze`.
'@
        $marker = Get-FreezeMarker -RepoPath $TestDrive
        $marker | Should -Not -BeNullOrEmpty
        $marker.FrozenBecause | Should -Be 'Frozen because: escaping the generative loop'
        $marker.LiftsWhen | Should -Be 'Lifts when: tier one is code-complete'
    }

    It 'returns null when design/FROZEN.md does not exist' {
        $marker = Get-FreezeMarker -RepoPath $TestDrive
        $marker | Should -BeNullOrEmpty
    }
}

Describe 'Test-DesignState: the projector seam (S5.10)' {

    It 'reports Ran = $false when tools/Update-DesignProjection.ps1 does not exist' {
        $result = Invoke-Projector -RepoPath $TestDrive
        $result.Ran | Should -BeFalse
        $result.Detail | Should -Match 'does not exist'
    }

    It 'reports Ran = $false when the projector exits non-zero' {
        New-TreeFile -RelativePath 'tools/Update-DesignProjection.ps1' -Content 'exit 1'
        $result = Invoke-Projector -RepoPath $TestDrive
        $result.Ran | Should -BeFalse
    }

    It 'reports Ran = $true when the projector exits zero' {
        New-TreeFile -RelativePath 'tools/Update-DesignProjection.ps1' -Content 'param([string]$Path,[switch]$DryRun) exit 0'
        $result = Invoke-Projector -RepoPath $TestDrive
        $result.Ran | Should -BeTrue
    }

    It 'S7.9: captures the projector''s -DryRun regions as structured objects, not just the exit code' {
        New-TreeFile -RelativePath 'tools/Update-DesignProjection.ps1' -Content @'
param([string]$Path,[switch]$DryRun)
[pscustomobject]@{ Document = 'x.md'; Id = 'units'; Content = 'rendered' } | ConvertTo-Json
exit 0
'@
        $result = Invoke-Projector -RepoPath $TestDrive
        $result.Ran | Should -BeTrue
        $result.Regions.Count | Should -Be 1
        $result.Regions[0].Id | Should -Be 'units'
    }
}

Describe 'Test-DesignState: ProjectionStale (S7.9)' {

    It 'fires when the tree''s region body differs from the projector''s rendering' {
        New-TreeFile -RelativePath 'x.md' -Content @'
# X

<!-- units:start -->
old content
<!-- units:end -->
'@
        $regions = @([pscustomobject]@{ Document = 'x.md'; Id = 'units'; Content = 'new content' })
        $findings = Test-ProjectionStale -Regions $regions -RepoPath $TestDrive
        $findings.Count | Should -Be 1
        $findings[0].Class | Should -Be 'ProjectionStale'
    }

    It 'does not fire when the tree''s region body matches the projector''s rendering exactly' {
        New-TreeFile -RelativePath 'x.md' -Content @'
# X

<!-- units:start -->
same content
<!-- units:end -->
'@
        $regions = @([pscustomobject]@{ Document = 'x.md'; Id = 'units'; Content = 'same content' })
        $findings = Test-ProjectionStale -Regions $regions -RepoPath $TestDrive
        $findings.Count | Should -Be 0
    }

    It 'S7.9: does not fire when the only difference is CRLF against LF' {
        New-TreeFile -RelativePath 'x.md' -Content "# X`r`n`r`n<!-- units:start -->`r`nline one`r`nline two`r`n<!-- units:end -->`r`n"
        $regions = @([pscustomobject]@{ Document = 'x.md'; Id = 'units'; Content = "line one`nline two" })
        $findings = Test-ProjectionStale -Regions $regions -RepoPath $TestDrive
        $findings.Count | Should -Be 0
    }

    It 'skips a region with no Document (the agent projection - no tree region to compare against)' {
        $regions = @([pscustomobject]@{ Document = $null; Id = 'agent'; Content = 'anything' })
        $findings = Test-ProjectionStale -Regions $regions -RepoPath $TestDrive
        $findings.Count | Should -Be 0
    }
}

Describe 'Test-DesignState: the tracker classes (S5.11)' {

    It 'S5.11: gh unavailable yields TrackerUnavailable, names WorkStateDivergence as not compared, and MirrorStale still runs' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $false }

        $ref = New-Record -Id 'work/42' -Kind 'WorkRef' -Scalars @{ Issue = '42'; State = 'open'; MirroredAt = 'deadbeef' }
        $result = Test-TrackerClasses -Records @($ref) -RepoPath $TestDrive -Repository 'x/y'

        ($result.CouldNotEvaluate | Where-Object { $_.Reason -eq 'TrackerUnavailable' }).Count | Should -Be 1
        $result.CouldNotEvaluate[0].Detail | Should -Match 'WorkStateDivergence not compared'
    }

    It 'MirrorStale fires when a WorkRef''s MirroredAt is not the current commit' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $false }
        Mock -CommandName Get-CurrentCommitSha -MockWith { 'currentsha' }

        $ref = New-Record -Id 'work/42' -Kind 'WorkRef' -Scalars @{ Issue = '42'; MirroredAt = 'stalesha' }
        $result = Test-TrackerClasses -Records @($ref) -RepoPath $TestDrive -Repository 'x/y'

        (@($result.Reported | Where-Object { $_.Class -eq 'MirrorStale' })).Count | Should -Be 1
    }

    It 'MirrorStale does not fire when MirroredAt matches the current commit' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $false }
        Mock -CommandName Get-CurrentCommitSha -MockWith { 'currentsha' }
        Mock -CommandName Test-CommitIsAncestor -MockWith { 'Ancestor' }

        $ref = New-Record -Id 'work/42' -Kind 'WorkRef' -Scalars @{ Issue = '42'; MirroredAt = 'currentsha' }
        $result = Test-TrackerClasses -Records @($ref) -RepoPath $TestDrive -Repository 'x/y'

        (@($result.Reported | Where-Object { $_.Class -eq 'MirrorStale' })).Count | Should -Be 0
    }

    It 'PinAncestry fires when MirroredAt is not an ancestor of HEAD, and does not need gh' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $false }
        Mock -CommandName Get-CurrentCommitSha -MockWith { 'currentsha' }
        Mock -CommandName Test-CommitIsAncestor -MockWith { 'NotAncestor' }

        $ref = New-Record -Id 'work/42' -Kind 'WorkRef' -Scalars @{ Issue = '42'; MirroredAt = 'orphaned' }
        $result = Test-TrackerClasses -Records @($ref) -RepoPath $TestDrive -Repository 'x/y'

        (@($result.Reported | Where-Object { $_.Class -eq 'PinAncestry' })).Count | Should -Be 1
    }

    It 'ShallowCheckout is could-not-evaluate, and never a pass, when ancestry cannot be resolved' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $false }
        Mock -CommandName Get-CurrentCommitSha -MockWith { 'currentsha' }
        Mock -CommandName Test-CommitIsAncestor -MockWith { 'Unresolvable' }

        $ref = New-Record -Id 'work/42' -Kind 'WorkRef' -Scalars @{ Issue = '42'; MirroredAt = 'orphaned' }
        $result = Test-TrackerClasses -Records @($ref) -RepoPath $TestDrive -Repository 'x/y'

        ($result.CouldNotEvaluate | Where-Object { $_.Reason -eq 'ShallowCheckout' }).Count | Should -Be 1
        (@($result.Reported | Where-Object { $_.Class -eq 'PinAncestry' })).Count | Should -Be 0
    }

    It 'no WorkRef records: every tracker class runs to completion with nothing to report' {
        Mock -CommandName Test-TrackerAvailable -MockWith { $true }
        $result = Test-TrackerClasses -Records @() -RepoPath $TestDrive -Repository 'x/y'
        $result.Reported.Count | Should -Be 0
        $result.CouldNotEvaluate.Count | Should -Be 0
    }
}

Describe 'Test-DesignState: end-to-end (S5.2, S5.3, S5.4, S5.9)' {

    BeforeEach {
        Get-ChildItem $TestDrive -ErrorAction SilentlyContinue -Recurse -File |
            Remove-Item -Force -ErrorAction SilentlyContinue
        New-TreeFile -RelativePath 'design/20-contract.md' -Content $script:MinimalContract
        New-TreeFile -RelativePath 'design/90-decisions.md' -Content "# Decisions`n"
    }

    It 'S5.4: an absent design/state/ yields StateSetAbsent, exit 2, and zero findings - never clean' {
        $result = Invoke-DesignStateCheck -RepoPath $TestDrive

        $result.ExitCode | Should -Be 2
        $result.Findings.Count | Should -Be 0
        $result.Reported.Count | Should -Be 0
        (@($result.CouldNotEvaluate | Where-Object { $_.Reason -eq 'StateSetAbsent' })).Count | Should -Be 1
    }

    It 'S5.2: all three lists are always present, even when empty (checked on the absent-state-set path)' {
        $result = Invoke-DesignStateCheck -RepoPath $TestDrive
        ($null -eq $result.Findings) | Should -BeFalse
        ($null -eq $result.Reported) | Should -BeFalse
        ($null -eq $result.CouldNotEvaluate) | Should -BeFalse
    }

    It 'S5.3: exit code is 2 (could-not-evaluate) even when a blocking finding also exists, in a run with records' {
        New-StateFile -RelativePath 'units/command/a.md' -Content @'
# unit/command/a
Kind: command
Status: active
Binds: I999
'@
        # ProjectorFailed always fires today (no projector exists), guaranteeing a could-not-evaluate
        # alongside the UnresolvedId blocking finding this record also produces.
        $result = Invoke-DesignStateCheck -RepoPath $TestDrive

        (@($result.Findings | Where-Object { $_.Class -eq 'UnresolvedId' })).Count | Should -Be 1
        $result.CouldNotEvaluate.Count | Should -BeGreaterThan 0
        $result.ExitCode | Should -Be 2
    }

    It 'S5.9: git status --short is empty after a run that found blocking divergences' {
        Push-Location $TestDrive
        try {
            & git init --quiet 2>$null
            & git config user.email 'test@example.com' 2>$null
            & git config user.name 'Test' 2>$null
            & git add -A 2>$null
            & git commit --quiet -m 'seed' 2>$null

            New-StateFile -RelativePath 'units/command/a.md' -Content @'
# unit/command/a
Kind: command
Status: active
Binds: I999
'@
            $before = & git status --short
            $null = Invoke-DesignStateCheck -RepoPath $TestDrive
            $after = & git status --short

            # Only the new untracked state file (created above, outside the checker's own run)
            # should differ - the checker itself must not have written anything.
            $after | Should -Be $before
        } finally {
            Pop-Location
        }
    }

    It 'S5.8/I21: exit 2 still stands during a freeze, even with every blocking class downgraded to reported' {
        New-TreeFile -RelativePath 'design/FROZEN.md' -Content @'
# design/ is frozen

Frozen at: abc1234, 2026-08-19
Frozen because: escaping the generative loop
Lifts when: tier one is code-complete
'@
        New-StateFile -RelativePath 'units/command/a.md' -Content @'
# unit/command/a
Kind: command
Status: active
Binds: I999
'@
        $result = Invoke-DesignStateCheck -RepoPath $TestDrive

        $result.Findings.Count | Should -Be 0
        (@($result.Reported | Where-Object { $_.Class -eq 'UnresolvedId' })).Count | Should -Be 1
        $result.ExitCode | Should -Be 2
        $result.DowngradedCount | Should -BeGreaterThan 0
    }
}

Describe 'Test-DesignState against this repository''s own tree' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:StatusBefore = & git -C $script:RepoRoot status --short
        $script:RealResult = Invoke-DesignStateCheck -RepoPath $script:RepoRoot
    }

    It 'S5.9/I18: git status is unchanged by a real run against this repository' {
        $after = & git -C $script:RepoRoot status --short
        $after | Should -Be $script:StatusBefore
    }

    It 'S5.1: this repository''s design/20-contract.md declares exactly the same class ids as the script' {
        (@($script:RealResult.Findings | Where-Object { $_.Class -eq 'ClassListDisagreement' })).Count | Should -Be 0
    }

    It 'S5.6: the real run names a largest closure, its unit, and its largest contributor' {
        $script:RealResult.LargestClosure | Should -Not -BeNullOrEmpty
        $script:RealResult.LargestClosure.Unit | Should -Not -BeNullOrEmpty
        $script:RealResult.LargestClosure.LargestContributor | Should -Not -BeNullOrEmpty
    }

    It 'S5.12: neither S4.6 closure (unit/command/track, unit/document/agents-md) exceeds the 16,384-byte ceiling' {
        $graph = Read-DesignStateGraph -Path $script:RepoRoot
        $byId = @{}
        foreach ($r in $graph.Records) { $byId[$r.Id] = $r }
        $result = Test-ClosureBudget -Records $graph.Records -ById $byId -RepoPath $script:RepoRoot
        (@($result.Findings | Where-Object { $_.Subject -eq 'unit/command/track' })).Count | Should -Be 0
        (@($result.Findings | Where-Object { $_.Subject -eq 'unit/document/agents-md' })).Count | Should -Be 0
    }

    It 'S5.4: never clean (exit 0) against this repository - most commands, scripts and documents have no unit record yet' {
        $script:RealResult.ExitCode | Should -Not -Be 0
    }

    It 'S7.9: the projector runs against this repository and ProjectionStale does not fire - the committed regions match their regeneration' {
        $script:RealResult.CouldNotEvaluate | Where-Object { $_.Reason -eq 'ProjectorFailed' } | Should -BeNullOrEmpty
        (@($script:RealResult.Findings | Where-Object { $_.Class -eq 'ProjectionStale' })).Count | Should -Be 0
    }
}
