import {orderedCrew} from './crew-order.js';
import {mileageHistory2026} from './mileage-history.mjs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function createCrewStore(path){
 mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,member TEXT REFERENCES members(id),expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,member TEXT NOT NULL REFERENCES members(id),date TEXT NOT NULL,km REAL NOT NULL); CREATE TABLE IF NOT EXISTS goals(member TEXT REFERENCES members(id),month TEXT,km REAL NOT NULL,PRIMARY KEY(member,month));`);
 db.exec('CREATE TABLE IF NOT EXISTS monthly_history(name TEXT NOT NULL,month TEXT NOT NULL,km REAL,goal REAL NOT NULL,PRIMARY KEY(name,month));');
 const insertHistory=db.prepare('INSERT INTO monthly_history(name,month,km,goal) VALUES(?,?,?,?) ON CONFLICT(name,month) DO NOTHING');
 db.exec('BEGIN');try{for(const row of mileageHistory2026)insertHistory.run(row.name,row.month,row.km,row.goal);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');db.close();throw error;}
 db.exec(`CREATE TABLE IF NOT EXISTS crew_roster(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL);CREATE TABLE IF NOT EXISTS crew_runs(id TEXT PRIMARY KEY,member TEXT REFERENCES crew_roster(id),date TEXT NOT NULL,km REAL NOT NULL);CREATE TABLE IF NOT EXISTS crew_goals(member TEXT REFERENCES crew_roster(id),month TEXT NOT NULL,km REAL NOT NULL,PRIMARY KEY(member,month));`);
 db.exec('CREATE TABLE IF NOT EXISTS crew_races(id TEXT PRIMARY KEY,member TEXT NOT NULL REFERENCES crew_roster(id),payload TEXT NOT NULL);');
 const rosterNames=[...new Set(mileageHistory2026.map(r=>r.name))];
 const addRoster=db.prepare('INSERT INTO crew_roster VALUES(?,?) ON CONFLICT(name) DO NOTHING');
 for(const [i,name] of rosterNames.entries())addRoster.run('crew-'+(i+1),name);
 db.exec('CREATE TABLE IF NOT EXISTS app_migrations(id TEXT PRIMARY KEY);');
 db.exec('BEGIN');try{
 if(!db.prepare('SELECT id FROM app_migrations WHERE id=?').get('2026-10-park-final-200')){
 db.prepare('UPDATE monthly_history SET km=200 WHERE name=? AND month=?').run('박경태','2026-10');
 db.prepare('INSERT INTO app_migrations VALUES(?)').run('2026-10-park-final-200');}
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');db.close();throw error;}
 const safe=m=>m&&({id:m.id,name:m.name});
 return {
 saveRaceResult(member,id,result,note,today){return db.prepare("UPDATE crew_races SET payload=json_set(payload,'$.result',?,'$.note',?) WHERE id=? AND member=? AND json_extract(payload,'$.date')<=?").run(result,note,id,member,today).changes>0;},
 listRaces(){return db.prepare('SELECT r.id,r.member,r.payload,m.name AS memberName FROM crew_races r JOIN crew_roster m ON m.id=r.member').all().map(({payload,...r})=>({...JSON.parse(payload),...r})).sort((a,b)=>a.date.localeCompare(b.date));},
 saveRace(member,id,payload){if(id)return db.prepare('UPDATE crew_races SET payload=? WHERE id=? AND member=?').run(JSON.stringify(payload),id,member).changes>0;db.prepare('INSERT INTO crew_races VALUES(?,?,?)').run(randomBytes(16).toString('hex'),member,JSON.stringify(payload));return true;},
 deleteRace(member,id){return db.prepare('DELETE FROM crew_races WHERE id=? AND member=?').run(id,member).changes>0;},

 roster(){return orderedCrew(db.prepare('SELECT id,name FROM crew_roster ORDER BY rowid').all());},
 publicBoard(month){return orderedCrew(db.prepare('SELECT id,name FROM crew_roster ORDER BY rowid').all()).map(m=>{
 const history=db.prepare('SELECT km,goal FROM monthly_history WHERE name=? AND month=?').get(m.name,month);
 const runs=db.prepare('SELECT id,date,km FROM crew_runs WHERE member=? AND substr(date,1,7)=? ORDER BY date DESC,id').all(m.id,month);
 const fallback=db.prepare('SELECT goal FROM monthly_history WHERE name=? ORDER BY month DESC LIMIT 1').get(m.name)?.goal||0;
 return {...m,runs,goal:db.prepare('SELECT km FROM crew_goals WHERE member=? AND month=?').get(m.id,month)?.km??history?.goal??fallback,historical:!!history,monthlyTotal:history?(history.km===null&&!runs.length?null:(history.km??0)+runs.reduce((s,r)=>s+r.km,0)):null,baseline:history?.km??null};});},
 savePublicRun(member,id,date,km){if(id)return db.prepare('UPDATE crew_runs SET date=?,km=? WHERE id=? AND member=?').run(date,km,id,member).changes>0;db.prepare('INSERT INTO crew_runs VALUES(?,?,?,?)').run(randomBytes(16).toString('hex'),member,date,km);return true;},
 deletePublicRun(member,id){return db.prepare('DELETE FROM crew_runs WHERE id=? AND member=?').run(id,member).changes>0;},
 publicGoal(member,month,km){db.prepare('INSERT INTO crew_goals VALUES(?,?,?) ON CONFLICT(member,month) DO UPDATE SET km=excluded.km').run(member,month,km);},

 register(name,email,password){const salt=randomBytes(16).toString('hex'),id=randomBytes(16).toString('hex');try{db.prepare('INSERT INTO members VALUES(?,?,?,?,?)').run(id,name,email,scryptSync(password,salt,64).toString('hex'),salt);}catch(e){if(e.code?.includes('SQLITE')&&db.prepare('SELECT id FROM members WHERE email=?').get(email))throw Error('이미 가입된 이메일입니다.');throw e;}return {id,name};},
 login(email,password){const m=db.prepare('SELECT * FROM members WHERE email=?').get(email);const actual=scryptSync(password,m?.salt||'dummy-salt',64);return m&&timingSafeEqual(actual,Buffer.from(m.password,'hex'))?safe(m):null;},
 session(m){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),m.id,Date.now()+7*86400000);return token;},
 member(token){return safe(db.prepare('SELECT m.* FROM sessions s JOIN members m ON m.id=s.member WHERE s.token=? AND s.expires>?').get(hash(token),Date.now()));},
 logout(token){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));},
 board(month){const members=db.prepare('SELECT id,name FROM members ORDER BY name').all();return members.map(m=>({...m,runs:db.prepare('SELECT id,date,km FROM runs WHERE member=? AND substr(date,1,7)=? ORDER BY date DESC,id').all(m.id,month),goal:db.prepare('SELECT km FROM goals WHERE member=? AND month=?').get(m.id,month)?.km||0})).concat(db.prepare('SELECT name,km,goal FROM monthly_history WHERE month=? ORDER BY name').all(month).map(row=>({id:'history:'+row.name,name:row.name,runs:[],goal:row.goal,monthlyTotal:row.km,historical:true})));},
 saveRun(member,id,date,km){if(id){const row=db.prepare('SELECT member FROM runs WHERE id=?').get(id);if(!row||row.member!==member)return false;db.prepare('UPDATE runs SET date=?,km=? WHERE id=? AND member=?').run(date,km,id,member);}else db.prepare('INSERT INTO runs VALUES(?,?,?,?)').run(randomBytes(16).toString('hex'),member,date,km);return true;},
 deleteRun(member,id){return db.prepare('DELETE FROM runs WHERE id=? AND member=?').run(id,member).changes>0;},
 goal(member,month,km){db.prepare('INSERT INTO goals VALUES(?,?,?) ON CONFLICT(member,month) DO UPDATE SET km=excluded.km').run(member,month,km);},close(){db.close();}
 };
}
