param([ValidateSet('Setup','Verify','Diagnostics')][string]$Mode='Setup')
$ErrorActionPreference='Stop'
# Use this PowerShell installation's built-in modules, not an inherited PS7 module path.
# This changes only the child process environment; no persistent environment or policy is edited.
$env:PSModulePath="$PSHOME\Modules"
foreach($builtin in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets')){
    Import-Module "$PSHOME\Modules\$builtin\$builtin.psd1" -Force -ErrorAction Stop
}
. (Join-Path $PSScriptRoot 'common.ps1')
foreach($module in @('detect','preflight','sources','downloader','updater','backup','install','configure','repair','extras','verify','functional','diagnostics')){. (Join-Path $PSScriptRoot ($module+'.ps1'))}
$exitCode=1
$lock=$null
try {
    if($Mode -eq 'Diagnostics'){Show-Diagnostics;exit 0}
    Assert-Payload
    if($Mode -eq 'Verify'){
        $ide=Detect-Ide; if(!$ide){throw 'Antigravity IDE not detected.'}
        $paths=Target-Paths $ide; $script:GitBash=Find-GitBash; $script:Node=Find-Node
        $script:Browser=Find-Browser
        $checks=Test-Target $paths
        if(@($checks | Where-Object status -ne PASS).Count){Say 'VERIFICATION FAILED: required runtime observations remain unverified, or a component failed. See checks above.';exit 2}
        Say 'VERIFICATION PASSED';exit 0
    }
    Say '[00%] Starting; checking target before changes'
    $profile=Get-Preflight
    Assert-Preflight $profile
    # Cross-process lock prevents overlapping setup transactions.
    $lockPath=Join-Path $script:Root 'setup.lock'
    $lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    [IO.Directory]::CreateDirectory((Join-Path $script:Root 'logs'))|Out-Null
    $script:LogFile=Join-Path $script:Root 'logs\setup.log'
    Say '[05%] Target preflight passed'
    Save-Json (Join-Path $script:Root 'logs\target-profile.json') $profile
    $script:Node=Find-Node
    Recover-Interrupted
    Say '[15%] Resolving pinned compatible sources'
    # Verify/download ALL needed artifacts before installing dependencies or applying configuration.
    $sources=Read-Json (Join-Path $script:Root 'manifests\sources-manifest.json')
    foreach($source in @($sources | Where-Object {$_.type -in @('ide','node','git','extension','browser')})){ $null=Get-Artifact $source }
    Say '[40%] All artifacts passed integrity verification'
    Start-Transaction
    $ide=Ensure-Ide $profile.ide
    $paths=Target-Paths $ide
    Assert-Workbench $paths
    Ensure-Dependencies
    Ensure-Browser
    Say '[45%] Transaction journal active; backups precede every changed configuration file'
    Say '[55%] Installing exact extensions'
    Install-Extensions $paths
    Say '[70%] Merging settings and keybindings'
    Configure-Target $paths
    Say '[76%] Installing and testing credential-free MCP servers'
    Install-Mcp $paths
    Say '[82%] Installing source fonts and preserving theme/icons'
    Install-Fonts $paths
    Say '[87%] Applying verified Jelly/Ripple and portable repair'
    Install-Repair $paths
    Say '[94%] Configuration verification'
    $checks=Test-Target $paths -ConfigurationOnly
    if(@($checks | Where-Object status -eq FAIL).Count){
        Say '[97%] One bounded repair/retest pass'
        Configure-Target $paths; Install-Repair $paths
        $checks=Test-Target $paths -ConfigurationOnly
    }
    if(@($checks | Where-Object status -eq FAIL).Count){throw 'Required configuration checks failed after repair.'}
    Say '[99%] SOURCE/TARGET configuration comparison passed'
    Say '[FUNCTIONAL] Starting a temporary IDE extension-host probe (no permanent verification extension installed)'
    $functional=Test-ExtensionHost $paths
    if(!$functional){
        if($script:ProbeStillRunning){Say 'INSTALLATION INCOMPLETE: close the test IDE and rerun; the pending transaction will be recovered before reapplying.';exit 2}
        throw 'Required extension host activation failed. Restoring changed configuration.'
    }
    $script:Journal.state='COMMITTED'; Save-Journal
    $checks=Test-Target $paths
    Save-Json (Join-Path $script:Root 'logs\verification.json') $checks
    if(@($checks | Where-Object status -ne PASS).Count){
        Say 'INSTALLATION INCOMPLETE: configuration installed and verified; required live runtime observations remain unverified.'
        Say 'LOCAL CONFIGURATION, RENDERER, RUNTIME MONITOR AND LOCAL MCP TESTS PASSED.'
        Say 'ACTION REQUIRED: sign into Antigravity on the target and authorize GitHub MCP if needed. Actual AI rule consumption still needs account-session verification.'
        $exitCode=2
    }else{Say '[100%] COMPLETE';$exitCode=0}
}catch{
    Say ('[ERROR] '+$_.Exception.Message)
    Say ('[PATH] '+$script:Root)
    Say '[ACTION] Installation stopped. No editor process was force-closed.'
    if($script:Journal -and $script:Journal.state -eq 'APPLYING'){
        try{Undo-Transaction}catch{Say ('[ROLLBACK ERROR] '+$_.Exception.Message)}
    }
    Say 'INSTALLATION INCOMPLETE';$exitCode=1
}finally{
    if($lock){$lock.Dispose()}
}
exit $exitCode
