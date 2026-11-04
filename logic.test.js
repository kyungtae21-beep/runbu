import test from 'node:test';
import assert from 'node:assert/strict';
import {gap,conflicts,weekPlan,recovery} from './logic.js';
test('달과 연도 경계를 넘어 대회 간격을 계산한다',()=>{assert.equal(gap('2026-12-31','2027-01-02'),2);});
test('하프 이후 7일 만의 10K를 경고한다',()=>{const issue=conflicts([{date:'2026-11-29',km:21.1},{date:'2026-12-06',km:10}]);assert.equal(issue.length,1);assert.equal(issue[0].need,14);});
test('충분한 회복 간격과 정확한 경계는 경고하지 않는다',()=>{assert.equal(conflicts([{date:'2026-11-01',km:42.195},{date:'2026-11-29',km:10}]).length,0);assert.equal(recovery(5),3);});
test('대회 직전 훈련량을 줄인다',()=>{const race={date:'2026-12-01',km:21.1};const total=now=>weekPlan(race,now).reduce((s,p)=>s+p.km,0);assert.ok(total('2026-11-26')<total('2026-11-01'));assert.ok(total('2026-11-20')<total('2026-11-01'));});

import {timeSeconds,personalBests} from './logic.js';
test('완주 기록은 초 단위로 검증한다',()=>{
 assert.equal(timeSeconds('01:59:59'),7199);
 for(const value of ['00:00:00','01:60:00','-1:00:00','01:00','bad',undefined])assert.equal(timeSeconds(value),null);
});
test('PB는 거리별로 실제 완주 기록을 비교하고 미래 대회·목표 기록은 제외한다',()=>{
 const records=[{id:'a',km:10,date:'2026-10-01',goal:'00:30',result:'00:52:01'},{id:'b',km:10,date:'2026-10-02',result:'00:52:00'},{id:'c',km:21.1,date:'2026-10-01',result:'01:50:00'},{id:'d',km:10,date:'2027-01-01',result:'00:20:00'},{id:'e',km:10,date:'2026-10-03',goal:'00:10'}];
 const best=personalBests(records,'2026-11-04');
 assert.equal(best.find(x=>x.km===10).race.id,'b');assert.equal(best.find(x=>x.km===21.1).race.id,'c');assert.equal(best.find(x=>x.km===5).race,null);
 records[1].result='00:55:00';assert.equal(personalBests(records,'2026-11-04').find(x=>x.km===10).race.id,'a');
});

import {nutritionGuide,weightChange} from './logic.js';
test('키·체중 범위를 검증하고 체중·훈련량에 따라 영양 범위를 계산한다',()=>{
 assert.equal(nutritionGuide(0,70),null);assert.equal(nutritionGuide(175,NaN),null);
 const a=nutritionGuide(175,70,0),b=nutritionGuide(175,72,16);
 assert.deepEqual(a.protein,[84,112]);assert.deepEqual(b.carbs,[360,504]);assert.equal(a.bmi,22.9);
});
test('체중 변화는 입력 순서가 아닌 측정 날짜를 기준으로 계산한다',()=>{
 assert.equal(weightChange([{date:'2026-11-04',weight:69},{date:'2026-10-01',weight:70.2}]),-1.2);assert.equal(weightChange([{date:'2026-11-04',weight:69}]),null);
});
