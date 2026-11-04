export const day=86400000;
export function dateValue(s){return new Date(s+'T12:00:00Z');}
export function gap(a,b){return Math.round((dateValue(b)-dateValue(a))/day);}
export function recovery(km){return km>=42?28:km>=21?14:km>=10?7:3;}
export function conflicts(races){const sorted=[...races].sort((a,b)=>a.date.localeCompare(b.date));return sorted.slice(1).flatMap((b,i)=>{const a=sorted[i],days=gap(a.date,b.date),need=Math.max(recovery(+a.km),recovery(+b.km));return days<need?[{a,b,days,need}]:[];});}
export function weekPlan(race,now){const remaining=race?gap(now,race.date):100;return ['휴식 & 스트레칭','이지런','근력 & 코어','템포런','휴식 & 가동성','이지런','롱런'].map((name,i)=>{let km=(race&&+race.km>=21?[0,6,0,8,0,5,16]:[0,5,0,6,0,4,10])[i];if(remaining<=7)km=Math.round(km*.45);else if(remaining<=14)km=Math.round(km*.65);return {name,km};});}
