#Requires -Version 7.0

<#
  Fails when any commit in a range carries an AI-attribution line - the CI-side half of
  issue #340's enforcement: tools/git-hooks/commit-msg strips these locally, but a
  contributor without the hook installed still lands a commit CI must catch.
  AGENTS.shared.md "House conventions" states the rule this checks; it is not restated here.
  Pattern list kept in sync with tools/git-hooks/commit-msg's grep -E expression.
#>

param(
  [string]$BaseSha = $env:ATTRIBUTION_BASE_SHA,
  [string]$HeadSha = $env:ATTRIBUTION_HEAD_SHA
)

$script:AttributionPattern = '(?im)^(Co-authored-by:\s*(Claude|Anthropic|GPT|Codex|Copilot))|(Generated with \[?(Claude|Codex|Copilot))|(🤖 Generated with)'

function Get-CommitRangeShas {
  param([string]$BaseSha, [string]$HeadSha)

  if ([string]::IsNullOrWhiteSpace($HeadSha)) {
    throw 'Test-NoAttribution.ps1: -HeadSha (or $env:ATTRIBUTION_HEAD_SHA) is required.'
  }

  $allZeros = '0' * 40
  # First push of a branch, or a force-push GitHub reports with no prior SHA: there is no
  # base to diff against, so check only the head commit rather than the whole history.
  if ([string]::IsNullOrWhiteSpace($BaseSha) -or $BaseSha -eq $allZeros) {
    return @($HeadSha)
  }

  $shas = git log --format=%H "$BaseSha..$HeadSha"
  if ($LASTEXITCODE -ne 0) {
    throw "Test-NoAttribution.ps1: git log failed for range $BaseSha..$HeadSha"
  }
  return @($shas | Where-Object { $_ })
}

$commitShas = Get-CommitRangeShas -BaseSha $BaseSha -HeadSha $HeadSha
$offenders = @()

foreach ($sha in $commitShas) {
  $body = git log --format=%B -1 $sha
  if ($LASTEXITCODE -ne 0) {
    throw "Test-NoAttribution.ps1: git log failed for commit $sha"
  }
  $bodyText = $body -join "`n"
  if ($bodyText -match $script:AttributionPattern) {
    $offenders += [pscustomobject]@{ Sha = $sha; Line = $Matches[0] }
  }
}

if ($offenders.Count -gt 0) {
  Write-Host "RESULT=FAILED - $($offenders.Count) commit(s) carry AI attribution:"
  foreach ($offender in $offenders) {
    Write-Host "  $($offender.Sha.Substring(0, [Math]::Min(9, $offender.Sha.Length))) - $($offender.Line)"
  }
  exit 1
}

Write-Host "RESULT=PASSED - $($commitShas.Count) commit(s) checked, none carry AI attribution."
exit 0
