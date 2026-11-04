export const day=86400000;
export function dateValue(s){return new Date(s+'T12:00:00Z');}
export function gap(a,b){return Math.round((dateValue(b)-dateValue(a))/day);}
export function recovery(km){return km>=42?28:km>=21?14:km>=10?7:3;}
export function conflicts(races){const sorted=[...races].sort((a,b)=>a.date.localeCompare(b.date));return sorted.slice(1).flatMap((b,i)=>{const a=sorted[i],days=gap(a.date,b.date),need=Math.max(recovery(+a.km),recovery(+b.km));return days<need?[{a,b,days,need}]:[];});}
export function weekPlan(race,now){const remaining=race?gap(now,race.date):100;return ['휴식 & 스트레칭','이지런','근력 & 코어','템포런','휴식 & 가동성','이지런','롱런'].map((name,i)=>{let km=(race&&+race.km>=21?[0,6,0,8,0,5,16]:[0,5,0,6,0,4,10])[i];if(remaining<=7)km=Math.round(km*.45);else if(remaining<=14)km=Math.round(km*.65);return {name,km};});}

// Finish times use seconds so comparisons preserve second-level precision.
export function timeSeconds(value){
  if(typeof value!=='string'||!/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(value))return null;
  const [h,m,s]=value.split(':').map(Number),total=h*3600+m*60+s;
  return total>0?total:null;
}
export function personalBests(races,today){
  return [5,10,21.1,42.195].map(km=>{
    const finished=races.filter(r=>+r.km===km&&r.date<=today&&timeSeconds(r.result)!==null);
    finished.sort((a,b)=>timeSeconds(a.result)-timeSeconds(b.result)||a.date.localeCompare(b.date));
    return {km,race:finished[0]||null};
  });
}

export function nutritionGuide(height,weight,runKm=0){
  if(!Number.isFinite(height)||!Number.isFinite(weight)||height<100||height>230||weight<25||weight>250)return null;
  const long=runKm>=10,carb=long?[5,7]:runKm>0?[3,5]:[3,4];
  return {bmi:Math.round(weight/(height/100)**2*10)/10,protein:[Math.round(weight*1.2),Math.round(weight*1.6)],carbs:carb.map(x=>Math.round(weight*x))};
}
export function weightChange(entries){
  const sorted=entries.filter(x=>Number.isFinite(x.weight)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  return sorted.length>1?Math.round((sorted.at(-1).weight-sorted[0].weight)*10)/10:null;
}
