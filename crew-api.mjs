import {createCrewStore} from './crew-store.mjs';
import {join} from 'node:path';
export function crewAPI(){
 const store=createCrewStore(process.env.RUNBU_DB_PATH||join(process.env.HOME||'/tmp','.local/share/runbu/crew.sqlite'));
 const attempts=new Map();
 return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return false;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'허용되지 않은 요청입니다.'});return true;}
 let data={};if(req.method!=='GET'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){send(413,{error:'입력 크기를 줄여 주세요.'});return true;}}try{data=JSON.parse(raw||'{}');}catch{send(400,{error:'잘못된 요청입니다.'});return true;}}
 const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('runbu_session='))?.slice(14)||'';
 const member=token?store.member(token):null;
 const secure=process.env.RUNBU_SECURE_COOKIE==='1'?'; Secure':'';
 if(url.pathname==='/api/session'&&req.method==='GET'){send(200,{member,signupAvailable:true});return true;}
 if(['/api/register','/api/login'].includes(url.pathname)&&req.method==='POST'){
 const key=req.socket.remoteAddress,now=Date.now();if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);const limit=attempts.get(key);if(limit&&limit.until>now&&limit.count>=20){send(429,{error:'잠시 후 다시 시도해 주세요.'});return true;}attempts.set(key,{count:limit&&limit.until>now?limit.count+1:1,until:limit&&limit.until>now?limit.until:now+600000});
 const email=typeof data.email==='string'?data.email.trim().toLowerCase():'',password=data.password;
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof password!=='string'||password.length<10||password.length>128){send(400,{error:'이메일과 10~128자의 비밀번호를 입력해 주세요.'});return true;}
 let m;if(url.pathname==='/api/register'){if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>30){send(400,{error:'닉네임은 1~30자로 입력해 주세요.'});return true;}try{m=store.register(data.name.trim(),email,password);}catch{send(409,{error:'가입할 수 없습니다. 기존 계정으로 로그인해 주세요.'});return true;}}else m=store.login(email,password);
 if(!m){send(401,{error:'이메일 또는 비밀번호를 확인해 주세요.'});return true;}
 res.setHeader('Set-Cookie',`runbu_session=${store.session(m)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`);send(200,{member:m});return true;
 }
 if(!member){send(401,{error:'로그인이 필요합니다.'});return true;}
 if(url.pathname==='/api/logout'&&req.method==='POST'){store.logout(token);res.setHeader('Set-Cookie',`runbu_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);send(200,{ok:true});return true;}
 const month=url.searchParams.get('month')||data.month;
 if(url.pathname==='/api/board'&&req.method==='GET'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){send(200,{members:store.board(month)});return true;}
 if(url.pathname==='/api/goal'&&req.method==='POST'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&Number.isFinite(data.km)&&data.km>0&&data.km<=10000){store.goal(member.id,month,data.km);send(200,{ok:true});return true;}
 if(url.pathname==='/api/runs'&&req.method==='POST'){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date))||new Date(data.date+'T00:00:00Z').toISOString().slice(0,10)!==data.date||data.date>today||!Number.isFinite(data.km)||data.km<=0||data.km>500||(data.id!==undefined&&typeof data.id!=='string')){send(400,{error:'오늘까지의 날짜와 0 초과 500km 이하 거리를 입력해 주세요.'});return true;}
 const ok=store.saveRun(member.id,data.id,data.date,data.km);send(ok?200:404,ok?{ok:true}:{error:'수정할 기록이 없습니다.'});return true;
 }
 if(url.pathname.startsWith('/api/runs/')&&req.method==='DELETE'){const ok=store.deleteRun(member.id,url.pathname.slice(10));send(ok?200:404,ok?{ok:true}:{error:'삭제할 기록이 없습니다.'});return true;}
 send(400,{error:'요청을 확인해 주세요.'});
 }catch{send(500,{error:'서버 오류입니다. 잠시 후 다시 시도해 주세요.'});}return true;
 };
}
