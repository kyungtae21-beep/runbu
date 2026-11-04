import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/logic.js':['logic.js','text/javascript; charset=utf-8'],'/weather.js':['weather.js','text/javascript; charset=utf-8']};
http.createServer(async(req,res)=>{const f=files[new URL(req.url,'http://localhost').pathname];if(!f){res.writeHead(404);return res.end('Not found');}try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1]});res.end(data);}catch{res.writeHead(500);res.end('Server error');}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('RUNBU ready on port '+(process.env.PORT||3000)));
