function Test-Target($Paths,[switch]$ConfigurationOnly,[switch]$FilesystemFixture) {
    $script:Checks=@()
    function Check([string]$Name,[scriptblock]$Test) {
        try { $pass=& $Test; if(!$pass){throw 'Expected state not found'}; $script:Checks+=,@{name=$Name;status='PASS';reason='Verified'}; Say "[PASS] $Name" }
        catch { $script:Checks+=,@{name=$Name;status='FAIL';reason=$_.Exception.Message}; Say "[FAIL] $Name : $($_.Exception.Message)" }
    }
    Check 'IDE build and workbench compatibility' { Assert-Workbench $Paths; return $true }
    Check 'Settings semantic SOURCE/TARGET comparison' { Contains-Profile (Read-Json (Join-Path $Paths.user 'settings.json')) (Expected-Settings $Paths) }
    Check 'Keybindings, including duplicate prevention' {
        $keys=@(Read-Json (Join-Path $Paths.user 'keybindings.json'))
        foreach($source in @(Read-Json (Join-Path $script:Root 'payload\keybindings\keybindings.json'))){if(@($keys | Where-Object {Contains-Profile $_ $source}).Count -ne 1){throw "Missing/duplicate binding: $($source.command)"}}
        return $true
    }
    foreach($rel in (Read-Json (Join-Path $script:Root 'manifests\gemini-files-manifest.json')).files){
        Check "Gemini file $rel" { (Hash (Join-Path $Paths.gemini $rel)) -eq (Hash (Join-Path $script:Root ('payload\gemini\'+$rel))) }
    }
    $manifest=Read-Json (Join-Path $script:Root 'manifests\extensions-manifest.json')
    Check 'Extension registry IDs, versions and uniqueness' {
        $registry=@(Read-Json (Join-Path $Paths.extensions 'extensions.json'))
        foreach($e in $manifest){
            $matched=@($registry | Where-Object {$_.identifier.id.ToLowerInvariant() -eq $e.id.ToLowerInvariant()})
            if($matched.Count -ne 1 -or $matched[0].version -ne $e.version){throw "Registry mismatch: $($e.id)"}
            $pkg=Read-Json (Resolve-Under $Paths.extensions ($matched[0].relativeLocation+'\package.json'))
            if(($pkg.publisher+'.'+$pkg.name).ToLowerInvariant() -ne $e.id.ToLowerInvariant() -or $pkg.version -ne $e.version){throw "Extension package mismatch: $($e.id)"}
        }
        return $true
    }
    foreach($e in @($manifest | Where-Object kind -eq custom)){
        Check "Custom runtime integrity: $($e.id)" {
            $source=Resolve-Under $script:Root $e.payload; $target=Resolve-Under $Paths.extensions $e.folder
            foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){$rel=$file.FullName.Substring($source.Length).TrimStart('\');if((Hash $file.FullName) -ne (Hash (Resolve-Under $target $rel))){throw "Runtime mismatch: $rel"}}
            return $true
        }
    }
    Check 'All public extension runtime files match official artifacts' {
        & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') verify-public (Split-Path -Parent $Paths.extensions) $Paths.extensions (Join-Path $script:Root 'manifests\public-files-manifest.json')
        return $LASTEXITCODE -eq 0
    }
    Check 'TypeScript-only autocomplete and exact delays' {
        $entry=$manifest | Where-Object id -eq 'mansur.mansur-inline-autocomplete'; $folder=Resolve-Under $Paths.extensions $entry.folder
        $pkg=Read-Json (Join-Path $folder 'package.json'); $code=[IO.File]::ReadAllText((Join-Path $folder 'extension.js'))
        if(@($pkg.activationEvents | Where-Object {$_ -match '^onLanguage:javascript'}).Count){throw 'JavaScript activation found'}
        return ($code -match "language: 'typescript'" -and $code -match "language: 'typescriptreact'" -and $code -notmatch "language: 'javascript(react)?'" -and $code -match 'TAILWIND_DELAY_MS = 5000' -and $code -match 'CRUD_DELAY_MS = 15000')
    }
    Check 'Jelly effect exact bytes and exactly one injection' {
        $html=[IO.File]::ReadAllText($Paths.workbench)
        return ([regex]::Matches($html,'MANSUR_JELLY_CURSOR_PATCH').Count -eq 1 -and [regex]::Matches($html,'<script[^>]*src=["'']\./jelly-cursor\.js["'']').Count -eq 1 -and (Hash (Join-Path (Split-Path -Parent $Paths.workbench) 'jelly-cursor.js')) -eq (Hash (Join-Path $script:Root 'payload\effects\jelly-cursor.js')))
    }
    Check 'Portable repair integrity and deployment paths' {
        $deploy=Read-Json (Join-Path $Paths.repair 'deployment.json')
        return $deploy.ideRoot -eq $Paths.install -and $deploy.userData -eq $Paths.data -and (Hash (Join-Path $Paths.repair 'checkAndRepairJellyCursor.js')) -eq (Hash (Join-Path $script:Root 'payload\scripts\checkAndRepairJellyCursor.js'))
    }
    Check 'Git Bash dependency' { Test-Path -LiteralPath $script:GitBash -PathType Leaf }
    Check 'Node dependency' { if(!$script:Node){throw 'Node not found'}; $v=& $script:Node --version; return $LASTEXITCODE -eq 0 -and $v -match '^v(2[4-9]|[3-9][0-9])\.' }
    Check 'Enabled/disabled extension state' {
        & $script:Node (Join-Path $PSScriptRoot 'extension-state.cjs') (Join-Path $Paths.user 'globalStorage\state.vscdb') (Join-Path $script:Root 'manifests\source-manifest.json') (Join-Path $script:Root 'manifests\extensions-manifest.json') verify
        return $LASTEXITCODE -eq 0
    }
    Check 'Runtime browser available' { $script:Browser=Find-Browser;return [bool]$script:Browser }
    Check 'Source panel positions, pinned views, hidden views and sizes' {
        & $script:Node (Join-Path $PSScriptRoot 'ui-state.cjs') (Join-Path $Paths.user 'globalStorage\state.vscdb') (Join-Path $script:Root 'payload\settings\ui-state.json') verify
        return $LASTEXITCODE -eq 0
    }
    Check 'Credential-free MCP configuration and exact offline runtime' {
        $config=Read-Json (Join-Path $Paths.gemini 'config\mcp_config.json')
        if(!(Contains-Profile $config.mcpServers (Expected-McpServers))){throw 'MCP configuration does not match portable server paths.'}
        $runtime=Get-McpRuntime
        & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') verify-files (Split-Path -Parent $runtime) $runtime (Join-Path $script:Root 'manifests\mcp-runtime-manifest.json')
        return $LASTEXITCODE -eq 0
    }
    Check 'Both local MCP servers actually initialized and executed a tool' {
        $report=Read-Json (Join-Path $Paths.repair 'mcp-verification.json')
        return @($report.checks).Count -eq 2 -and @($report.checks | Where-Object status -ne PASS).Count -eq 0
    }
    foreach($font in @(Read-Json (Join-Path $script:Root 'manifests\fonts-manifest.json'))){
        Check "Font $($font.file)" { (Hash (Join-Path $Paths.fonts $font.file)) -eq $font.sha256 }
    }
    if(!$FilesystemFixture){
        Check 'Per-user font registration' {
            $registration=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
            foreach($font in @(Read-Json (Join-Path $script:Root 'manifests\fonts-manifest.json'))){
                if($registration.($font.registryName) -ne (Join-Path $Paths.fonts $font.file)){throw "Font not registered: $($font.file)"}
            }
            return $true
        }
    }
    if(!$ConfigurationOnly){
        Check 'Live extension-host activation, TypeScript/TSX and command registration' {
            $report=Read-Json (Join-Path $Paths.repair 'functional-verification.json')
            return @($report.checks | Where-Object status -ne PASS).Count -eq 0 -and @($report.checks).Count -ge 22 -and $report.settingsHash -eq (Hash (Join-Path $Paths.user 'settings.json')) -and $report.workbenchHash -eq (Hash $Paths.workbench)
        }
        foreach($required in @('Live renderer Ripple creates, animates and removes its SVG circle','Live renderer source dark theme, font size and icon stylesheet','Live Runtime Monitor coordinator connects to local fixture','Live Runtime Monitor console and completed network response','Live Runtime Monitor refresh, one session and no duplicate events','Live Runtime Monitor clear and disconnect')){
            Check $required {
                $report=Read-Json (Join-Path $Paths.repair 'functional-verification.json')
                return @($report.checks | Where-Object { $_.name -eq $required -and $_.status -eq 'PASS' }).Count -eq 1 -and $report.settingsHash -eq (Hash (Join-Path $Paths.user 'settings.json')) -and $report.workbenchHash -eq (Hash $Paths.workbench)
            }
        }
        $name='Authenticated Gemini rule consumption and target GitHub MCP authorization'
        $script:Checks+=,@{name=$name;status='SKIPPED';reason='Target account authorization and actual AI rule consumption cannot be attested from local files. No source credentials transferred.'}; Say "[SKIPPED REQUIRED] $name"
    }
    return ,$script:Checks
}
