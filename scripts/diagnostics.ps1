function Show-Diagnostics {
    $profile=Get-Preflight
    Say (Json-Text $profile)
    Say 'Verified compatibility profile:'
    Say (Json-Text (Read-Json (Join-Path $script:Root 'manifests\compatibility.json')))
    Say 'Source component versions and state:'
    Say (Json-Text (Read-Json (Join-Path $script:Root 'manifests\extensions-manifest.json')))
    Say 'MCP: two local servers installed and tested automatically. GitHub requires a target credential. No secret value is printed.'
    if($profile.ide){
        $script:Node=Find-Node;$script:GitBash=Find-GitBash
        $null=Test-Target (Target-Paths $profile.ide)
    }
    Say 'READ-ONLY: diagnostics did not install, repair, download, write logs or edit target files.'
}
