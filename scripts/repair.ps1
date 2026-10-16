function Assert-Workbench($Paths) {
    $compat=Read-Json (Join-Path $script:Root 'manifests\compatibility.json')
    $product=Read-Json (Join-Path $Paths.install 'resources\app\product.json')
    if($product.commit -ne $compat.commit){throw 'Unknown IDE build. Workbench not patched.'}
    $html=[IO.File]::ReadAllText($Paths.workbench)
    $clean=[regex]::Replace($html,'\s*<!-- MANSUR_JELLY_CURSOR_PATCH -->\s*<!-- jelly-cursor:start -->[\s\S]*?<!-- jelly-cursor:end -->\s*',"`n").Trim()
    $sha=[Security.Cryptography.SHA256]::Create()
    try{$digest=[BitConverter]::ToString($sha.ComputeHash($script:Utf8.GetBytes($clean))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
    if($digest -ne $compat.cleanWorkbenchNormalizedSha256){throw 'Unknown workbench content. No blind injection.'}
    if([regex]::Matches($html,'<script[^>]*src=["'']\./jelly-cursor\.js["'']').Count -gt 1){throw 'Duplicate Jelly injection detected; requires review.'}
}
function Install-Repair($Paths) {
    Assert-Workbench $Paths
    $effect=Join-Path $script:Root 'payload\effects\jelly-cursor.js'
    Put-File $effect (Join-Path (Split-Path -Parent $Paths.workbench) 'jelly-cursor.js') 'jelly-effect'
    Put-File $effect (Join-Path $Paths.repair 'jelly-cursor.template.js') 'jelly-template'
    Put-File (Join-Path $script:Root 'payload\scripts\checkAndRepairJellyCursor.js') (Join-Path $Paths.repair 'checkAndRepairJellyCursor.js') 'repair'
    Put-File (Join-Path $script:Root 'manifests\compatibility.json') (Join-Path $Paths.repair 'compatibility.json') 'repair-compatibility'
    Put-Text (Join-Path $Paths.repair 'deployment.json') (Json-Text @{ideRoot=$Paths.install;userData=$Paths.data}) 'repair-paths'
    $html=[IO.File]::ReadAllText($Paths.workbench)
    $marker='<!-- MANSUR_JELLY_CURSOR_PATCH -->'
    if(!$html.Contains($marker)){
        $block=$marker+"`n"+'<!-- jelly-cursor:start --><script src="./jelly-cursor.js"></script><!-- jelly-cursor:end -->'
        $html=$html.Replace('</html>',$block+"`n</html>")
        Put-Text $Paths.workbench $html 'workbench'
    }
    $cmd="@echo off`r`nsetlocal`r`nnode `"%~dp0checkAndRepairJellyCursor.js`"`r`nset `"RESULT=%ERRORLEVEL%`"`r`nif not `"%RESULT%`"==`"0`" pause`r`nexit /b %RESULT%`r`n"
    Put-Text (Join-Path $Paths.repair 'repair-ripple.cmd') $cmd 'repair-launcher'
}
