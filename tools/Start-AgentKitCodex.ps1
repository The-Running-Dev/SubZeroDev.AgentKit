#Requires -Version 7.0
<#+
.SYNOPSIS
    Starts a routed AgentKit Codex command from JSON arguments.

.DESCRIPTION
    Reads a JSON array of strings and calls Invoke-CodexCommand.ps1. In foreground mode it works
    on every platform. -NewWindow starts a visible Windows PowerShell terminal using an encoded
    command, so spaces, quotes, and multiline values never pass through a shell command string.

.PARAMETER Command
    AgentKit command name, with or without its leading slash.

.PARAMETER ArgumentsFile
    Path to a UTF-8 JSON array of strings. Each array item is one user argument.

.PARAMETER NewWindow
    Start the routed command in a separate visible Windows pwsh terminal.

.PARAMETER WhatIf
    Resolve the underlying Codex command without launching it or opening a new terminal.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $Command,

    [Parameter(Mandatory)]
    [string] $ArgumentsFile,

    [switch] $NewWindow,

    [switch] $WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-AgentKitArgumentsFile {
    param([Parameter(Mandatory)][string] $Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Arguments file '$Path' does not exist or is not a file."
    }

    try {
        $value = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $Path -Raw) -NoEnumerate
    }
    catch {
        throw "Arguments file '$Path' is not valid JSON: $($_.Exception.Message)"
    }

    if ($value -is [string] -or $value -isnot [System.Collections.IEnumerable]) {
        throw "Arguments file '$Path' must contain a JSON array of strings."
    }

    $arguments = [System.Collections.Generic.List[string]]::new()
    foreach ($item in $value) {
        if ($item -isnot [string]) {
            throw "Arguments file '$Path' must contain only strings."
        }
        $arguments.Add($item)
    }
    return $arguments.ToArray()
}

function Start-AgentKitCodexWindow {
    <#
        Starts the routed command in a separate console. The encoded PowerShell command contains
        only a base64 JSON payload (launcher path, command name, and arguments-file path); user
        argument values remain in the JSON file until the child binds them to -SkillArguments.
    #>
    param(
        [Parameter(Mandatory)][string] $Launcher,
        [Parameter(Mandatory)][string] $Command,
        [Parameter(Mandatory)][string] $ArgumentsFile,
        [string] $WorkingDirectory = (Get-Location).Path,
        [string] $PowerShellExecutable = (Join-Path $PSHOME 'pwsh.exe')
    )

    if (-not (Test-Path -LiteralPath $PowerShellExecutable -PathType Leaf)) {
        throw "Windows PowerShell executable not found at '$PowerShellExecutable'."
    }

    $payload = [ordered]@{
        Launcher      = $Launcher
        Command       = $Command
        ArgumentsFile = (Resolve-Path -LiteralPath $ArgumentsFile).Path
    } | ConvertTo-Json -Compress
    $payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
    $child = @'
$payload = ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')))
$items = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $payload.ArgumentsFile -Raw) -NoEnumerate
if ($items -is [string] -or $items -isnot [System.Collections.IEnumerable] -or @($items | Where-Object { $_ -isnot [string] }).Count -ne 0) {
    throw "Arguments file '$($payload.ArgumentsFile)' must contain a JSON array of strings."
}
& $payload.Launcher -Command $payload.Command -SkillArguments @($items)
'@.Replace('__PAYLOAD__', $payloadBase64)
    $encodedChild = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($child))

    Start-Process -FilePath $PowerShellExecutable -WorkingDirectory $WorkingDirectory -ArgumentList @('-NoExit', '-EncodedCommand', $encodedChild) | Out-Null
}

$launcher = Join-Path $PSScriptRoot 'Invoke-CodexCommand.ps1'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "Codex launcher not found at '$launcher'."
}

$routedArguments = @(Read-AgentKitArgumentsFile -Path $ArgumentsFile)

if ($WhatIf) {
    & $launcher -Command $Command -WhatIf -SkillArguments $routedArguments
    if ($NewWindow) {
        Write-Output 'Would start the resolved command in a visible Windows pwsh terminal.'
    }
    return
}

if (-not $NewWindow) {
    & $launcher -Command $Command -SkillArguments $routedArguments
    exit $LASTEXITCODE
}

if (-not $IsWindows) {
    throw '-NewWindow is supported only on Windows. Omit -NewWindow to run the routed command in this terminal.'
}

Start-AgentKitCodexWindow -Launcher $launcher -Command $Command -ArgumentsFile $ArgumentsFile -WorkingDirectory (Get-Location).Path
