function Invoke-VendorInstaller([string]$Artifact,[string]$Directory,[string]$Signer) {
    Assert-Publisher $Artifact $Signer
    if ($Directory.Contains('"')) { throw 'Invalid installation directory.' }
    $args='/CURRENTUSER /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /MERGETASKS="!runcode,!desktopicon,!quicklaunchicon" /DIR="'+$Directory+'"'
    # Vendor installations run only after all artifacts pass preflight. Never kill an existing editor.
    $proc=Start-Process -FilePath $Artifact -ArgumentList $args -WindowStyle Hidden -PassThru
    if (!$proc.WaitForExit(600000)) { throw 'Vendor installer still running after timeout. No process killed. Rerun after it completes.' }
    if ($proc.ExitCode -notin @(0,3010)) { throw "Vendor installer failed with exit code $($proc.ExitCode)." }
}
function Ensure-Ide($Existing) {
    $compat=Read-Json (Join-Path $script:Root 'manifests\compatibility.json')
    if ($Existing -and $Existing.commit -eq $compat.commit) { Say '[SKIP] Antigravity IDE compatible build already installed.'; return $Existing }
    if ($Existing) {
        # Protect the current editor: a vendor updater changes registry/uninstall state outside file transactions.
        # Stage a second per-user installation; retain the previous editor intact for recovery.
        $dir=Join-Path $env:LOCALAPPDATA ('Programs\Antigravity-Portable\'+$compat.ideVersion)
        if ($Existing.version -match '^([0-9]+\.[0-9]+\.[0-9]+)' -and [version]$Matches[1] -gt [version]$compat.ideVersion) { throw 'Newer unknown IDE build detected. No downgrade or blind patch performed.' }
    } else { $dir=Join-Path $env:LOCALAPPDATA 'Programs\Antigravity IDE' }
    $source=Resolve-OfficialDownload 'Antigravity IDE'; $artifact=Get-Artifact $source
    Say '[25%] Installing the official, pinned compatible Antigravity IDE build'
    Invoke-VendorInstaller $artifact $dir 'Google LLC'
    $product=Read-Json (Join-Path $dir 'resources\app\product.json')
    if ($product.commit -ne $compat.commit -or $product.applicationName -ne 'antigravity-ide') { throw 'Official IDE installation identity/build mismatch.' }
    $exe=Join-Path $dir 'Antigravity IDE.exe'; $cli=Join-Path $dir 'bin\antigravity-ide.cmd'
    if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath $cli)) { throw 'Installed IDE executable/CLI missing.' }
    $versionOutput=& $cli --version 2>&1
    if ($LASTEXITCODE -ne 0 -or ($versionOutput -join ' ') -notmatch [regex]::Escape($compat.commit)) { throw 'Installed IDE CLI validation failed.' }
    return @{install=$dir;exe=$exe;cli=$cli;commit=$product.commit;core=$compat.coreVersion;version=$compat.ideVersion;running=$false}
}
function Find-GitBash {
    $git=Get-Command git.exe -ErrorAction SilentlyContinue
    $candidates=@()
    if ($git) { $candidates+=Join-Path (Split-Path -Parent (Split-Path -Parent $git.Source)) 'bin\bash.exe' }
    foreach ($base in @($env:ProgramFiles,$env:LOCALAPPDATA)) { if($base){$candidates+=Join-Path $base 'Git\bin\bash.exe'; $candidates+=Join-Path $base 'Programs\Git\bin\bash.exe'} }
    return @($candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)[0]
}
function Find-Node {
    $command=Get-Command node.exe -ErrorAction SilentlyContinue
    if($command){return $command.Source}
    $source=Resolve-OfficialDownload 'Node.js'
    $candidate=Join-Path $env:LOCALAPPDATA ('Antigravity-Portable\dependencies\node-'+$source.version+'-win-x64\node.exe')
    if(Test-Path -LiteralPath $candidate -PathType Leaf){return $candidate}
    return $null
}
function Ensure-Dependencies {
    $node=Find-Node
    $valid=$false
    if ($node) { $version=& $node --version; $valid=$LASTEXITCODE -eq 0 -and $version -match '^v(2[4-9]|[3-9][0-9])\.' }
    if (!$valid) {
        $source=Resolve-OfficialDownload 'Node.js'; $artifact=Get-Artifact $source
        $base=Join-Path $env:LOCALAPPDATA 'Antigravity-Portable\dependencies'
        Expand-SafeZip $artifact $base
        $nodeDir=Join-Path $base ('node-'+$source.version+'-win-x64')
        $script:Node=Join-Path $nodeDir 'node.exe'
        if ((& $script:Node --version) -ne $source.version) { throw 'Node.js post-install version mismatch.' }
        $userPath=[Environment]::GetEnvironmentVariable('Path','User')
        if ($userPath -notlike "*$nodeDir*") { Put-Registry 'HKCU:\Environment' 'Path' ($nodeDir+';'+$userPath) }
        $env:Path=$nodeDir+';'+$env:Path
    } else { $script:Node=$node }
    $script:GitBash=Find-GitBash
    if (!$script:GitBash) {
        $source=Resolve-OfficialDownload 'Git for Windows'; $artifact=Get-Artifact $source
        $dir=Join-Path $env:LOCALAPPDATA 'Programs\Git'
        Invoke-VendorInstaller $artifact $dir $source.signer
        $script:GitBash=Join-Path $dir 'bin\bash.exe'
        if (!(Test-Path -LiteralPath $script:GitBash)) { throw 'Git Bash post-install verification failed.' }
        $env:Path=(Join-Path $dir 'cmd')+';'+$env:Path
    }
}
