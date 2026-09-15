#Requires -Version 7.0
<#
.SYNOPSIS
    Reports what a Claude Code session actually cost, from the transcript.

.DESCRIPTION
    Claude Code writes one JSONL transcript per session under
    ~/.claude/projects/<slug>/, with real per-call usage on every assistant
    record. This reads those files. It measures; it does not estimate, and it
    asks the model for nothing.

    Input is reported as four separate numbers because they are priced
    differently and behave differently. Collapsing them into one "tokens in"
    hides the only figure that usually matters: cache_read, which grows with
    conversation length and dominates every long session measured so far.

    No prices. Rates change, and a rate written from memory is exactly the
    fabricated number this script exists to replace. Multiply the columns by
    current published rates yourself.

    Calls and every token class are counted once per distinct message.id:
    Claude Code writes one JSONL record per content block of a single API
    response (thinking, text, tool_use each on its own line), and every one
    of those records repeats the same message.id and the same full
    message.usage. Summing per line, as this script did before, counts a
    single response's tokens once per content block it happened to produce.
    A record with no message.id - every existing test fixture, and any
    transcript shape that predates this field - is counted as its own call,
    since there is nothing to dedupe against.

    completionCalls, completionOutput, textChars, completionTextChars,
    toolResultChars and peakContext report only what the transcript states
    exactly. output_tokens is reported once per API response, so it cannot
    be split between thinking, visible text, and tool-call input - no such
    split exists in the record. The char counts are characters, not tokens,
    and are not a proxy for either. Nothing here classifies any output as
    waste.

    Claude Code only, and it says so rather than guessing. Every transcript is
    shape-checked before it is summed, and anything else is a hard error: a
    foreign transcript parsed for 'message.usage' yields zero, and a zero is
    indistinguishable from a session that cost nothing.

    The other two agents in this repository's routing table:

      Codex     Stores ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl and records
                usage as 'token_count' events under payload.info. Readable in
                principle, unimplemented here, and its counts are per turn
                rather than per call.
      Copilot   Stores globalStorage/github.copilot-chat/session-store.db, whose
                'turns' table has no usage column. Copilot meters premium
                requests, not tokens. Nothing to read, at any effort.

.PARAMETER Project
    Repository root to report on. Defaults to the current directory.

.PARAMETER TranscriptPath
    Read transcripts from this directory instead of deriving one from -Project.
    For an exported or relocated store, and for testing against a fixture.

.PARAMETER SessionId
    Report one session. Accepts a full id or a unique prefix. Default: all.

.PARAMETER Detail
    Break each session down by slash-command segment.

.PARAMETER Human
    Print the aligned text table instead of JSON. Default output is JSON so
    the report can be piped into other tools without a parser written against
    a table meant for a terminal; pass -Human for the table a person reads.

.PARAMETER Hook
    Run as a SessionEnd hook. Reads the hook's JSON from stdin, measures the
    session it names, and writes one row to .claude/session-costs.tsv beside
    this script's repository. Prints nothing by choice rather than by
    limitation: SessionEnd stdout is shown to the user on exit 0, but a total
    arriving as the session closes is a number nobody can act on. The log is
    the deliverable because it accumulates a trend.

    Idempotent. SessionEnd also fires on clear and resume, so a session can be
    reported more than once; an existing row for the same id is replaced rather
    than duplicated.

    The log is a convenience, not the record. Transcripts are durable, so a
    session killed before the hook fires is recovered by re-running this script
    without -Hook.

.PARAMETER Watch
    Run as a UserPromptSubmit hook. Reports the session's current context size
    once it crosses -WarnAtTokens, and stays silent below it.

    UserPromptSubmit is the event that fits: it fires before the turn is
    processed, so the warning arrives while the session can still be ended
    rather than after the expensive turn, and its stdout is injected as context
    so the model reads it too. It always exits 0. Exit 2 on this event blocks
    the prompt and erases what the user typed, which is never worth a cost
    warning.

    Silence below the threshold is the design, not an optimisation. An
    unconditional per-turn metrics block was rejected on 2026-08-04 for
    injecting noise on every turn while claiming to save tokens; a gated
    warning is a different proposal rather than that one again.

.PARAMETER WarnAtTokens
    Context size that triggers the advisory warning. Default 150000, measured:
    it is where sessions in this repository began climbing towards the 300-450K
    per call that the largest ones sustained. Twice this value reads as a
    firmer warning.

.PARAMETER IdleThresholdMinutes
    Gaps longer than this are treated as idle and excluded from active time.
    Default 5.

.EXAMPLE
    ./tools/Measure-Session.ps1

.EXAMPLE
    ./tools/Measure-Session.ps1 -Detail -SessionId 672430c6
#>
[CmdletBinding()]
param(
    [string]$Project = (Get-Location).Path,
    [string]$TranscriptPath,
    [string]$SessionId,
    [switch]$Detail,
    [switch]$Human,
    [switch]$Hook,
    [switch]$Watch,
    [int]$WarnAtTokens = 150000,
    [int]$IdleThresholdMinutes = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-TranscriptDirectory {
    <#
      Claude Code slugs the project path by replacing every character outside
      [A-Za-z0-9] with '-'. That is derived from observation, not documented,
      so the derived path is verified and a search is the fallback rather than
      the assumption.
    #>
    param([string]$ProjectPath)

    $root = Join-Path $HOME '.claude/projects'
    if (-not (Test-Path $root)) {
        throw "No transcript store at $root. Nothing to measure."
    }

    $full = (Resolve-Path $ProjectPath).Path.TrimEnd('\', '/')
    $slug = ($full -replace '[^A-Za-z0-9]', '-')
    $derived = Join-Path $root $slug
    if (Test-Path $derived) { return $derived }

    # Fall back to matching on the leaf name, and say so rather than guessing silently.
    $leaf = ($full | Split-Path -Leaf) -replace '[^A-Za-z0-9]', '-'
    $candidates = @(Get-ChildItem $root -Directory | Where-Object Name -like "*$leaf")
    if ($candidates.Count -eq 1) {
        Write-Warning "Derived path not found; matched '$($candidates[0].Name)' on leaf name."
        return $candidates[0].FullName
    }
    if ($candidates.Count -gt 1) {
        throw "Ambiguous: $($candidates.Count) transcript directories match '$leaf'. Pass -Project explicitly."
    }
    throw "No transcript directory for $full. Expected $derived."
}

function Get-TranscriptVendor {
    <#
      Which agent wrote this transcript, decided by record shape rather than by
      path. A path check would be wrong exactly where it matters most - an
      exported or relocated store - and -TranscriptPath exists to point at
      those.

      Two discriminators, both verified against every transcript on the machine
      this was written on (18 Claude, 4 Codex): no Claude record carries a
      top-level 'payload', and no Codex record carries a top-level
      'message.usage'.

      Returns 'claude' for a Claude-shaped file even when it holds no usage
      yet. An empty session is a legitimate thing to skip; another vendor's
      file is not, and the caller treats the two differently.
    #>
    param([System.IO.FileInfo]$File, [int]$MaxLines = 50)

    # Get-Content -TotalCount, not [System.IO.File]::ReadLines: this function
    # returns from inside the loop as soon as it is sure, and abandoning that
    # lazy enumerator leaves the file handle open until GC collects it. The
    # next write to the same path then fails with a sharing violation.
    $shape = 'unknown'
    foreach ($line in @(Get-Content -LiteralPath $File.FullName -TotalCount $MaxLines)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $record = $line | ConvertFrom-Json } catch { continue }
        $names = $record.PSObject.Properties.Name

        # Codex wraps everything in a 'payload' and opens with 'session_meta'.
        # Checked first: it is the definitive shape, and cheaper to be sure
        # about than the absence of one.
        if ($names -contains 'payload' -or ($names -contains 'type' -and $record.type -eq 'session_meta')) {
            return 'codex'
        }

        if ($names -contains 'message' -and $record.message) {
            if ($record.message.PSObject.Properties.Name -contains 'usage') { return 'claude' }
            $shape = 'claude'
        }
    }

    return $shape
}

function Assert-NotCopilotStore {
    <#
      Copilot is named explicitly rather than falling through to 'unrecognised'
      because the reason is different in kind and the user cannot act on it.
      Copilot Chat persists to SQLite (globalStorage/github.copilot-chat/
      session-store.db) whose 'turns' table is (id, session_id, turn_index,
      user_message, assistant_response, timestamp) - there is no usage column
      anywhere in the schema. It meters premium requests, not tokens, so there
      is nothing here to read and no reader that could be written.
    #>
    param([string]$Path)

    $copilot = @(
        (Test-Path (Join-Path $Path 'session-store.db')),
        ($Path -match 'github\.copilot-chat'),
        ((Split-Path $Path -Leaf) -in 'chatSessions', 'chatEditingSessions')
    )
    if ($copilot -contains $true) {
        throw "$Path is a GitHub Copilot store. Copilot records no token usage - its 'turns' table has no usage column, and it meters premium requests rather than tokens. There is nothing here to measure; see the VS Code quota indicator instead."
    }
}

function New-UsageSum {
    <#
      Shared shape for every accumulator in this script - a segment, a
      session total, a subagent total, or an all-sessions grand total - so
      Add-UsageSum can fold one into another without each call site
      re-listing the field names. PeakContext is not summed (see
      Add-UsageSum): it is initialised to 0 here anyway so an accumulator
      that never sees a call still reports a real number, not $null.
    #>
    [pscustomobject]@{
        Calls = 0; Input = 0L; CacheCreate = 0L; CacheRead = 0L; Output = 0L
        CompletionCalls = 0; CompletionOutput = 0L
        TextChars = 0L; CompletionTextChars = 0L; ToolResultChars = 0L
        PeakContext = 0L
    }
}

function Add-UsageSum {
    <#
      Folds a segment (or another accumulator - the shapes are identical)
      into $Sum. PeakContext is the one field this does not add: it is a
      property of a single call, not a quantity of work, so combining two
      ranges takes the larger peak rather than the total of both.
    #>
    param([object]$Sum, [object]$Segment)
    foreach ($field in 'Calls', 'Input', 'CacheCreate', 'CacheRead', 'Output',
                        'CompletionCalls', 'CompletionOutput',
                        'TextChars', 'CompletionTextChars', 'ToolResultChars') {
        $Sum.$field += $Segment.$field
    }
    if ($Segment.PeakContext -gt $Sum.PeakContext) { $Sum.PeakContext = $Segment.PeakContext }
}

function Get-ToolResultCharCount {
    <#
      A tool_result's own 'content' is either a plain string or an array of
      {type:text, text:...} blocks - both shapes are seen in real
      transcripts depending on the tool. Anything else (e.g. an image block)
      contributes nothing rather than throwing, since this is a character
      count, not a schema validator.
    #>
    param($Block)
    $content = if ($Block.PSObject.Properties.Name -contains 'content') { $Block.content } else { $null }
    if (-not $content) { return 0L }
    if ($content -is [string]) { return [long]$content.Length }

    $total = 0L
    foreach ($item in @($content)) {
        if ($item.PSObject.Properties.Name -contains 'text' -and $item.text) {
            $total += [long]$item.text.Length
        }
    }
    return $total
}

function Read-Session {
    param([System.IO.FileInfo]$File)

    $segments = [System.Collections.Generic.List[object]]::new()
    $current = $null
    $stamps = [System.Collections.Generic.List[datetime]]::new()
    $models = [System.Collections.Generic.HashSet[string]]::new()

    # Session-wide, not per-segment: a message.id names one API response, and
    # every content-block record for it carries the same id regardless of
    # which segment is active when each block's line is written.
    $seenMessageIds = [System.Collections.Generic.HashSet[string]]::new()

    function New-Segment { param([string]$Label)
        [pscustomobject]@{
            Label = $Label; Calls = 0
            Input = 0L; CacheCreate = 0L; CacheRead = 0L; Output = 0L
            CompletionCalls = 0; CompletionOutput = 0L
            TextChars = 0L; CompletionTextChars = 0L; ToolResultChars = 0L
            PeakContext = 0L
        }
    }

    $current = New-Segment '(no command)'
    $segments.Add($current)
    $pending = $null

    foreach ($line in [System.IO.File]::ReadLines($File.FullName)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $record = $line | ConvertFrom-Json } catch { continue }

        if ($record.PSObject.Properties.Name -contains 'timestamp' -and $record.timestamp) {
            $stamps.Add([datetime]$record.timestamp)
        }

        $message = if ($record.PSObject.Properties.Name -contains 'message') { $record.message } else { $null }
        if (-not $message) { continue }

        # A slash command arrives as a plain-string user record. It is held
        # pending rather than opening a segment immediately: commands like
        # /model and /config run in the CLI and cost nothing, and attributing
        # the following conversation to them is a metric that lies. A pending
        # command is cancelled by local-command output and committed by the
        # first call that actually costs something.
        if ($message.PSObject.Properties.Name -contains 'content' -and $message.content -is [string]) {
            if ($message.content -match '<command-name>([^<]+)</command-name>') {
                $pending = $Matches[1].Trim()
            }
            elseif ($message.content -match '<local-command-(stdout|caveat)>') {
                $pending = $null
            }
            continue
        }

        # A tool_result carries no usage and never opens a pending segment -
        # it is attributed to whatever segment is already active, same as any
        # other line that arrives between commands.
        $blocks = if ($message.PSObject.Properties.Name -contains 'content' -and $message.content) { @($message.content) } else { @() }
        foreach ($block in $blocks) {
            if ($block.PSObject.Properties.Name -contains 'type' -and $block.type -eq 'tool_result') {
                $current.ToolResultChars += Get-ToolResultCharCount -Block $block
            }
        }

        $usage = if ($message.PSObject.Properties.Name -contains 'usage') { $message.usage } else { $null }
        if (-not $usage) { continue }

        # A segment runs from here until the next command, so it includes every
        # follow-up turn, approval and correction. It is not the isolated cost
        # of the command.
        if ($pending) {
            $current = New-Segment $pending
            $segments.Add($current)
            $pending = $null
        }

        if ($message.PSObject.Properties.Name -contains 'model' -and $message.model) {
            [void]$models.Add($message.model)
        }

        $stopReason = if ($message.PSObject.Properties.Name -contains 'stop_reason') { $message.stop_reason } else { $null }

        # Every content-block record of one API response repeats the same
        # message.id (see the .DESCRIPTION note on Read-Session's whole
        # reason for existing), so text is the one metric counted per block
        # rather than per id: each block is its own line and, checked against
        # real transcripts, never more than one text block per record.
        foreach ($block in $blocks) {
            if ($block.PSObject.Properties.Name -contains 'type' -and $block.type -eq 'text' -and
                $block.PSObject.Properties.Name -contains 'text' -and $block.text) {
                $chars = [long]$block.text.Length
                $current.TextChars += $chars
                if ($stopReason -eq 'end_turn') { $current.CompletionTextChars += $chars }
            }
        }

        # message.id is what distinguishes a genuinely new call from another
        # content block of the one already seen; a record with no id (every
        # existing fixture, and any shape that predates this field) has
        # nothing to dedupe against and is counted as its own call.
        $messageId = if ($message.PSObject.Properties.Name -contains 'id' -and $message.id) { [string]$message.id } else { $null }
        $isNewCall = if ($messageId) { $seenMessageIds.Add($messageId) } else { $true }
        if (-not $isNewCall) { continue }

        $current.Calls++
        foreach ($pair in @(
            @('input_tokens', 'Input'),
            @('cache_creation_input_tokens', 'CacheCreate'),
            @('cache_read_input_tokens', 'CacheRead'),
            @('output_tokens', 'Output'))) {
            if ($usage.PSObject.Properties.Name -contains $pair[0]) {
                $current.($pair[1]) += [long]$usage.($pair[0])
            }
        }

        # Context paid by this one call - a max across calls, not a running
        # total, because it describes the size of the largest single request
        # rather than an accumulating cost.
        $callContext = 0L
        foreach ($field in 'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens') {
            if ($usage.PSObject.Properties.Name -contains $field) { $callContext += [long]$usage.$field }
        }
        if ($callContext -gt $current.PeakContext) { $current.PeakContext = $callContext }

        if ($stopReason -eq 'end_turn') {
            $current.CompletionCalls++
            if ($usage.PSObject.Properties.Name -contains 'output_tokens') {
                $current.CompletionOutput += [long]$usage.output_tokens
            }
        }
    }

    $ordered = @($stamps | Sort-Object)
    $span = if ($ordered.Count -ge 2) { $ordered[-1] - $ordered[0] } else { [timespan]::Zero }

    $active = [timespan]::Zero
    $limit = [timespan]::FromMinutes($IdleThresholdMinutes)
    for ($i = 1; $i -lt $ordered.Count; $i++) {
        $gap = $ordered[$i] - $ordered[$i - 1]
        if ($gap -le $limit) { $active += $gap }
    }

    [pscustomobject]@{
        Id       = $File.BaseName
        Started  = if ($ordered.Count) { $ordered[0] } else { $null }
        Span     = $span
        Active   = $active
        Models   = ($models | Sort-Object) -join ', '
        Segments = @($segments | Where-Object Calls -gt 0)
    }
}

function Get-SubagentUsage {
    <#
      Subagent transcripts live at <sessionId>/subagents/*.jsonl beside the
      parent session's own <sessionId>.jsonl - a directory Get-ChildItem's
      top-level *.jsonl listing never descends into. They are Claude-shaped
      (same message.usage records, isSidechain:true) so Read-Session parses
      them unchanged; only the discovery and the accounting are new.

      Returned as its own total rather than merged into the parent's: a
      subagent's tokens are a real cost, but not the parent session's
      context, and the two are priced and read differently.
    #>
    param([string]$Directory, [string]$SessionId)

    $sum = New-UsageSum
    $subDirectory = Join-Path $Directory $SessionId 'subagents'
    if (-not (Test-Path $subDirectory)) { return $sum }

    foreach ($file in (Get-ChildItem $subDirectory -Filter *.jsonl -File -ErrorAction SilentlyContinue)) {
        if ((Get-TranscriptVendor -File $file) -ne 'claude') { continue }
        $session = Read-Session -File $file
        foreach ($segment in $session.Segments) {
            Add-UsageSum -Sum $sum -Segment $segment
        }
    }
    return $sum
}

function Format-Row {
    param([string]$Label, [object]$S)
    '{0,-28} {1,6} {2,10:N0} {3,12:N0} {4,13:N0} {5,10:N0}' -f
        $Label, $S.Calls, $S.Input, $S.CacheCreate, $S.CacheRead, $S.Output
}

function Get-CostLogPath {
    <#
      The log lives beside the repository being measured, not beside
      whichever checkout happened to run this hook. Under home-install
      (AGENTS.shared.md's Home-install convention), $PSScriptRoot is the kit's own
      install root - the same for every project - so it cannot be the
      resolution root here the way it was when this script was copied into
      each repo. $env:CLAUDE_PROJECT_DIR is the project Claude Code set up
      the hook for and is set in the hook's own process environment (Claude
      Code hooks reference); it takes priority when present. Falling back to
      the parent of $ScriptRoot keeps direct/manual invocation (no hook, no
      CLAUDE_PROJECT_DIR) working from the script's own location, as before.

      In a git worktree, resolving the log beside that resolution root
      directly (rather than via git-common-dir) would land it beside the
      worktree's own directory rather than the main checkout - so a session
      run there wrote its row to <worktree>/.claude/session-costs.tsv,
      invisible to anyone looking at the main checkout's log, and lost
      outright once the worktree is deleted (this repository's own /clean
      does exactly that after a merge). 'git rev-parse --git-common-dir'
      resolves to the same shared .git directory regardless of which
      worktree asks, so its parent is the one stable place every checkout of
      that repository agrees on. Falls back to the resolution root itself
      when it is not a git repo, or git is unavailable - the common case in
      tests, and a graceful default rather than a hard requirement on git
      being installed.
    #>
    param([string]$ScriptRoot)

    # $ScriptRoot is always the tools/ folder beside the script; normalize to
    # a repo-root candidate before comparing it with $env:CLAUDE_PROJECT_DIR,
    # which is already a repo root.
    $root = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { Split-Path $ScriptRoot -Parent }
    $fallback = Join-Path $root '.claude/session-costs.tsv'
    try {
        $commonDir = git -C $root rev-parse --path-format=absolute --git-common-dir 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $commonDir) { return $fallback }
        return Join-Path (Split-Path $commonDir -Parent) '.claude/session-costs.tsv'
    }
    catch { return $fallback }
}

if ($Hook) {
    # SessionEnd delivers its JSON on stdin. Failing loudly here would put an
    # error in front of the user at the moment they are closing the session, so
    # this reports a problem and gets out of the way.
    try {
        $payload = ([Console]::In.ReadToEnd() | ConvertFrom-Json)
        $file = Get-Item -LiteralPath $payload.transcript_path

        # SessionEnd only fires under Claude Code, so this should be
        # unreachable. It is checked anyway: the alternative to erroring is a
        # row of zeros in the log, and the log's whole value is that its
        # numbers were measured.
        $vendor = Get-TranscriptVendor -File $file
        if ($vendor -ne 'claude') { throw "$($file.Name) is not a Claude Code transcript (detected: $vendor)." }

        $session = Read-Session -File $file

        # Column set unchanged deliberately: 'calls' here already reflects the
        # dedupe fix because Read-Session does the deduping, not this loop, and
        # the new exact metrics have no place in a TSV meant to trend cost
        # over time rather than restate the JSON report.
        $sum = New-UsageSum
        foreach ($segment in $session.Segments) {
            Add-UsageSum -Sum $sum -Segment $segment
        }
        if (-not $sum.Calls) { exit 0 }

        $log = Get-CostLogPath -ScriptRoot $PSScriptRoot
        $columns = 'started', 'session', 'models', 'calls', 'span', 'active',
                   'input', 'cache_create', 'cache_read', 'output'
        $row = @(
            ('{0:yyyy-MM-ddTHH:mm:ss}' -f $session.Started)
            $session.Id
            $session.Models
            $sum.Calls
            ('{0:hh\:mm\:ss}' -f $session.Span)
            ('{0:hh\:mm\:ss}' -f $session.Active)
            $sum.Input, $sum.CacheCreate, $sum.CacheRead, $sum.Output
        ) -join "`t"

        # Rewrite rather than append: SessionEnd fires on clear and resume too,
        # so the same session can arrive twice and the later reading supersedes.
        # Assigned in two steps deliberately: an if/else returning @() unrolls to
        # $null, which is a null-reference bug waiting under Set-StrictMode.
        $existing = @()
        if (Test-Path $log) {
            $existing = @(Get-Content -LiteralPath $log | Where-Object { $_ -and ($_ -split "`t")[1] -ne $session.Id })
        }
        if (-not $existing.Count) { $existing = @($columns -join "`t") }

        $logDirectory = Split-Path $log -Parent
        if (-not (Test-Path $logDirectory)) { New-Item -ItemType Directory -Path $logDirectory | Out-Null }
        Set-Content -LiteralPath $log -Value (@($existing) + $row) -Encoding utf8NoBOM
        exit 0
    }
    catch {
        [Console]::Error.WriteLine("Measure-Session (line $($_.InvocationInfo.ScriptLineNumber)): $($_.Exception.Message)")
        exit 1
    }
}

if ($Watch) {
    # This runs on every prompt, so it never disturbs the session: every failure
    # path exits 0 in silence. A cost warning that breaks a turn costs more than
    # the tokens it saves, and exit 2 here would erase the user's prompt.
    try {
        $payload = ([Console]::In.ReadToEnd() | ConvertFrom-Json)
        $path = if ($payload.PSObject.Properties.Name -contains 'transcript_path') { $payload.transcript_path } else { $null }
        if (-not $path -or -not (Test-Path -LiteralPath $path)) { exit 0 }

        # Only the newest usage record matters: its three input classes sum to
        # the context every later call will pay again. Parsing every line is
        # what the report does and it is too slow to repeat per prompt, so lines
        # are filtered as text and parsed at the end. Several are kept rather
        # than one because '"usage"' can appear inside tool output, and a false
        # positive must not shadow the real record.
        $recent = [System.Collections.Generic.Queue[string]]::new()
        foreach ($line in [System.IO.File]::ReadLines($path)) {
            if (-not $line.Contains('"usage"')) { continue }
            $recent.Enqueue($line)
            while ($recent.Count -gt 8) { [void]$recent.Dequeue() }
        }
        if (-not $recent.Count) { exit 0 }

        $context = 0L
        $candidates = $recent.ToArray()
        for ($i = $candidates.Count - 1; $i -ge 0; $i--) {
            try { $record = $candidates[$i] | ConvertFrom-Json } catch { continue }
            if ($record.PSObject.Properties.Name -notcontains 'message') { continue }
            $message = $record.message
            if (-not $message -or $message.PSObject.Properties.Name -notcontains 'usage') { continue }
            $usage = $message.usage
            if (-not $usage) { continue }

            foreach ($field in 'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens') {
                if ($usage.PSObject.Properties.Name -contains $field) { $context += [long]$usage.$field }
            }
            break
        }

        if ($context -lt $WarnAtTokens) { exit 0 }

        # Emitted on every turn above the threshold rather than once on crossing.
        # The number growing is itself the signal, a one-shot warning is read
        # once and forgotten, and the alternative is a state file whose failure
        # modes cost more than the repetition does.
        #
        # "Consider finishing up" measured at 0% effect over a full week (issue
        # #184): 70 of 324 sessions crossed this threshold and none ended early
        # because of it. The action is now a directive, not a suggestion, and it
        # escalates with severity instead of repeating the same wording louder.
        $severity = if ($context -ge ($WarnAtTokens * 2L)) { 'well past' } else { 'past' }
        $action = if ($severity -eq 'well past') {
            'Stop here: finish only what is already in flight and move anything further to a fresh session.'
        } else {
            'Finish this step, then end the session - do not start the next step here.'
        }
        '[session-watch] Context is {0:N0} tokens and every further turn pays it again ({1} the {2:N0} threshold). AGENTS.shared.md treats the artifact you are about to produce as the handoff point: {3}' -f $context, $severity, $WarnAtTokens, $action
        exit 0
    }
    catch { exit 0 }
}

$directory = if ($TranscriptPath) {
    if (-not (Test-Path $TranscriptPath)) { throw "No such transcript directory: $TranscriptPath" }
    (Resolve-Path $TranscriptPath).Path
}
else { Resolve-TranscriptDirectory -ProjectPath $Project }

# Checked before the *.jsonl listing: a Copilot store holds no .jsonl at all,
# so the generic "no transcripts matched" would name the wrong problem.
Assert-NotCopilotStore -Path $directory

$files = @(Get-ChildItem $directory -Filter *.jsonl -File)
if ($SessionId) { $files = @($files | Where-Object BaseName -like "$SessionId*") }
if (-not $files.Count) { throw "No transcripts matched in $directory." }

$totals = New-UsageSum
$subagentTotals = New-UsageSum
$reportSessions = [System.Collections.Generic.List[object]]::new()

foreach ($file in ($files | Sort-Object LastWriteTime)) {
    # A foreign transcript is a hard stop, not a skip. Parsing one for
    # 'message.usage' finds nothing and sums to zero, and a zero here is
    # indistinguishable from a session that genuinely cost nothing - which is
    # the fabricated measurement this script exists to replace.
    $vendor = Get-TranscriptVendor -File $file
    if ($vendor -ne 'claude') {
        # Not $detail: PowerShell variable names are case-insensitive, so that
        # would assign to the -Detail switch parameter and fail on the cast.
        $reason = if ($vendor -eq 'codex') {
            "Codex records usage as 'token_count' events under payload.info, not as 'message.usage'. No Codex reader is implemented, and its per-turn counts are not the same unit as Claude's per-call ones."
        }
        else {
            'No known agent writes this shape.'
        }
        throw "$($file.Name) is not a Claude Code transcript (detected: $vendor). $reason"
    }

    $session = Read-Session -File $file
    if (-not $session.Segments.Count) { continue }

    $sum = New-UsageSum
    foreach ($segment in $session.Segments) {
        Add-UsageSum -Sum $sum -Segment $segment
        Add-UsageSum -Sum $totals -Segment $segment
    }

    $subagentSum = Get-SubagentUsage -Directory $directory -SessionId $session.Id
    Add-UsageSum -Sum $subagentTotals -Segment $subagentSum

    $shortId = if ($session.Id.Length -gt 8) { $session.Id.Substring(0, 8) } else { $session.Id }
    $reportSessions.Add([pscustomobject]@{
        Id      = $shortId
        Started = $session.Started
        Span    = $session.Span
        Active  = $session.Active
        Models  = $session.Models
        Total   = $sum
        Subagents = $subagentSum
        Segments = $session.Segments
    })
}

# Every file was Claude-shaped and every one was empty. Skipping a single
# empty session is right; reporting a table of zeros for all of them is not.
if (-not $reportSessions.Count) {
    throw "Matched $($files.Count) Claude transcript(s) in $directory, none of which recorded any usage. Refusing to report zero, which would read as a session that cost nothing."
}

if ($Human) {
    $header = '{0,-28} {1,6} {2,10} {3,12} {4,13} {5,10}' -f 'Segment', 'calls', 'input', 'cache_new', 'cache_read', 'output'

    foreach ($session in $reportSessions) {
        ''
        "Session {0}   {1}" -f $session.Id, $session.Models
        "  started {0:yyyy-MM-dd HH:mm}   span {1:hh\:mm\:ss}   active {2:hh\:mm\:ss} (gaps over {3} min excluded)" -f
            $session.Started, $session.Span, $session.Active, $IdleThresholdMinutes
        ''
        $header
        ('-' * $header.Length)
        if ($Detail) {
            foreach ($segment in $session.Segments) { Format-Row -Label $segment.Label -S $segment }
            ('-' * $header.Length)
        }
        Format-Row -Label 'session total' -S $session.Total
        # A second line rather than more columns: these are exact counts of
        # different things (a call outcome, a character count, a single
        # call's peak) and folding them into the calls/input/.../output row
        # would imply they are priced the same way. Wording and field order
        # match .DESCRIPTION's list of what a transcript states exactly.
        '  completions {0:N0} ({1:N0} output) · text {2:N0} chars ({3:N0} in completions) · tool results {4:N0} chars · peak context {5:N0}' -f
            $session.Total.CompletionCalls, $session.Total.CompletionOutput,
            $session.Total.TextChars, $session.Total.CompletionTextChars,
            $session.Total.ToolResultChars, $session.Total.PeakContext
        if ($session.Subagents.Calls) {
            Format-Row -Label 'subagents (separate cost)' -S $session.Subagents
        }
    }

    if ($files.Count -gt 1) {
        ''
        ('=' * $header.Length)
        Format-Row -Label "all sessions ($($files.Count))" -S $totals
        if ($subagentTotals.Calls) {
            Format-Row -Label 'all subagents (separate cost)' -S $subagentTotals
        }
    }

    ''
    'cache_read is the term that grows with conversation length. If it dominates,'
    'the lever is session boundaries, not per-command waste.'
    ''
}
else {
    function ConvertTo-UsageObject { param($S)
        [ordered]@{
            calls       = $S.Calls
            input       = $S.Input
            cacheCreate = $S.CacheCreate
            cacheRead   = $S.CacheRead
            output      = $S.Output
            completionCalls      = $S.CompletionCalls
            completionOutput     = $S.CompletionOutput
            textChars            = $S.TextChars
            completionTextChars  = $S.CompletionTextChars
            toolResultChars      = $S.ToolResultChars
            peakContext          = $S.PeakContext
        }
    }

    $payload = [ordered]@{
        idleThresholdMinutes = $IdleThresholdMinutes
        sessions = @($reportSessions | ForEach-Object {
            $entry = [ordered]@{
                id      = $_.Id
                started = if ($_.Started) { ('{0:yyyy-MM-ddTHH:mm:ss}' -f $_.Started) } else { $null }
                spanSeconds   = [math]::Round($_.Span.TotalSeconds)
                activeSeconds = [math]::Round($_.Active.TotalSeconds)
                models  = @($_.Models -split ',\s*' | Where-Object { $_ })
                total   = ConvertTo-UsageObject $_.Total
                subagents = ConvertTo-UsageObject $_.Subagents
            }
            if ($Detail) {
                $entry.segments = @($_.Segments | ForEach-Object {
                    $seg = ConvertTo-UsageObject $_
                    $seg.Insert(0, 'label', $_.Label)
                    $seg
                })
            }
            $entry
        })
    }
    if ($files.Count -gt 1) {
        $payload.allSessions = ConvertTo-UsageObject $totals
        $payload.allSubagents = ConvertTo-UsageObject $subagentTotals
    }

    $payload | ConvertTo-Json -Depth 6
}
