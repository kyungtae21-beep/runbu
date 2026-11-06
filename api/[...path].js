import {Readable} from 'node:stream';
import {crewAPI} from '../crew-api.mjs';
let initialization;
// Reuse the PostgreSQL pool in each warm function instance, retry failed initialization.
export default async function handler(req,res){
 if(!process.env.DATABASE_URL){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'서버의 DATABASE_URL 설정이 필요합니다.'}));return;}
 try{
 initialization??=crewAPI().catch(error=>{initialization=undefined;throw error;});
 const handle=await initialization;
 // Vercel may parse JSON before invoking the Node function. Adapt without
 // mutating or depending on its already-consumed request stream.
 let request=req;
 if(req.body!==undefined){const body=typeof req.body==='string'?req.body:Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body);request=Readable.from([body]);request.url=req.url;request.method=req.method;request.headers=req.headers;}
 if(!await handle(request,res)){res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'지원하지 않는 API입니다.'}));}
 }catch(error){const code=typeof error.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'UNKNOWN';console.error('RUNBU serverless database error code: '+code);if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'데이터베이스 연결을 확인해 주세요. 잠시 후 다시 시도해 주세요.'}));}
}
