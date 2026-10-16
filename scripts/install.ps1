function Install-Extensions($Paths) {
    $manifest=Read-Json (Join-Path $script:Root 'manifests\extensions-manifest.json')
    $registryPath=Join-Path $Paths.extensions 'extensions.json'
    $registry=@(); if(Test-Path -LiteralPath $registryPath){$registry=@(Read-Json $registryPath)}
    $ids=@($manifest | ForEach-Object {$_.id.ToLowerInvariant()})
    $retained=@($registry | Where-Object {$ids -notcontains $_.identifier.id.ToLowerInvariant()})
    $stage=Join-Path $env:TEMP ('agp-'+[guid]::NewGuid().ToString('N').Substring(0,8)); [IO.Directory]::CreateDirectory($stage) | Out-Null
    $script:Journal.stage=$stage; Save-Journal
    foreach ($entry in $manifest) {
        $target=Resolve-Under $Paths.extensions $entry.folder
        if ($entry.kind -eq 'custom') { $source=Resolve-Under $script:Root $entry.payload }
        else {
            $artifact=Get-Artifact (Resolve-OfficialDownload $entry.id)
            $extract=Resolve-Under $stage $entry.folder
            # Stage through the IDE CLI, so no live target registry is changed before backups exist.
            $cliExt=Join-Path $extract 'extensions'; $cliUser=Join-Path $extract 'user-data'
            $source=$null
            if (!$script:CliStagingFailed) {
                $savedPreference=$ErrorActionPreference
                try { $ErrorActionPreference='Continue'; $output=& $Paths.cli --user-data-dir $cliUser --extensions-dir $cliExt --install-extension $artifact --force 2>&1; $cliCode=$LASTEXITCODE } finally { $ErrorActionPreference=$savedPreference }
                if ($cliCode -eq 0 -and (Test-Path -LiteralPath $cliExt)) {
                    $candidates=@(Get-ChildItem -LiteralPath $cliExt -Directory | Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'package.json')})
                    foreach($candidate in $candidates){$pkg=Read-Json (Join-Path $candidate.FullName 'package.json');if(($pkg.publisher+'.'+$pkg.name).ToLowerInvariant() -eq $entry.id.ToLowerInvariant() -and $pkg.version -eq $entry.version){$source=$candidate.FullName;break}}
                }
                if (!$source) { $script:CliStagingFailed=$true; Say '[FALLBACK] IDE CLI could not stage an isolated extension. Using checksum-verified VSIX contents and the audited registry format.' }
            }
            if (!$source) { Expand-SafeZip $artifact $extract; $source=Join-Path $extract 'extension' }
            if(!$source){throw "Staged extension identity/version mismatch: $($entry.id)"}
        }
        $pkg=Read-Json (Join-Path $source 'package.json')
        if (($pkg.publisher+'.'+$pkg.name).ToLowerInvariant() -ne $entry.id.ToLowerInvariant() -or $pkg.version -ne $entry.version) { throw "Payload extension identity mismatch: $($entry.id)" }
        # Retire only known directories for the same ID. Journal each file; no recursive blind deletion.
        foreach($old in @($registry | Where-Object {$_.identifier.id.ToLowerInvariant() -eq $entry.id.ToLowerInvariant()})) {
            if($old.relativeLocation -and $old.relativeLocation -ne $entry.folder){
                $oldPath=Resolve-Under $Paths.extensions $old.relativeLocation
                if(Test-Path -LiteralPath $oldPath){
                    $empty=Join-Path $stage 'empty';[IO.Directory]::CreateDirectory($empty)|Out-Null
                    Put-Tree $empty $oldPath $Paths.extensions 'retired-extension'
                    & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') remove $Paths.extensions $oldPath
                    if($LASTEXITCODE -ne 0){throw 'Could not retire previous extension directory.'}
                }
            }
        }
        Put-Tree $source $target $Paths.extensions $entry.id
        $retained+=,@{identifier=@{id=$entry.id};version=$entry.version;relativeLocation=$entry.folder;location=@{'$mid'=1;scheme='file';path=$target.Replace('\','/')};metadata=@{isApplicationScoped=$false;isMachineScoped=$false;isBuiltin=$false;targetPlatform='universal'}}
        Say "[EXTENSION VERIFIED] $($entry.id)@$($entry.version)"
    }
    Put-Text $registryPath (Json-Text @($retained)) 'extension-registry'
    $obsoletePath=Join-Path $Paths.extensions '.obsolete'
    if(Test-Path -LiteralPath $obsoletePath){
        $obsolete=Read-Json $obsoletePath
        foreach($entry in $manifest){$obsolete.Remove($entry.folder)}
        Put-Text $obsoletePath (Json-Text $obsolete) 'extension-obsolete-registry'
    }
    & $script:Node (Join-Path $PSScriptRoot 'tree.cjs') remove $env:TEMP $stage
    if($LASTEXITCODE -ne 0){throw 'Could not clean temporary extension staging.'}
}
function Install-Fonts($Paths) {
    $fonts=Read-Json (Join-Path $script:Root 'manifests\fonts-manifest.json')
    foreach($font in $fonts){
        $target=Resolve-Under $Paths.fonts $font.file
        Put-File (Resolve-Under (Join-Path $script:Root 'payload\fonts') $font.file) $target 'font'
        Put-Registry 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts' $font.registryName $target
    }
    if (-not ('PortableFontNative' -as [type])) {
        Add-Type 'using System; using System.Runtime.InteropServices; public class PortableFontNative { [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string file,uint flags,IntPtr reserved); [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd,uint Msg,IntPtr wParam,IntPtr lParam,uint flags,uint timeout,out IntPtr result); }'
    }
    foreach($font in $fonts){$null=[PortableFontNative]::AddFontResourceEx((Join-Path $Paths.fonts $font.file),0,[IntPtr]::Zero)}
    $result=[IntPtr]::Zero; $null=[PortableFontNative]::SendMessageTimeout([IntPtr]0xffff,0x1D,[IntPtr]::Zero,[IntPtr]::Zero,2,2000,[ref]$result)
}
