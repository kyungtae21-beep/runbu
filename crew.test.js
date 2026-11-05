import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCrewStore} from './crew-store.mjs';
test('crew records persist and members can only change their own records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'runbu-test-'));const path=join(dir,'crew.sqlite');let store=createCrewStore(path);
 try{const a=store.register('가','a@example.com','password1234'),b=store.register('나','b@example.com','password5678');assert.equal(store.login('a@example.com','wrong'),null);assert.equal(store.login('a@example.com','password1234').id,a.id);const token=store.session(a);assert.equal(store.member(token).id,a.id);store.goal(a.id,'2026-11',100);store.saveRun(a.id,null,'2026-11-01',5.5);store.saveRun(a.id,null,'2026-11-01',4.5);store.saveRun(b.id,null,'2026-10-01',7);let board=store.board('2026-11');const runs=board.find(m=>m.id===a.id).runs;assert.equal(runs.reduce((n,r)=>n+r.km,0),10);assert.equal(board.find(m=>m.id===b.id).runs.length,0);assert.equal(store.saveRun(b.id,runs[0].id,'2026-11-02',99),false);assert.equal(store.deleteRun(b.id,runs[0].id),false);assert.equal(store.saveRun(a.id,runs[0].id,'2026-11-02',8),true);store.close();store=createCrewStore(path);assert.equal(store.board('2026-11').find(m=>m.id===a.id).goal,100);assert.equal(store.member(token).id,a.id);assert.ok(store.deleteRun(a.id,runs[0].id));store.logout(token);assert.equal(store.member(token),undefined);assert.ok(!JSON.stringify(store.board('2026-11')).includes('example.com'));}finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('2026 historical mileage preserves 70 monthly rows, unknown distances and monthly-only provenance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'runbu-history-'));const path=join(dir,'crew.sqlite');let store=createCrewStore(path);
 try{
 const expected=[505,475,269,272,278,273,241,336,352,368];let missing=0;
 for(let i=1;i<=10;i++){
 const board=store.board(`2026-${String(i).padStart(2,'0')}`);assert.equal(board.length,7);assert.equal(board.reduce((s,m)=>s+(m.monthlyTotal??0),0),expected[i-1]);
 for(const row of board){assert.equal(row.historical,true);assert.deepEqual(row.runs,[]);assert.ok(row.goal>0);if(row.monthlyTotal===null)missing++;}
 }
 assert.equal(missing,28);const october=store.board('2026-10');assert.equal(october.find(m=>m.name==='설미경').monthlyTotal,127);assert.equal(october.find(m=>m.name==='박경태').goal,280);assert.equal(store.board('2026-11').length,0);
 // A matching nickname is not sufficient proof of ownership of a historical identity.
 const member=store.register('박경태','new@example.com','password1234');store.saveRun(member.id,null,'2026-10-01',5);assert.equal(store.board('2026-10').filter(m=>m.name==='박경태').length,2);
 store.close();store=createCrewStore(path);assert.equal(store.board('2026-10').filter(m=>m.historical).length,7);assert.equal(store.board('2026-10').find(m=>m.id===member.id).runs[0].km,5);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('pre-registered public roster links monthly history and persists new distances without signup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'runbu-public-'));const path=join(dir,'crew.sqlite');let store=createCrewStore(path);
 try{
 assert.deepEqual(store.roster().map(m=>m.name),['박경태','장경자','김애진','이시광','홍곤표','설미경','도은진']);
 const a=store.roster()[0],b=store.roster()[1];assert.equal(store.publicBoard('2026-10').length,7);assert.equal(store.publicBoard('2026-10')[0].monthlyTotal,151);assert.equal(store.publicBoard('2026-10')[1].monthlyTotal,null);assert.equal(store.publicBoard('2026-11')[0].goal,280);
 store.savePublicRun(a.id,null,'2026-11-01',5);store.savePublicRun(a.id,null,'2026-11-01',3.5);store.publicGoal(a.id,'2026-11',300);
 const run=store.publicBoard('2026-11')[0].runs[0];assert.equal(store.savePublicRun(b.id,run.id,'2026-11-02',20),false);assert.equal(store.deletePublicRun(b.id,run.id),false);assert.equal(store.savePublicRun(a.id,run.id,'2026-11-02',6),true);
 store.savePublicRun(a.id,null,'2026-10-31',2);assert.equal(store.publicBoard('2026-10')[0].monthlyTotal,153);store.close();store=createCrewStore(path);assert.equal(store.roster().length,7);assert.equal(store.publicBoard('2026-11')[0].goal,300);assert.equal(store.publicBoard('2026-11')[0].runs.length,2);assert.ok(store.deletePublicRun(a.id,run.id));
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
