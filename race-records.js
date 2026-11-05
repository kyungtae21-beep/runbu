// Shared rules for record entry and PB calculation (Korean calendar date supplied by caller).
export function recordableRaces(races,today,member=''){
 return races.filter(r=>r.date<=today&&(!member||r.member===member)).sort((a,b)=>b.date.localeCompare(a.date)||String(a.name||'').localeCompare(String(b.name||'')));
}
export function raceSeconds(value){
 if(typeof value!=='string'||!/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(value))return null;
 const [h,m,s]=value.split(':').map(Number),seconds=h*3600+m*60+s;return seconds>0?seconds:null;
}
export function normalizeGoal(value){return /^\d{1,2}:[0-5]\d$/.test(value)?value+':00':value;}
export function formatRaceTime(value){
 if(/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(value))return value.padStart(8,'0');
 const digits=value.replace(/\D/g,'').slice(0,6);return digits.match(/.{1,2}/g)?.join(':')||'';
}
export function crewPersonalBests(races,members,today){
 return members.map(member=>({...member,bests:[5,10,21.1,42.195].map(km=>{
 const candidates=recordableRaces(races,today,member.id).filter(r=>Number(r.km)===km&&raceSeconds(r.result)!==null);
 candidates.sort((a,b)=>raceSeconds(a.result)-raceSeconds(b.result)||a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return {km,race:candidates[0]||null};})}));
}

export function calendarRaceGroups(races){
 const groups=new Map();
 for(const race of races){const key=race.date+'\u0000'+race.name.trim().normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
 if(!groups.has(key))groups.set(key,{name:race.name.trim(),date:race.date,members:new Set()});groups.get(key).members.add(race.member);}
 return [...groups.values()].map(g=>({...g,count:g.members.size}));
}
