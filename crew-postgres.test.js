import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresStore,postgresOptions} from './crew-postgres.mjs';
import assert from 'node:assert/strict';
test('PostgreSQL storage preserves history, edits and goals on reinitialization',async()=>{
const db=new PGlite();
const query=async(sql,params)=>{
 // pg supports multi-statement schema initialization; PGlite exposes it via exec.
 if(sql.includes('CREATE SCHEMA')){await db.exec(sql);return {rows:[],rowCount:0};}
 const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??0};
};
const pool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
try{
 let store=await createPostgresStore('postgresql://unused',{pool});
 assert.equal((await store.roster()).length,7);let board=await store.publicBoard('2026-10');assert.equal(board[0].monthlyTotal,200);assert.equal(board.find(m=>m.name==='장경자').monthlyTotal,null);assert.equal(board.reduce((s,r)=>s+(r.monthlyTotal??0),0),417);
 const member=board[0].id;await store.savePublicRun(member,null,'2026-11-01',5.5);await store.publicGoal(member,'2026-11',300);board=await store.publicBoard('2026-11');assert.equal(board[0].goal,300);assert.equal(board[0].runs[0].km,5.5);const id=board[0].runs[0].id;assert.equal(await store.savePublicRun(board[1].id,id,'2026-11-02',8),false);assert.equal(await store.deletePublicRun(board[1].id,id),false);assert.equal(await store.savePublicRun(member,id,'2026-11-02',8),true);
 store=await createPostgresStore('postgresql://unused',{pool});board=await store.publicBoard('2026-11');assert.equal(board.length,7);assert.equal(board[0].runs[0].km,8);assert.equal(board[0].goal,300);assert.equal(await store.deletePublicRun(member,id),true);assert.equal((await db.query('SELECT count(*)::integer n FROM runbu.monthly_history')).rows[0].n,70);
 const options=postgresOptions('postgresql://user:password@example.com:5432/db?sslmode=require');assert.equal(options.ssl.rejectUnauthorized,true);assert.ok(!options.connectionString.includes('sslmode'));assert.equal(postgresOptions('postgresql://localhost/db').ssl,false);
 const race={name:'서울 하프',date:'2027-03-01',km:21.1,location:'서울',goal:'02:00',result:'',note:'크루와 함께'};
 await store.saveRace(member,null,race);let saved=(await store.listRaces())[0];assert.equal(saved.memberName,'박경태');assert.equal(saved.name,race.name);assert.equal(await store.saveRace('crew-2',saved.id,race),false);assert.equal(await store.deleteRace('crew-2',saved.id),false);
 assert.equal(await store.saveRace(member,saved.id,{...race,location:'서울 잠실'}),true);
 store=await createPostgresStore('postgresql://unused',{pool});assert.equal((await store.listRaces())[0].location,'서울 잠실');assert.equal(await store.saveRaceResult(member,saved.id,'01:59:01','완주','2027-02-28'),false);assert.equal(await store.saveRaceResult('crew-2',saved.id,'01:59:01','완주','2027-03-01'),false);assert.equal(await store.saveRaceResult(member,saved.id,'01:59:01','완주','2027-03-01'),true);assert.equal((await store.listRaces())[0].goal,'02:00');assert.equal((await store.listRaces())[0].result,'01:59:01');assert.equal(await store.saveRaceResult(member,saved.id,'','기록 삭제','2027-03-01'),true);assert.equal((await store.listRaces())[0].result,'');assert.equal(await store.deleteRace(member,saved.id),true);assert.equal((await store.listRaces()).length,0);
 await db.query("DELETE FROM runbu.app_migrations WHERE id='2026-10-park-final-200'");await db.query("UPDATE runbu.monthly_history SET km=151 WHERE name='박경태' AND month='2026-10'");
 store=await createPostgresStore('postgresql://unused',{pool});assert.equal((await store.publicBoard('2026-10'))[0].monthlyTotal,200);
 await db.query("UPDATE runbu.monthly_history SET km=201 WHERE name='박경태' AND month='2026-10'");
 store=await createPostgresStore('postgresql://unused',{pool});assert.equal((await store.publicBoard('2026-10'))[0].monthlyTotal,201);assert.deepEqual((await store.roster()).map(m=>m.name),['박경태','홍곤표','설미경','도은진','장경자','김애진','이시광']);
 console.log('PASS: real PostgreSQL engine schema/seed, 7 members, 70 histories, nulls, goals, CRUD, ownership, repeat initialization, TLS policy');
}finally{await db.close();}

});
