$ErrorActionPreference = 'Stop'
$script:Root = Split-Path -Parent $PSScriptRoot
$script:Utf8 = New-Object System.Text.UTF8Encoding($false)
$script:Journal = $null
$script:LogFile = $null
function Say([string]$Text) {
    Write-Host $Text
    if ($script:LogFile) { [IO.File]::AppendAllText($script:LogFile, "$Text`r`n", $script:Utf8) }
}
function Read-Json([string]$Path) {
    if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing JSON: $Path" }
    $raw = [IO.File]::ReadAllText($Path)
    # Preserve strings while stripping JSONC comments, then remove trailing commas outside strings.
    $pattern = '"(?:\\.|[^"\\])*"|//[^\r\n]*|/\*[\s\S]*?\*/'
    $raw = [regex]::Replace($raw, $pattern, { param($m) if ($m.Value.StartsWith('"')) { $m.Value } else { ' ' } })
    $raw = [regex]::Replace($raw, '"(?:\\.|[^"\\])*"|,(\s*[}\]])', { param($m) if ($m.Groups[1].Success) { $m.Groups[1].Value } else { $m.Value } })
    $parsed = Convert-Plain (ConvertFrom-Json -InputObject $raw -ErrorAction Stop)
    if ($parsed -is [array]) { foreach ($entry in $parsed) { Write-Output -NoEnumerate $entry }; return }
    return $parsed
}
function Convert-Plain($Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [array]) { $list = @(); foreach ($v in $Value) { $list += ,(Convert-Plain $v) }; return ,$list }
    if ($Value -is [Collections.IDictionary]) {
        $map = @{}; foreach ($key in $Value.Keys) { $map[$key] = Convert-Plain $Value[$key] }; return ,$map
    }
    if ($Value -is [pscustomobject]) {
        $map = @{}; foreach ($prop in $Value.PSObject.Properties) { $map[$prop.Name] = Convert-Plain $prop.Value }; return ,$map
    }
    return $Value
}
function Json-Text($Value) { return ConvertTo-Json -InputObject $Value -Depth 80 }
function Save-Json([string]$Path, $Value) {
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [IO.File]::WriteAllText($Path, (Json-Text $Value), $script:Utf8)
}
function Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Resolve-Under([string]$Base, [string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative)) { throw "Absolute payload path rejected: $Relative" }
    $baseFull = [IO.Path]::GetFullPath($Base).TrimEnd('\')
    $resolved = [IO.Path]::GetFullPath((Join-Path $baseFull $Relative))
    if (!$resolved.StartsWith($baseFull + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes its root: $Relative" }
    return $resolved
}
function Assert-NoReparse([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point requires manual review: $cursor" }
        }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Assert-Payload {
    $files = Read-Json (Join-Path $script:Root 'manifests\files-manifest.json')
    foreach ($entry in $files) {
        $p = Resolve-Under $script:Root $entry.path
        if (!(Test-Path -LiteralPath $p -PathType Leaf) -or (Hash $p) -ne $entry.sha256) { throw "Payload missing/corrupt: $($entry.path)" }
    }
}
function Merge-Map($Target, $Source) {
    foreach ($key in $Source.Keys) {
        if ($Target.ContainsKey($key) -and $Target[$key] -is [Collections.IDictionary] -and $Source[$key] -is [Collections.IDictionary]) { Merge-Map $Target[$key] $Source[$key] }
        else { $Target[$key] = $Source[$key] }
    }
}
function Contains-Profile($Target, $Source) {
    if ($Source -is [Collections.IDictionary]) {
        if ($Target -isnot [Collections.IDictionary]) { return $false }
        foreach ($k in $Source.Keys) { if (!$Target.ContainsKey($k) -or !(Contains-Profile $Target[$k] $Source[$k])) { return $false } }
        return $true
    }
    if ($Source -is [array]) {
        if ($Target -isnot [array] -or $Target.Count -ne $Source.Count) { return $false }
        for ($i=0;$i -lt $Source.Count;$i++) { if (!(Contains-Profile $Target[$i] $Source[$i])) { return $false } }; return $true
    }
    return (Json-Text $Target) -ceq (Json-Text $Source)
}
