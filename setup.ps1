#Requires -Version 7.0
<#
.SYNOPSIS
    AgentKit's supported global installation front door. See README.md for the
    clone-and-run command that obtains this file on a fresh machine.
.DESCRIPTION
    All ongoing checkout, version, registration, ownership and uninstall behavior
    belongs to tools/Install-AgentKit.ps1. No current project is modified.
#>
[CmdletBinding()]
param(
    [string] $Version,
    [string] $Source,
    [ValidateSet('claude','codex','copilot')][string[]] $Hosts,
    [string] $Prefix,
    [switch] $DryRun,
    [switch] $Uninstall,
    [switch] $Force
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'AgentKit requires Git on PATH.' }
$installer = Join-Path $PSScriptRoot 'tools/Install-AgentKit.ps1'
if (-not (Test-Path -LiteralPath $installer)) { throw "Incomplete AgentKit checkout: '$installer' is missing. Clone the public repository; individual skill downloads are not an install." }
& $installer @PSBoundParameters
