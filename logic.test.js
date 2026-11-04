import test from 'node:test';
import assert from 'node:assert/strict';
import {gap,conflicts,weekPlan,recovery} from './logic.js';
test('달과 연도 경계를 넘어 대회 간격을 계산한다',()=>{assert.equal(gap('2026-12-31','2027-01-02'),2);});
test('하프 이후 7일 만의 10K를 경고한다',()=>{const issue=conflicts([{date:'2026-11-29',km:21.1},{date:'2026-12-06',km:10}]);assert.equal(issue.length,1);assert.equal(issue[0].need,14);});
test('충분한 회복 간격과 정확한 경계는 경고하지 않는다',()=>{assert.equal(conflicts([{date:'2026-11-01',km:42.195},{date:'2026-11-29',km:10}]).length,0);assert.equal(recovery(5),3);});
test('대회 직전 훈련량을 줄인다',()=>{const race={date:'2026-12-01',km:21.1};const total=now=>weekPlan(race,now).reduce((s,p)=>s+p.km,0);assert.ok(total('2026-11-26')<total('2026-11-01'));assert.ok(total('2026-11-20')<total('2026-11-01'));});
