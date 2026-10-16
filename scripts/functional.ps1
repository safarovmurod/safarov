function Test-ExtensionHost($Paths) {
    $script:ProbeStillRunning=$false
    $report=Join-Path $Paths.repair 'functional-verification.json'
    $development=Join-Path $script:Root 'payload\verification-host'
    $runner=Join-Path $development 'runner.cjs'
    $oldReport=$env:PORTABLE_TEST_REPORT;$oldSettings=$env:PORTABLE_SETTINGS_FILE;$oldWorkbench=$env:PORTABLE_WORKBENCH_FILE;$oldPort=$env:PORTABLE_RENDERER_PORT
    $probeRoot=Join-Path $env:TEMP ('agp-probe-'+[guid]::NewGuid().ToString('N').Substring(0,10))
    $probeWorkspace=Join-Path $probeRoot 'workspace'
    $probeData=Join-Path $probeRoot 'user-data'
    [IO.Directory]::CreateDirectory((Join-Path $probeWorkspace '.vscode'))|Out-Null
    [IO.File]::WriteAllText((Join-Path $probeWorkspace '.vscode\settings.json'),'{"runtimeMonitor.autoConnect":false,"runtimeMonitor.preserveLog":false}', $script:Utf8)
    [IO.Directory]::CreateDirectory((Join-Path $probeData 'User\globalStorage'))|Out-Null
    foreach($file in @('settings.json','keybindings.json')){Copy-Item -LiteralPath (Join-Path $Paths.user $file) -Destination (Join-Path $probeData ('User\'+$file))}
    & $script:Node (Join-Path $PSScriptRoot 'extension-state.cjs') (Join-Path $probeData 'User\globalStorage\state.vscdb') (Join-Path $script:Root 'manifests\source-manifest.json') (Join-Path $script:Root 'manifests\extensions-manifest.json')
    if($LASTEXITCODE -ne 0){throw 'Isolated verification profile initialization failed.'}
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    $listener.Start();$env:PORTABLE_RENDERER_PORT=[string]$listener.LocalEndpoint.Port;$listener.Stop()
    try {
        $env:PORTABLE_TEST_REPORT=$report;$env:PORTABLE_SETTINGS_FILE=Join-Path $Paths.user 'settings.json';$env:PORTABLE_WORKBENCH_FILE=$Paths.workbench
        if(Test-Path -LiteralPath $report){Backup-File $report 'functional-report';Remove-Item -LiteralPath $report}
        else{Backup-File $report 'functional-report'}
        # Trust is bypassed only for this generated test workspace/profile; target security settings remain intact.
        $args='--new-window --skip-welcome --skip-release-notes --disable-workspace-trust --remote-debugging-address=127.0.0.1 --remote-debugging-port='+$env:PORTABLE_RENDERER_PORT+' --user-data-dir="'+$probeData+'" --extensions-dir="'+$Paths.extensions+'" --extensionDevelopmentPath="'+$development+'" --extensionTestsPath="'+$runner+'" "'+$probeWorkspace+'"'
        $process=Start-Process -FilePath $Paths.exe -ArgumentList $args -WindowStyle Hidden -PassThru
        if(!$process.WaitForExit(150000)){$script:ProbeStillRunning=$true;Say '[UNVERIFIED] Test IDE still running after 150 seconds. No process terminated.';return $false}
        if($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath $report)){Say '[FAIL] Extension host probe failed or produced no report.';return $false}
        $data=Read-Json $report
        return @($data.checks | Where-Object status -ne PASS).Count -eq 0
    }finally{
        $env:PORTABLE_TEST_REPORT=$oldReport;$env:PORTABLE_SETTINGS_FILE=$oldSettings;$env:PORTABLE_WORKBENCH_FILE=$oldWorkbench;$env:PORTABLE_RENDERER_PORT=$oldPort
        if(!$script:ProbeStillRunning){
            & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') remove $env:TEMP $probeRoot
            if($LASTEXITCODE -ne 0){Say '[WARN] Temporary verification workspace could not be removed.'}
        }
    }
}
