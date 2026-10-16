function Expected-Settings($Paths) {
    $settings=Read-Json (Join-Path $script:Root 'payload\settings\settings.json')
    $settings['jellyCursor.workbenchHtmlPath']=$Paths.workbench.Replace('\','/')
    $settings['terminal.integrated.profiles.windows']['Git Bash']['path']=$script:GitBash
    return $settings
}
function Configure-Target($Paths) {
    $target=Join-Path $Paths.user 'settings.json'
    $map=@{}; if(Test-Path -LiteralPath $target){$map=Read-Json $target}
    Merge-Map $map (Expected-Settings $Paths)
    Put-Text $target (Json-Text $map) 'settings'
    $keyPath=Join-Path $Paths.user 'keybindings.json'; $keys=@()
    if(Test-Path -LiteralPath $keyPath){$keys=@(Read-Json $keyPath)}
    $sourceKeys=@(Read-Json (Join-Path $script:Root 'payload\keybindings\keybindings.json'))
    foreach($source in $sourceKeys){
        # Source wins the same key+when slot, preserving unrelated target shortcuts.
        $keys=@($keys | Where-Object { !($_.key -eq $source.key -and $_.when -eq $source.when -and ($_.command -eq $source.command -or (!$_.command.StartsWith('-') -and !$source.command.StartsWith('-')))) })
        $keys+=,$source
    }
    Put-Text $keyPath (Json-Text @($keys)) 'keybindings'
    $snippets=Join-Path $script:Root 'payload\snippets'
    if(Test-Path -LiteralPath $snippets){foreach($f in Get-ChildItem -LiteralPath $snippets -Recurse -File){Put-File $f.FullName (Resolve-Under (Join-Path $Paths.user 'snippets') $f.FullName.Substring($snippets.Length).TrimStart('\')) 'snippets'}}
    $gemini=Join-Path $script:Root 'payload\gemini'
    $geminiManifest=Read-Json (Join-Path $script:Root 'manifests\gemini-files-manifest.json')
    foreach($rel in $geminiManifest.files){Put-File (Resolve-Under $gemini $rel) (Resolve-Under $Paths.gemini $rel) 'gemini'}
    # Do not activate MCP servers with placeholder credentials. Preserve existing target credentials/configuration.
    Put-File (Join-Path $gemini 'mcp-template.json') (Join-Path $Paths.gemini 'config\portable-mcp-template.json') 'mcp-template'
    $argvPath=Join-Path (Split-Path -Parent $Paths.extensions) 'argv.json'; $argv=@{}
    if(Test-Path -LiteralPath $argvPath){$argv=Read-Json $argvPath}
    Merge-Map $argv (Read-Json (Join-Path $script:Root 'payload\settings\argv.json'))
    Put-Text $argvPath (Json-Text $argv) 'argv-locale'
    # SQLite contains credentials: modify only the allowlisted extension enablement key, never export the DB.
    $db=Join-Path $Paths.user 'globalStorage\state.vscdb'
    if(Test-Path -LiteralPath $db){
        Backup-File $db 'extension-enablement'
        foreach($suffix in @('-wal','-shm')){if(Test-Path -LiteralPath ($db+$suffix)){throw 'SQLite still has a WAL/SHM file. Close all IDE processes and rerun before editing extension state.'}}
    }else{Backup-File $db 'extension-enablement';[IO.Directory]::CreateDirectory((Split-Path -Parent $db))|Out-Null}
    & $script:Node (Join-Path $PSScriptRoot 'extension-state.cjs') $db (Join-Path $script:Root 'manifests\source-manifest.json') (Join-Path $script:Root 'manifests\extensions-manifest.json')
    if($LASTEXITCODE -ne 0){throw 'Extension enablement migration failed.'}
    & $script:Node (Join-Path $PSScriptRoot 'ui-state.cjs') $db (Join-Path $script:Root 'payload\settings\ui-state.json')
    if($LASTEXITCODE -ne 0){throw 'Allowlisted panel and view layout migration failed.'}
}
