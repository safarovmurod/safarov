function Get-Artifact($Source) {
    if ($Source.offlinePayloadAvailable) {
        $p=Resolve-Under $script:Root $Source.payload
        if ((Test-Path -LiteralPath $p) -and (Hash $p) -eq $Source.sha256) { Say "[SKIP DOWNLOAD] $($Source.name): verified offline payload"; return $p }
    }
    $cache=Join-Path $script:Root 'cache\downloads'; [IO.Directory]::CreateDirectory($cache) | Out-Null
    $dest=Resolve-Under $cache $Source.cacheFile
    if (Test-Path -LiteralPath $dest) {
        if ((Hash $dest) -eq $Source.sha256 -and (Get-Item -LiteralPath $dest).Length -eq $Source.size) { Say "[SKIP DOWNLOAD] $($Source.name): verified cache"; return $dest }
        Remove-Item -LiteralPath $dest -Force
    }
    Add-Type -AssemblyName System.Net.Http
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    for ($attempt=1;$attempt -le 3;$attempt++) {
        $handler=New-Object Net.Http.HttpClientHandler; $handler.AllowAutoRedirect=$false
        $client=New-Object Net.Http.HttpClient($handler); $client.Timeout=[TimeSpan]::FromSeconds(120)
        $cancel=New-Object Threading.CancellationTokenSource; $cancel.CancelAfter(600000)
        $partial=$dest+'.part'
        try {
            $uri=[uri]$Source.downloadUrl
            for ($redirect=0;$redirect -le 8;$redirect++) {
                if ($uri.Scheme -ne 'https') { throw 'Non-HTTPS redirect refused.' }
                $response=$client.GetAsync($uri,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cancel.Token).GetAwaiter().GetResult()
                if ([int]$response.StatusCode -in @(301,302,303,307,308)) {
                    $location=$response.Headers.Location; if (!$location) { throw 'Invalid redirect.' }
                    $uri=New-Object Uri($uri,$location); $response.Dispose(); continue
                }
                $null=$response.EnsureSuccessStatusCode(); break
            }
            if ($redirect -gt 8) { throw 'Too many redirects.' }
            $input=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $output=[IO.File]::Create($partial)
            try { $null=$input.CopyToAsync($output,81920,$cancel.Token).GetAwaiter().GetResult() } finally { $output.Dispose(); $input.Dispose(); $response.Dispose() }
            if ((Get-Item -LiteralPath $partial).Length -ne $Source.size -or (Hash $partial) -ne $Source.sha256) { throw "Size or SHA256 mismatch: $($Source.name)" }
            Move-Item -LiteralPath $partial -Destination $dest -Force
            Say "[DOWNLOAD VERIFIED] $($Source.name) $($Source.version)"
            return $dest
        } catch {
            if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
            if ($attempt -eq 3) { throw "Official download failed after 3 attempts: $($Source.name). $($_.Exception.Message)" }
            Start-Sleep -Seconds 2
        } finally { $client.Dispose(); $handler.Dispose(); $cancel.Dispose() }
    }
}
function Assert-Publisher([string]$Path,[string]$Expected) {
    $sig=Get-AuthenticodeSignature -LiteralPath $Path
    if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch [regex]::Escape($Expected)) { throw "Artifact publisher signature failed: $Path" }
}
function Expand-SafeZip([string]$Path,[string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($Path)
    try {
        foreach ($entry in $zip.Entries) {
            $target=Resolve-Under $Destination $entry.FullName
            if (!$entry.Name) { continue }
            [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)
        }
    } finally { $zip.Dispose() }
}
