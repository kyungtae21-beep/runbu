import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {readdir} from 'node:fs/promises';
import {postgresOptions} from './crew-postgres.mjs';

test('Vercel API adapts parsed JSON, keeps same shared DB, and does not fall back to temporary storage',async()=>{
 const db=new PGlite(),OriginalPool=pg.Pool,oldURL=process.env.DATABASE_URL;let pools=0;
 const query=async(sql,params)=>{if(sql.includes('CREATE SCHEMA')){await db.exec(sql);return {rows:[],rowCount:0};}const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??0};};
 pg.Pool=class{constructor(){pools++;}on(){}query(...args){return query(...args);}async connect(){return {query,release(){}};}async end(){}};
 try{
 const {default:handler}=await import('./api/[...path].js');
 async function call(url,method='GET',body){let status,raw;const res={headersSent:false,writeHead(code){status=code;this.headersSent=true;},end(value){raw=value;}};await handler({url,method,headers:{host:'runbu.example',origin:'https://runbu.example'},...(body===undefined?{}:{body})},res);return {status,data:JSON.parse(raw)};}
 delete process.env.DATABASE_URL;assert.equal((await call('/api/races')).status,503);assert.equal(pools,0);
 process.env.DATABASE_URL='postgresql://localhost/runbu_test';const members=(await call('/api/members')).data.members;assert.equal(members.length,7);
 const member=members[0].id;assert.equal((await call('/api/runs','POST',{member,date:'2026-01-01',km:5})).status,200);assert.equal((await call('/api/board?month=2026-01')).data.members[0].runs[0].km,5);
 const race={member,name:'서버리스 대회',date:'2026-01-01',km:10,location:'서울',goal:'01:00:00',note:''};assert.equal((await call('/api/races','POST',race)).status,200);const row=(await call('/api/races')).data.races[0];assert.equal(row.memberName,'박경태');assert.equal((await call('/api/races/'+row.id+'/result','POST',{member,result:'00:59:00',note:''})).status,200);assert.equal((await call('/api/races')).data.races[0].result,'00:59:00');assert.equal(pools,1);
 }finally{pg.Pool=OriginalPool;if(oldURL===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldURL;await db.close();}
});

test('inline CA trust is preserved for remote database connections',()=>{
 const oldInline=process.env.PGSSLROOTCERT_CONTENT,oldFile=process.env.PGSSLROOTCERT;
 try{process.env.PGSSLROOTCERT_CONTENT='test-ca\\nsecond-line';process.env.PGSSLROOTCERT='/missing-file-should-not-be-read';const options=postgresOptions('postgresql://u:p@example.com/db?sslmode=no-verify');assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.ca,'test-ca\nsecond-line');assert.ok(!options.connectionString.includes('sslmode'));}finally{if(oldInline===undefined)delete process.env.PGSSLROOTCERT_CONTENT;else process.env.PGSSLROOTCERT_CONTENT=oldInline;if(oldFile===undefined)delete process.env.PGSSLROOTCERT;else process.env.PGSSLROOTCERT=oldFile;}
});

test('static output contains only public browser assets',async()=>{
 await import('./scripts/build-static.mjs');const files=await readdir('public');assert.ok(files.includes('index.html'));assert.ok(files.includes('app.js'));assert.ok(!files.includes('crew-api.mjs'));assert.ok(!files.includes('crew-postgres.mjs'));assert.ok(!files.includes('package.json'));assert.equal(files.length,9);
});
