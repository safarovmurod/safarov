function Get-Preflight {
    $os=Get-CimInstance Win32_OperatingSystem; $cpu=Get-CimInstance Win32_Processor | Select-Object -First 1
    $architecture=if ($env:PROCESSOR_ARCHITEW6432) {$env:PROCESSOR_ARCHITEW6432} else {$env:PROCESSOR_ARCHITECTURE}
    $disk=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
    $ide=Detect-Ide
    $browsers=@()
    foreach($base in @($env:ProgramFiles,${env:ProgramFiles(x86)},$env:LOCALAPPDATA)){
        if(!$base){continue}
        foreach($relative in @('Google\Chrome\Application\chrome.exe','Microsoft\Edge\Application\msedge.exe')){
            $candidate=Join-Path $base $relative
            if(Test-Path -LiteralPath $candidate){$browsers+=@{path=$candidate;version=([Diagnostics.FileVersionInfo]::GetVersionInfo($candidate).ProductVersion)}}
        }
    }
    $profile=@{windows=$os.Caption;build=[int]$os.BuildNumber;architecture=$architecture;cpu=$cpu.Name;ramTotalGB=[math]::Round($os.TotalVisibleMemorySize/1MB,2);ramAvailableGB=[math]::Round($os.FreePhysicalMemory/1MB,2);systemDrive=$env:SystemDrive;freeDiskGB=[math]::Round($disk.FreeSpace/1GB,2);filesystem=$disk.FileSystem;user=$env:USERNAME;userprofile=$env:USERPROFILE;appdata=$env:APPDATA;localappdata=$env:LOCALAPPDATA;temp=$env:TEMP;powershell=$PSVersionTable.PSVersion.ToString();executionPolicy=(Get-ExecutionPolicy).ToString();ide=$ide;node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source;git=(Get-Command git.exe -ErrorAction SilentlyContinue).Source;proxyConfigured=([Net.WebRequest]::DefaultWebProxy.GetProxy('https://antigravity.google').Host -ne 'antigravity.google');longPaths=(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled}
    $profile.browsers=$browsers
    return $profile
}
function Assert-Preflight($P) {
    if ($PSVersionTable.PSVersion -lt [version]'5.1') { throw 'PowerShell 5.1 or newer required.' }
    if ($P.build -lt 19041) { throw 'Windows 10 build 19041 or newer required by this validated profile.' }
    if ($P.architecture -ne 'AMD64') { throw 'This package is validated only for Windows x64. ARM64/x86 require a separately verified profile.' }
    if ($P.freeDiskGB -lt 5) { throw 'At least 5 GB free disk space required for staging and rollback.' }
    if ($P.ide -and $P.ide.running) { throw 'ACTION REQUIRED: save work and close Antigravity IDE, then rerun SETUP. No process was terminated.' }
    foreach ($path in @($env:USERPROFILE,$env:APPDATA,$env:LOCALAPPDATA,$script:Root)) { Assert-NoReparse $path }
    $profileDir=Join-Path $env:APPDATA 'Antigravity IDE\User\profiles'
    if ((Test-Path -LiteralPath $profileDir) -and @(Get-ChildItem -LiteralPath $profileDir -Directory).Count) { throw 'Named target profiles require explicit mapping; source profile is Default. No settings changed.' }
    foreach ($file in @((Join-Path $env:APPDATA 'Antigravity IDE\User\settings.json'),(Join-Path $env:APPDATA 'Antigravity IDE\User\keybindings.json'),(Join-Path $env:USERPROFILE '.antigravity-ide\extensions\extensions.json'),(Join-Path $env:USERPROFILE '.gemini\config\mcp_config.json'))) { if (Test-Path -LiteralPath $file) { $null=Read-Json $file } }
}
