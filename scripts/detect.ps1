function Detect-Ide {
    $candidates = New-Object Collections.Generic.List[string]
    $running = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Antigravity IDE.exe' })
    foreach ($p in $running) { if ($p.ExecutablePath) { $candidates.Add((Split-Path -Parent $p.ExecutablePath)) } }
    foreach ($r in @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'Antigravity IDE*' })) {
        if ($r.InstallLocation) { $candidates.Add($r.InstallLocation.TrimEnd('\')) }
    }
    $cmd = Get-Command 'antigravity-ide.cmd' -ErrorAction SilentlyContinue
    if ($cmd) { $candidates.Add((Split-Path -Parent (Split-Path -Parent $cmd.Source))) }
    foreach ($base in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($base) { $candidates.Add((Join-Path $base 'Antigravity IDE')); $candidates.Add((Join-Path $base 'Programs\Antigravity IDE')) }
    }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($menu in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'),[Environment]::GetFolderPath('Desktop'))) {
        if (Test-Path -LiteralPath $menu) {
            foreach ($lnk in @(Get-ChildItem -LiteralPath $menu -Filter '*Antigravity*.lnk' -Recurse -ErrorAction SilentlyContinue)) {
                $target=$shell.CreateShortcut($lnk.FullName).TargetPath
                if ($target -and (Split-Path -Leaf $target) -eq 'Antigravity IDE.exe') { $candidates.Add((Split-Path -Parent $target)) }
            }
        }
    }
    $found=@()
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        $exe=Join-Path $candidate 'Antigravity IDE.exe'; $productPath=Join-Path $candidate 'resources\app\product.json'
        if ((Test-Path -LiteralPath $exe) -and (Test-Path -LiteralPath $productPath)) {
            $product=Read-Json $productPath
            if ($product.applicationName -ne 'antigravity-ide') { continue }
            $pkg=Read-Json (Join-Path $candidate 'resources\app\package.json')
            $found+=@{install=$candidate;exe=$exe;cli=(Join-Path $candidate 'bin\antigravity-ide.cmd');core=$pkg.version;commit=$product.commit;version=([Diagnostics.FileVersionInfo]::GetVersionInfo($exe).ProductVersion);running=(@($running | Where-Object ExecutablePath -eq $exe).Count -gt 0)}
        }
    }
    if (!$found.Count) { return $null }
    $active=@($found | Where-Object running)
    if ($active.Count -gt 1) { throw 'Multiple running Antigravity IDE installations; safe selection is ambiguous.' }
    if ($active.Count -eq 1) { return $active[0] }
    $deployment=Join-Path $env:USERPROFILE '.antigravity\jelly-cursor\deployment.json'
    if(Test-Path -LiteralPath $deployment){
        $saved=Read-Json $deployment
        $selected=@($found | Where-Object {$_.install.TrimEnd('\') -eq $saved.ideRoot.TrimEnd('\')})
        if($selected.Count -eq 1){return $selected[0]}
    }
    # Registry and shortcuts are signals, but do not silently choose between multiple editor installations.
    if ($found.Count -gt 1) { throw 'Multiple Antigravity IDE installations found. DIAGNOSTICS lists candidates; no installation was changed.' }
    return $found[0]
}
function Target-Paths($Ide) {
    $data=Join-Path $env:APPDATA 'Antigravity IDE'
    $extensions=Join-Path $env:USERPROFILE '.antigravity-ide\extensions'
    $compat=Read-Json (Join-Path $script:Root 'manifests\compatibility.json')
    return @{install=$Ide.install;exe=$Ide.exe;cli=$Ide.cli;data=$data;user=(Join-Path $data 'User');extensions=$extensions;gemini=(Join-Path $env:USERPROFILE '.gemini');repair=(Join-Path $env:USERPROFILE '.antigravity\jelly-cursor');workbench=(Join-Path $Ide.install $compat.workbenchRelativePath);fonts=(Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts')}
}
