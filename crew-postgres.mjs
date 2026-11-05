import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mileageHistory2026} from './mileage-history.mjs';

export function postgresOptions(connectionString){
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('DATABASE_URL must be a PostgreSQL connection URL');
 // Enforce certificate verification even if a pasted URI requests weaker SSL.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 return {connectionString:url.toString(),max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,ssl:local?false:{rejectUnauthorized:true,...(process.env.PGSSLROOTCERT?{ca:readFileSync(process.env.PGSSLROOTCERT,'utf8')}:{})}};
}
export async function createPostgresStore(connectionString,{pool:providedPool}={}){
 const pool=providedPool||new pg.Pool(postgresOptions(connectionString));
 pool.on?.('error',()=>console.error('PostgreSQL idle connection error; check database availability.'));
 try{
 const client=await pool.connect();
 try{
 await client.query('BEGIN');
 // Serialize concurrent initializers. All tables are private to the application.
 await client.query('SELECT pg_advisory_xact_lock(726862001)');
 await client.query(`CREATE SCHEMA IF NOT EXISTS runbu;
 CREATE TABLE IF NOT EXISTS runbu.crew_roster(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,position INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS runbu.monthly_history(name TEXT NOT NULL,month TEXT NOT NULL,km DOUBLE PRECISION,goal DOUBLE PRECISION NOT NULL,PRIMARY KEY(name,month));
 CREATE TABLE IF NOT EXISTS runbu.crew_runs(id TEXT PRIMARY KEY,member TEXT NOT NULL REFERENCES runbu.crew_roster(id),date TEXT NOT NULL,km DOUBLE PRECISION NOT NULL CHECK(km>0 AND km<=500));
 CREATE TABLE IF NOT EXISTS runbu.crew_goals(member TEXT NOT NULL REFERENCES runbu.crew_roster(id),month TEXT NOT NULL,km DOUBLE PRECISION NOT NULL CHECK(km>0 AND km<=10000),PRIMARY KEY(member,month));
 CREATE INDEX IF NOT EXISTS crew_runs_member_date ON runbu.crew_runs(member,date);
 ALTER TABLE runbu.crew_roster ENABLE ROW LEVEL SECURITY;
 ALTER TABLE runbu.monthly_history ENABLE ROW LEVEL SECURITY;
 ALTER TABLE runbu.crew_runs ENABLE ROW LEVEL SECURITY;
 ALTER TABLE runbu.crew_goals ENABLE ROW LEVEL SECURITY;`);
 const names=[...new Set(mileageHistory2026.map(r=>r.name))];
 for(const [i,name] of names.entries())await client.query('INSERT INTO runbu.crew_roster VALUES($1,$2,$3) ON CONFLICT DO NOTHING',['crew-'+(i+1),name,i]);
 for(const row of mileageHistory2026)await client.query('INSERT INTO runbu.monthly_history VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[row.name,row.month,row.km,row.goal]);
 await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){await pool.end();throw error;}
 return {
 async roster(){return (await pool.query('SELECT id,name FROM runbu.crew_roster ORDER BY position')).rows;},
 async publicBoard(month){
 const client=await pool.connect();try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const members=(await client.query('SELECT id,name FROM runbu.crew_roster ORDER BY position')).rows;
 const histories=(await client.query('SELECT name,km,goal FROM runbu.monthly_history WHERE month=$1',[month])).rows;
 const runs=(await client.query('SELECT id,member,date,km FROM runbu.crew_runs WHERE substr(date,1,7)=$1 ORDER BY date DESC,id',[month])).rows;
 const goals=(await client.query('SELECT member,km FROM runbu.crew_goals WHERE month=$1',[month])).rows;
 const defaults=(await client.query('SELECT DISTINCT ON(name) name,goal FROM runbu.monthly_history ORDER BY name,month DESC')).rows;
 await client.query('COMMIT');
 return members.map(m=>{const history=histories.find(h=>h.name===m.name),ownRuns=runs.filter(r=>r.member===m.id).map(({member,...r})=>r);return {...m,runs:ownRuns,goal:goals.find(g=>g.member===m.id)?.km??history?.goal??defaults.find(g=>g.name===m.name)?.goal??0,historical:!!history,monthlyTotal:history?(history.km===null&&!ownRuns.length?null:(history.km??0)+ownRuns.reduce((s,r)=>s+r.km,0)):null,baseline:history?.km??null};});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 },
 async savePublicRun(member,id,date,km){if(id)return (await pool.query('UPDATE runbu.crew_runs SET date=$1,km=$2 WHERE id=$3 AND member=$4',[date,km,id,member])).rowCount>0;await pool.query('INSERT INTO runbu.crew_runs VALUES($1,$2,$3,$4)',[randomBytes(16).toString('hex'),member,date,km]);return true;},
 async deletePublicRun(member,id){return (await pool.query('DELETE FROM runbu.crew_runs WHERE id=$1 AND member=$2',[id,member])).rowCount>0;},
 async publicGoal(member,month,km){await pool.query('INSERT INTO runbu.crew_goals VALUES($1,$2,$3) ON CONFLICT(member,month) DO UPDATE SET km=excluded.km',[member,month,km]);},
 async close(){await pool.end();}
 };
}
