function Start-Transaction {
    $dir=Join-Path $script:Root ('backup\'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))
    [IO.Directory]::CreateDirectory($dir) | Out-Null
    $script:Journal=@{path=$dir;state='APPLYING';entries=@();started=[DateTime]::UtcNow.ToString('o')}
    Save-Journal
}
function Save-Journal { Save-Json (Join-Path $script:Journal.path 'transaction.json') $script:Journal }
function Put-Tree([string]$Source,[string]$Target,[string]$AllowedRoot,[string]$Component) {
    Assert-NoReparse $Target
    $tree=Join-Path $PSScriptRoot 'tree.cjs'
    & $script:Node $tree compare $AllowedRoot $Target $Source
    if ($LASTEXITCODE -eq 0) { Say "[SKIP] Exact extension tree: $Component"; return }
    if ($LASTEXITCODE -ne 3) { throw "Cannot inspect extension tree: $Component" }
    $exists=Test-Path -LiteralPath $Target
    $row=@{target=$Target;root=$AllowedRoot;existed=$exists;component=$Component;type='tree';timestamp=[DateTime]::UtcNow.ToString('o')}
    if ($exists) {
        $row.backup=Join-Path $script:Journal.path ('tree-'+$script:Journal.entries.Count)
        & $script:Node $tree copy $script:Journal.path $row.backup $Target
        if ($LASTEXITCODE -ne 0) { throw 'Extension tree backup failed.' }
    }
    $script:Journal.entries+=,$row; Save-Journal
    & $script:Node $tree replace $AllowedRoot $Target $Source
    if ($LASTEXITCODE -ne 0) { throw "Extension tree replacement failed: $Component" }
}
function Backup-File([string]$Path,[string]$Component) {
    Assert-NoReparse $Path
    if (@($script:Journal.entries | Where-Object target -eq $Path).Count) { return }
    $exists=Test-Path -LiteralPath $Path -PathType Leaf
    $row=@{target=$Path;existed=$exists;component=$Component;reason='installer will change this file';timestamp=[DateTime]::UtcNow.ToString('o');type='file'}
    if ($exists) {
        $row.hash=Hash $Path; $row.size=(Get-Item -LiteralPath $Path).Length; $row.backup=Join-Path $script:Journal.path ([string]$script:Journal.entries.Count+'.bin')
        Copy-Item -LiteralPath $Path -Destination $row.backup
        if ((Hash $row.backup) -ne $row.hash) { throw "Backup verification failed: $Path" }
    }
    $script:Journal.entries+=,$row; Save-Journal
}
function Put-File([string]$Source,[string]$Target,[string]$Component) {
    if ((Test-Path -LiteralPath $Target -PathType Leaf) -and (Hash $Source) -eq (Hash $Target)) { return }
    Backup-File $Target $Component
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Target)) | Out-Null
    $tmp=$Target+'.portable-setup-tmp'
    Copy-Item -LiteralPath $Source -Destination $tmp -Force
    if ((Hash $tmp) -ne (Hash $Source)) { throw "Staging copy failed: $Target" }
    Move-Item -LiteralPath $tmp -Destination $Target -Force
    if ((Hash $Target) -ne (Hash $Source)) { throw "Target integrity failed: $Target" }
}
function Put-Text([string]$Target,[string]$Text,[string]$Component) {
    if ((Test-Path -LiteralPath $Target) -and [IO.File]::ReadAllText($Target) -ceq $Text) { return }
    Backup-File $Target $Component
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Target)) | Out-Null
    [IO.File]::WriteAllText($Target+'.portable-setup-tmp',$Text,$script:Utf8)
    Move-Item -LiteralPath ($Target+'.portable-setup-tmp') -Destination $Target -Force
}
function Put-Registry([string]$Path,[string]$Name,[string]$Value) {
    $item=Get-ItemProperty -LiteralPath $Path -ErrorAction SilentlyContinue
    $existed=$item -and $null -ne $item.PSObject.Properties[$Name]
    if ($existed -and $item.$Name -ceq $Value) { return }
    $script:Journal.entries+=,@{type='registry';target=$Path;name=$Name;existed=[bool]$existed;value=$(if($existed){$item.$Name}else{$null})}; Save-Journal
    if (!(Test-Path -LiteralPath $Path)) { New-Item -Path $Path -Force | Out-Null }
    New-ItemProperty -LiteralPath $Path -Name $Name -Value $Value -PropertyType String -Force | Out-Null
}
function Undo-Transaction {
    if (!$script:Journal) { return }
    $errors=@()
    $entries=@($script:Journal.entries); [array]::Reverse($entries)
    foreach ($row in $entries) {
        try {
            if ($row.type -eq 'tree') {
                $tree=Join-Path $PSScriptRoot 'tree.cjs'
                if ($row.existed) { & $script:Node $tree replace $row.root $row.target $row.backup }
                else { & $script:Node $tree remove $row.root $row.target }
                if ($LASTEXITCODE -ne 0) { throw "Tree rollback failed: $($row.target)" }; continue
            }
            if ($row.type -eq 'registry') {
                if ($row.existed) { New-ItemProperty -LiteralPath $row.target -Name $row.name -Value $row.value -PropertyType String -Force | Out-Null }
                else { Remove-ItemProperty -LiteralPath $row.target -Name $row.name -ErrorAction SilentlyContinue }; continue
            }
            Assert-NoReparse $row.target
            if ($row.existed) {
                if ((Hash $row.backup) -ne $row.hash) { throw "Backup damaged: $($row.target)" }
                Copy-Item -LiteralPath $row.backup -Destination $row.target -Force
                if ((Hash $row.target) -ne $row.hash) { throw "Rollback mismatch: $($row.target)" }
            } elseif (Test-Path -LiteralPath $row.target -PathType Leaf) { Remove-Item -LiteralPath $row.target -Force }
        } catch { $errors+=$_.Exception.Message }
    }
    $script:Journal.state=if($errors.Count){'ROLLBACK_FAILED'}else{'ROLLED_BACK'}; Save-Journal
    if ($errors.Count) { throw ($errors -join '; ') }
    Say '[ROLLBACK] PASS: changed files and registered values restored.'
}
function Recover-Interrupted {
    $base=Join-Path $script:Root 'backup'
    if (!(Test-Path -LiteralPath $base)) { return }
    foreach ($folder in @(Get-ChildItem -LiteralPath $base -Directory)) {
        $journalPath=Join-Path $folder.FullName 'transaction.json'
        if(!(Test-Path -LiteralPath $journalPath)){continue}
        $j=Read-Json $journalPath
        if ($j.state -in @('APPLYING','ROLLBACK_FAILED')) { $script:Journal=$j; Undo-Transaction }
    }
    $script:Journal=$null
}
