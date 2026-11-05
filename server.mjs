import {crewAPI} from './crew-api.mjs';
let handleCrew;
try{handleCrew=await crewAPI();}catch(error){const code=typeof error.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'UNKNOWN';console.error('RUNBU database error code: '+code);console.error('RUNBU database initialization failed. Check DATABASE_URL, database password, Session pooler host/port, and TLS certificate trust.');process.exit(1);}
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/shared-races.js':['shared-races.js','text/javascript; charset=utf-8'],'/crew.js':['crew.js','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/logic.js':['logic.js','text/javascript; charset=utf-8'],'/weather.js':['weather.js','text/javascript; charset=utf-8']};
http.createServer(async(req,res)=>{if(await handleCrew(req,res))return;const f=files[new URL(req.url,'http://localhost').pathname];if(!f){res.writeHead(404);return res.end('Not found');}try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1]});res.end(data);}catch{res.writeHead(500);res.end('Server error');}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('RUNBU ready on port '+(process.env.PORT||3000)));
