import {mkdir,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),output=new URL('../public/',import.meta.url);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const files=['index.html','styles.css','app.js','crew.js','shared-races.js','race-records.js','crew-order.js','logic.js','weather.js'];
for(const file of files)await copyFile(new URL(file,root),new URL(file,output));
console.log('Built '+files.length+' public assets in '+fileURLToPath(output));
