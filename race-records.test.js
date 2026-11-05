import test from 'node:test';
import assert from 'node:assert/strict';
import {recordableRaces,crewPersonalBests,formatRaceTime,normalizeGoal,raceSeconds,calendarRaceGroups} from './race-records.js';
test('races appear on Korean race day without copying or inventing a finish time',()=>{
 const races=[{id:'1',member:'a',name:'오늘',date:'2026-11-05',km:10,result:''},{id:'2',member:'a',name:'내일',date:'2026-11-06',km:10,result:''},{id:'3',member:'b',name:'어제',date:'2026-11-04',km:5,result:'00:30:00'}];
 assert.deepEqual(recordableRaces(races,'2026-11-04','a'),[]);assert.deepEqual(recordableRaces(races,'2026-11-05','a').map(r=>r.id),['1']);assert.deepEqual(recordableRaces(races,'2026-11-06','a').map(r=>r.id),['2','1']);assert.equal(races[0].result,'');
});
test('shared PB separates members and distances, uses seconds, and recalculates after correction/removal',()=>{
 const members=[{id:'a',name:'가'},{id:'b',name:'나'}],races=[{id:'1',member:'a',name:'가1',date:'2026-11-04',km:10,result:'00:50:02'},{id:'2',member:'a',name:'가2',date:'2026-11-05',km:10,result:'00:50:01'},{id:'3',member:'b',date:'2026-11-05',km:10,result:'00:40:00'},{id:'4',member:'a',date:'2026-11-06',km:10,result:'00:20:00'},{id:'5',member:'a',date:'2026-11-05',km:5,result:'',goal:'00:15:00'}];
 const pb=()=>crewPersonalBests(races,members,'2026-11-05');assert.equal(pb()[0].bests.find(b=>b.km===10).race.id,'2');assert.equal(pb()[1].bests.find(b=>b.km===10).race.id,'3');assert.equal(pb()[0].bests.find(b=>b.km===5).race,null);
 races[1].result='00:55:00';assert.equal(pb()[0].bests.find(b=>b.km===10).race.id,'1');races[0].result='';assert.equal(pb()[0].bests.find(b=>b.km===10).race.id,'2');
});
test('six digit time input inserts colons and preserves legacy goals',()=>{
 assert.equal(formatRaceTime('013045'),'01:30:45');assert.equal(formatRaceTime('013'),'01:3');assert.equal(formatRaceTime('01:30:45'),'01:30:45');assert.equal(formatRaceTime('1:30:45'),'01:30:45');assert.equal(normalizeGoal('02:00'),'02:00:00');assert.equal(raceSeconds('00:00:00'),null);assert.equal(raceSeconds('01:60:00'),null);assert.equal(raceSeconds('01:30:45'),5445);
});


test('calendar groups each race name and counts unique participants across distances',()=>{
 const race={date:'2026-11-05',name:'서울 마라톤',member:'a',km:10};
 const groups=calendarRaceGroups([race,{...race,km:21.1},{...race,member:'b'},{...race,name:'한강 런',member:'b'},{...race,date:'2026-11-06'}]);
 assert.equal(groups.length,3);assert.equal(groups[0].name,'서울 마라톤');assert.equal(groups[0].count,2);assert.equal(groups[1].count,1);assert.equal(groups[2].count,1);
});
