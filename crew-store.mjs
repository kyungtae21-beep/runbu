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
 const safe=m=>m&&({id:m.id,name:m.name});
 return {
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
