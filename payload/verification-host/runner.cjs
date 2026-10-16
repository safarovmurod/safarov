const vscode=require('vscode'),fs=require('fs'),path=require('path'),crypto=require('crypto');
exports.run=async function(){
 const results=[];
 const live=require('./live-probes.cjs');
 const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'})}catch(error){results.push({name,status:'FAIL',reason:error.message})}};
 let state;
 await check('Prepare isolated runtime verification workspace',async()=>{state=await live.prepare()});
 for(const id of ['mansur.mansur-inline-autocomplete','mansur.runtime-monitor','mansur.ai-structure-reviewer','iranon.jelly-cursor','vscode.typescript-language-features']){
  try{const ext=vscode.extensions.getExtension(id);if(!ext)throw Error('Not registered');await ext.activate();if(!ext.isActive)throw Error('Not active');results.push({name:id,status:'PASS',version:ext.packageJSON.version})}
  catch(e){results.push({name:id,status:'FAIL',reason:e.message})}
 }
 for(const language of ['typescript','typescriptreact']){
  const doc=await vscode.workspace.openTextDocument({language,content:language==='typescript'?'const probe: number = 1;':'export function Probe() { return <div />; }'});
  await vscode.window.showTextDocument(doc);
  results.push({name:language+' document',status:doc.languageId===language?'PASS':'FAIL'});
 }
 const commands=await vscode.commands.getCommands(true);
 for(const command of ['runtimeMonitor.connect','runtimeConsole.clear','runtimeRequests.reload','aiStructureReviewer.refresh','jellyCursor.showStatus'])results.push({name:command,status:commands.includes(command)?'PASS':'FAIL'});
 try {
  await check('Live renderer probe execution',async()=>{await live.visual(check)});
  if(state)await check('Live Runtime Monitor probe execution',async()=>{await live.monitor(state,check)});
 }finally{await live.cleanup(state)}
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const report={checks:results,createdAt:new Date().toISOString(),settingsHash:hash(process.env.PORTABLE_SETTINGS_FILE),workbenchHash:hash(process.env.PORTABLE_WORKBENCH_FILE)};
 if(!process.env.PORTABLE_TEST_REPORT)throw Error('Verification output path not configured');
 fs.writeFileSync(process.env.PORTABLE_TEST_REPORT,JSON.stringify(report,null,2));
 if(results.some(r=>r.status==='FAIL'))throw Error('Extension host verification failed');
};
