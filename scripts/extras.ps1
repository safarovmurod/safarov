function Find-Browser {
    foreach($base in @($env:ProgramFiles,${env:ProgramFiles(x86)},$env:LOCALAPPDATA)) {
        if(!$base){continue}
        foreach($relative in @('Google\Chrome\Application\chrome.exe','Microsoft\Edge\Application\msedge.exe')) {
            $candidate=Join-Path $base $relative
            if(Test-Path -LiteralPath $candidate -PathType Leaf){return $candidate}
        }
    }
    $portable=Join-Path $env:LOCALAPPDATA 'Antigravity-Portable\dependencies\chrome-win64\chrome.exe'
    if(Test-Path -LiteralPath $portable -PathType Leaf){return $portable}
    return $null
}
function Ensure-Browser {
    $script:Browser=Find-Browser
    if($script:Browser){Say '[SKIP] Runtime browser is available.';return}
    $source=Resolve-OfficialDownload 'Chrome for Testing'
    $artifact=Get-Artifact $source
    $stage=Join-Path $env:TEMP ('agp-browser-'+[guid]::NewGuid().ToString('N').Substring(0,8))
    try {
        Expand-SafeZip $artifact $stage
        $exe=Join-Path $stage 'chrome-win64\chrome.exe'
        if((Hash $exe) -ne $source.browserExeSha256){throw 'Portable browser executable hash mismatch.'}
        $signature=Get-AuthenticodeSignature -LiteralPath $exe
        if($signature.Status.ToString() -ne $source.browserSignatureStatus){throw 'Portable browser signature status differs from audited official archive.'}
        if(([Diagnostics.FileVersionInfo]::GetVersionInfo($exe).ProductVersion) -notlike ($source.version+'*')){throw 'Portable browser version mismatch.'}
        $root=Join-Path $env:LOCALAPPDATA 'Antigravity-Portable\dependencies'
        Put-Tree (Join-Path $stage 'chrome-win64') (Join-Path $root 'chrome-win64') $root 'portable-runtime-browser'
        $script:Browser=Find-Browser
        if(!$script:Browser){throw 'Portable runtime browser not detected after installation.'}
        Say '[PASS] Official portable Chrome installed for Runtime Monitor and MCP.'
    }finally{
        if(Test-Path -LiteralPath $stage){& $script:Node (Join-Path $PSScriptRoot 'tree.cjs') remove $env:TEMP $stage}
    }
}
function Get-McpRuntime { return Join-Path $env:LOCALAPPDATA 'Antigravity-Portable\dependencies\mcp-runtime' }
function Expected-McpServers {
    $runtime=Get-McpRuntime
    return @{
        'chrome-devtools-mcp'=@{command=$script:Node;args=@((Join-Path $runtime 'node_modules\chrome-devtools-mcp\build\src\bin\chrome-devtools-mcp.js'),'--executablePath',$script:Browser);env=@{};disabled=$false}
        'sequential-thinking'=@{command=$script:Node;args=@((Join-Path $runtime 'node_modules\@modelcontextprotocol\server-sequential-thinking\dist\index.js'));env=@{};disabled=$false}
    }
}
function Install-Mcp($Paths) {
    $manifestPath=Join-Path $script:Root 'manifests\mcp-runtime-manifest.json'
    $manifest=Read-Json $manifestPath
    $artifact=Resolve-Under $script:Root $manifest.payload
    if((Hash $artifact) -ne $manifest.sha256){throw 'MCP offline runtime archive hash mismatch.'}
    $stage=Join-Path $env:TEMP ('agp-mcp-'+[guid]::NewGuid().ToString('N').Substring(0,8))
    $runtime=Get-McpRuntime
    try {
        Expand-SafeZip $artifact $stage
        & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') verify-files $env:TEMP $stage $manifestPath
        if($LASTEXITCODE -ne 0){throw 'Extracted MCP runtime integrity failed.'}
        Put-Tree $stage $runtime (Split-Path -Parent $runtime) 'mcp-runtime'
    }finally{
        if(Test-Path -LiteralPath $stage){& $script:Node (Join-Path $PSScriptRoot 'tree.cjs') remove $env:TEMP $stage}
    }
    $configPath=Join-Path $Paths.gemini 'config\mcp_config.json'
    $config=@{};if(Test-Path -LiteralPath $configPath){$config=Read-Json $configPath}
    if(!$config.mcpServers){$config.mcpServers=@{}}
    $expected=Expected-McpServers
    foreach($id in $expected.Keys){$config.mcpServers[$id]=$expected[$id]}
    # GitHub credentials already present on the target remain untouched. No fake token is activated.
    Put-Text $configPath (Json-Text $config) 'mcp-configuration'
    $report=Join-Path $Paths.repair 'mcp-verification.json'
    Backup-File $report 'mcp-report';[IO.Directory]::CreateDirectory($Paths.repair)|Out-Null
    & $script:Node (Join-Path $PSScriptRoot 'mcp-probe.cjs') $runtime $script:Browser $report
    if($LASTEXITCODE -ne 0){throw 'Required local MCP runtime verification failed.'}
}
