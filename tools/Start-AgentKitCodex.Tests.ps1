#Requires -Version 7.0
#Requires -Modules Pester

BeforeAll {
    $script:StartPath = Join-Path $PSScriptRoot 'Start-AgentKitCodex.ps1'
    $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    $bootstrapArguments = Join-Path $TestDrive 'bootstrap-arguments.json'
    Set-Content -LiteralPath $bootstrapArguments -Value '[]' -NoNewline
    . $script:StartPath -Command help -ArgumentsFile $bootstrapArguments -WhatIf | Out-Null
}

Describe 'Start-AgentKitCodex JSON transport' {
    It 'forwards a JSON string array through the launcher WhatIf path without splitting arguments' {
        $arguments = @('contains spaces', 'quote " and apostrophe ''', "line one`nline two", '-WhatIf', '-List')
        $file = Join-Path $TestDrive 'arguments.json'
        $arguments | ConvertTo-Json -Compress | Set-Content -LiteralPath $file -NoNewline
        $expectedJson = ConvertTo-Json -InputObject $arguments -Compress

        $result = & $script:StartPath -Command help -ArgumentsFile $file -WhatIf

        $result | Should -Match 'AGENTKIT_COMMAND=/help'
        $result | Should -Match ([regex]::Escape($expectedJson))
    }

    It 'rejects a JSON scalar or an array with a non-string item' {
        $scalar = Join-Path $TestDrive 'scalar.json'
        $mixed = Join-Path $TestDrive 'mixed.json'
        Set-Content -LiteralPath $scalar -Value '"not an array"' -NoNewline
        Set-Content -LiteralPath $mixed -Value '["valid", 2]' -NoNewline

        { & $script:StartPath -Command help -ArgumentsFile $scalar -WhatIf } | Should -Throw '*JSON array of strings*'
        { & $script:StartPath -Command help -ArgumentsFile $mixed -WhatIf } | Should -Throw '*only strings*'
    }

    It 'preserves an empty argument array instead of introducing a null argument' {
        $file = Join-Path $TestDrive 'empty.json'
        Set-Content -LiteralPath $file -Value '[]' -NoNewline
        $result = & $script:StartPath -Command help -ArgumentsFile $file -WhatIf
        $result | Should -Match 'preserve each element exactly\):\s*\[\]'
    }

    It 'uses an encoded PowerShell child command for the visible Windows terminal' {
        $source = Get-Content -Raw -LiteralPath $script:StartPath
        $source | Should -Match "'-EncodedCommand'"
        $source | Should -Match "'-NoExit'"
        $source | Should -Match 'Start-Process -FilePath \$PowerShellExecutable'
        $source | Should -Match '& \$launcher -Command \$Command -WhatIf -SkillArguments \$routedArguments'
    }

    It 'encodes Windows dispatch data and preserves the project working directory' {
        $argumentsFile = Join-Path $TestDrive 'window-arguments.json'
        Set-Content -LiteralPath $argumentsFile -Value '["two words", "line one\\nline two"]' -NoNewline
        $injectedCommand = "help'; Start-Process calc; '"
        $script:Started = $null
        Mock Start-Process {
            param($FilePath, $WorkingDirectory, $ArgumentList)
            $script:Started = [pscustomobject]@{
                FilePath         = $FilePath
                WorkingDirectory = $WorkingDirectory
                ArgumentList     = $ArgumentList
            }
        }

        $executable = Join-Path $PSHOME $(if ($IsWindows) {'pwsh.exe'} else {'pwsh'})
        Start-AgentKitCodexWindow -Launcher (Join-Path $script:RepoRoot 'tools/Invoke-CodexCommand.ps1') -Command $injectedCommand -ArgumentsFile $argumentsFile -WorkingDirectory $TestDrive -PowerShellExecutable $executable

        $script:Started.FilePath | Should -Be $executable
        $script:Started.WorkingDirectory | Should -Be $TestDrive
        $script:Started.ArgumentList[0] | Should -Be '-NoExit'
        $script:Started.ArgumentList[1] | Should -Be '-EncodedCommand'
        $child = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($script:Started.ArgumentList[2]))
        $payloadMatch = [regex]::Match($child, "FromBase64String\('(?<payload>[^']+)'\)")
        $payloadMatch.Success | Should -BeTrue
        $payload = ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadMatch.Groups['payload'].Value)))
        $payload.Command | Should -Be $injectedCommand
        $payload.ArgumentsFile | Should -Be (Resolve-Path -LiteralPath $argumentsFile).Path
        $child | Should -Match '& \$payload\.Launcher -Command \$payload\.Command -SkillArguments @\(\$items\)'
        $child | Should -Not -Match ([regex]::Escape($injectedCommand))
    }

    It 'selects the visible Windows pwsh executable through the process mock' -Skip:(-not $IsWindows) {
        $argumentsFile = Join-Path $TestDrive 'windows-selection.json'
        Set-Content -LiteralPath $argumentsFile -Value '[]' -NoNewline
        $script:Started = $null
        Mock Start-Process {
            param($FilePath, $WorkingDirectory, $ArgumentList)
            $script:Started = [pscustomobject]@{ FilePath = $FilePath; WorkingDirectory = $WorkingDirectory; ArgumentList = $ArgumentList }
        }

        Start-AgentKitCodexWindow -Launcher (Join-Path $script:RepoRoot 'tools/Invoke-CodexCommand.ps1') -Command help -ArgumentsFile $argumentsFile -WorkingDirectory $TestDrive

        $script:Started.FilePath | Should -Be (Join-Path $PSHOME 'pwsh.exe')
        $script:Started.ArgumentList[0..1] | Should -Be @('-NoExit', '-EncodedCommand')
    }

    It 'has WhatIf routing parity for every shipped command' {
        $argumentsFile = Join-Path $TestDrive 'all-commands.json'
        Set-Content -LiteralPath $argumentsFile -Value '["argument"]' -NoNewline
        $commands = Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot 'skills') -Filter SKILL.md -File -Recurse -Depth 1 | ForEach-Object { $_.Directory.Name }

        foreach ($command in $commands) {
            $result = & $script:StartPath -Command $command -ArgumentsFile $argumentsFile -WhatIf
            if ($command -eq 'resume') {
                @($result | Where-Object { $_ -match 'AGENTKIT_COMMAND=/resume-(align|track)' }).Count | Should -Be 2
            }
            else {
                $result | Should -Match "AGENTKIT_COMMAND=/$command"
            }
        }
    }

    It 'rejects a real new-window launch outside Windows' -Skip:$IsWindows {
        $file = Join-Path $TestDrive 'arguments.json'
        Set-Content -LiteralPath $file -Value '[]' -NoNewline
        { & $script:StartPath -Command help -ArgumentsFile $file -NewWindow } | Should -Throw '*supported only on Windows*'
    }
}
