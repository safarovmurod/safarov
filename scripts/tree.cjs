const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [action,root,target,source]=process.argv.slice(2);
function safe(file){const resolved=path.resolve(file),base=path.resolve(root);if(!resolved.toLowerCase().startsWith(base.toLowerCase()+path.sep))throw Error('Tree target escapes authorized root');let p=resolved;while(p!==path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Reparse point refused');p=path.dirname(p)}return resolved}
function inventory(dir){const rows=[];if(!fs.existsSync(dir))return null;function walk(at){for(const name of fs.readdirSync(at).sort()){const file=path.join(at,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Reparse point refused');if(stat.isDirectory())walk(file);else if(stat.isFile())rows.push([path.relative(dir,file),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])}}walk(dir);return JSON.stringify(rows)}
const dest=safe(target);
if(action==='compare'){process.exitCode=inventory(dest)===inventory(source)?0:3}
else if(action==='copy'){fs.cpSync(source,dest,{recursive:true,force:true});if(inventory(dest)!==inventory(source))throw Error('Tree copy checksum mismatch')}
else if(action==='replace'){if(fs.existsSync(dest))fs.rmSync(dest,{recursive:true});fs.cpSync(source,dest,{recursive:true});if(inventory(dest)!==inventory(source))throw Error('Tree replacement checksum mismatch')}
else if(action==='remove'){if(fs.existsSync(dest))fs.rmSync(dest,{recursive:true})}
else if(action==='hash'){console.log(crypto.createHash('sha256').update(inventory(dest)||'null').digest('hex'))}
else if(action==='verify-files'){
 const manifest=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
 const actual=new Map(JSON.parse(inventory(dest)).map(([file,hash])=>[file.split(path.sep).join('/'),hash]));
 if(actual.size!==Object.keys(manifest.files).length)throw Error('Runtime file count mismatch');
 for(const [file,hash] of Object.entries(manifest.files))if(actual.get(file)!==hash)throw Error('Runtime integrity mismatch: '+file);
}
else if(action==='verify-public'){
 const manifest=JSON.parse(fs.readFileSync(source,'utf8'));
 const registry=JSON.parse(fs.readFileSync(path.join(dest,'extensions.json'),'utf8'));
 for(const entry of manifest){
  const registered=registry.filter(r=>r.identifier.id.toLowerCase()===entry.id.toLowerCase());
  if(registered.length!==1)throw Error('Registry mismatch '+entry.id);
  const folder=path.resolve(dest,registered[0].relativeLocation);
  if(!folder.toLowerCase().startsWith(dest.toLowerCase()+path.sep))throw Error('Invalid extension folder');
  for(const file of entry.files){
   const targetFile=path.resolve(folder,file.path);
   if(!targetFile.toLowerCase().startsWith(folder.toLowerCase()+path.sep))throw Error('Invalid public-file path');
   const hash=crypto.createHash('sha256').update(fs.readFileSync(targetFile)).digest('hex');
   if(hash!==file.sha256)throw Error('Public runtime integrity mismatch '+entry.id+'/'+file.path);
  }
 }
}
else throw Error('Unknown tree operation');
