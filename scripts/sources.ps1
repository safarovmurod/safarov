function Resolve-OfficialDownload([string]$Name) {
    $sources=Read-Json (Join-Path $script:Root 'manifests\sources-manifest.json')
    $matches=@($sources | Where-Object name -eq $Name)
    if ($matches.Count -ne 1 -or !$matches[0].verified -or !$matches[0].sha256) { throw "No verified pinned official artifact: $Name" }
    $source=$matches[0]
    if (([uri]$source.downloadUrl).Scheme -ne 'https') { throw "Non-HTTPS source rejected: $Name" }
    # Critical versions are locked to the audited compatibility profile, never replaced with latest.
    return $source
}
