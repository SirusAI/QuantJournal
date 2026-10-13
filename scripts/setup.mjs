import {mkdirSync,existsSync,copyFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.local',{recursive:true});
if(!existsSync('.env'))copyFileSync('.env.example','.env');
// Prisma 5's SQLite schema engine needs the file to exist on some Windows hosts.
if(!existsSync('.local/journal.db'))writeFileSync('.local/journal.db','',{flag:'wx'});
for(const args of [['generate'],['migrate','deploy']]){
 const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{stdio:'inherit',windowsHide:true});
 if(r.status!==0)process.exit(r.status||1);
}
console.log('Empty local database is ready. Run npm run dev.');
