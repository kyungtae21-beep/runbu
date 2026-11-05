import {raceSeconds,normalizeGoal} from './race-records.js';
import {createPostgresStore} from './crew-postgres.mjs';
import {join} from 'node:path';
export async function crewAPI(){
 const store=process.env.DATABASE_URL?await createPostgresStore(process.env.DATABASE_URL):(await import('./crew-store.mjs')).createCrewStore(process.env.RUNBU_DB_PATH||join(process.env.HOME||'/tmp','.local/share/runbu/crew.sqlite'));
 const validMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'허용되지 않은 요청입니다.'});return true;}
 let data={};if(req.method!=='GET'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){send(413,{error:'입력 크기를 줄여 주세요.'});return true;}}try{data=JSON.parse(raw||'{}');if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{send(400,{error:'잘못된 요청입니다.'});return true;}}
 if(url.pathname==='/api/members'&&req.method==='GET'){send(200,{members:await store.roster()});return true;}
 if(url.pathname==='/api/races'&&req.method==='GET'){send(200,{races:await store.listRaces()});return true;}
 const month=url.searchParams.get('month')||data.month;
 if(url.pathname==='/api/board'&&req.method==='GET'&&validMonth(month)){send(200,{members:await store.publicBoard(month)});return true;}
 if(!['/api/goal','/api/runs','/api/races'].includes(url.pathname)&&!url.pathname.startsWith('/api/runs/')&&!url.pathname.startsWith('/api/races/')){send(404,{error:'지원하지 않는 요청입니다.'});return true;}
 if(!(await store.roster()).some(m=>m.id===data.member)){send(400,{error:'등록된 크루 회원을 선택해 주세요.'});return true;}
 if(/^\/api\/races\/[^/]+\/result$/.test(url.pathname)&&req.method==='POST'){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if((data.result!==''&&raceSeconds(data.result)===null)||typeof data.note!=='string'||data.note.length>500){send(400,{error:'완주 기록은 00:00:01 이상의 시:분:초로 입력해 주세요.'});return true;}
 const ok=await store.saveRaceResult(data.member,url.pathname.split('/')[3],data.result,data.note,today);send(ok?200:404,ok?{ok:true}:{error:'대회 당일부터 선택한 회원의 기록을 입력할 수 있습니다.'});return true;
 }
 if(url.pathname==='/api/races'&&req.method==='POST'){
 const {name,date,location,note=''}=data;const km=Number(data.km);const goal=typeof data.goal==='string'?normalizeGoal(data.goal):'';const existing=data.id?(await store.listRaces()).find(r=>r.id===data.id&&r.member===data.member):null;const result=data.result===undefined?(existing?.result||''):data.result;
 const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!validDate||typeof name!=='string'||!name.trim()||name.length>80||typeof location!=='string'||!location.trim()||location.length>80||![5,10,21.1,42.195].includes(km)||typeof goal!=='string'||(goal&&raceSeconds(goal)===null)||typeof result!=='string'||(result&&(!/^(?!00:00:00$)\d{1,2}:[0-5]\d:[0-5]\d$/.test(result)||date>today))||typeof note!=='string'||note.length>500||(data.id!==undefined&&typeof data.id!=='string')){send(400,{error:'대회 이름·날짜·거리·장소·기록을 확인해 주세요.'});return true;}
 const ok=await store.saveRace(data.member,data.id,{name:name.trim(),date,km,location:location.trim(),goal,result,note});send(ok?200:404,ok?{ok:true}:{error:'선택한 회원의 대회를 찾지 못했습니다.'});return true;
 }
 if(url.pathname.startsWith('/api/races/')&&req.method==='DELETE'){const ok=await store.deleteRace(data.member,url.pathname.slice(11));send(ok?200:404,ok?{ok:true}:{error:'선택한 회원의 대회를 찾지 못했습니다.'});return true;}
 if(url.pathname==='/api/goal'&&req.method==='POST'&&validMonth(month)&&Number.isFinite(data.km)&&data.km>0&&data.km<=10000){await store.publicGoal(data.member,month,data.km);send(200,{ok:true});return true;}
 if(url.pathname==='/api/runs'&&req.method==='POST'){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date))||new Date(data.date+'T00:00:00Z').toISOString().slice(0,10)!==data.date||data.date>today||!Number.isFinite(data.km)||data.km<=0||data.km>500||(data.id!==undefined&&typeof data.id!=='string')){send(400,{error:'오늘까지의 날짜와 0 초과 500km 이하 거리를 입력해 주세요.'});return true;}
 const ok=await store.savePublicRun(data.member,data.id,data.date,data.km);send(ok?200:404,ok?{ok:true}:{error:'선택한 회원의 수정할 기록이 없습니다.'});return true;
 }
 if(url.pathname.startsWith('/api/runs/')&&req.method==='DELETE'){const ok=await store.deletePublicRun(data.member,url.pathname.slice(10));send(ok?200:404,ok?{ok:true}:{error:'선택한 회원의 삭제할 기록이 없습니다.'});return true;}
 send(400,{error:'요청을 확인해 주세요.'});
 }catch{send(500,{error:'서버 오류입니다. 잠시 후 다시 시도해 주세요.'});}return true;
 };
}
