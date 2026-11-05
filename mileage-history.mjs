// User-provided monthly summaries. null means distance was not supplied.
export const mileageHistory2026 = [
 {name:'박경태',distances:[174,180,189,167,238,213,201,263,199,151],goals:[210,210,210,210,210,250,250,250,280,280]},
 {name:'장경자',distances:[7,10,null,null,null,null,null,null,null,null],goals:Array(10).fill(30)},
 {name:'김애진',distances:Array(10).fill(null),goals:Array(10).fill(40)},
 {name:'이시광',distances:Array(10).fill(null),goals:Array(10).fill(40)},
 {name:'홍곤표',distances:[115,106,30,35,15,20,15,31,42,52],goals:Array(10).fill(120)},
 {name:'설미경',distances:[109,106,30,44,20,20,20,26,86,127],goals:Array(10).fill(120)},
 {name:'도은진',distances:[100,73,20,26,5,20,5,16,25,38],goals:Array(10).fill(100)}
].flatMap(person=>person.distances.map((km,i)=>({name:person.name,month:`2026-${String(i+1).padStart(2,'0')}`,km,goal:person.goals[i]})));
