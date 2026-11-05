export const crewMemberOrder=['박경태','홍곤표','설미경','도은진','장경자','김애진','이시광'];
export function orderedCrew(members){return [...members].sort((a,b)=>{
 const ai=crewMemberOrder.indexOf(a.name),bi=crewMemberOrder.indexOf(b.name);
 return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);
});}
