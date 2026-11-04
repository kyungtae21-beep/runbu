import test from 'node:test';import assert from 'node:assert/strict';
import {raceCity,forecastEligibility,forecastUrl,extractForecast,fetchRaceForecast,weatherDescription} from './weather.js';
const race={id:'r',location:'서울 잠실',date:'2026-11-10'};
const response={hourly:{time:['2026-11-10T08:00','2026-11-10T09:00'],temperature_2m:[12,14],apparent_temperature:[10,12],relative_humidity_2m:[60,55],precipitation_probability:[15,20],weather_code:[2,3],wind_speed_10m:[8,9]}};
test('지역과 날짜를 확인하고 예시·장기예보·알 수 없는 지역을 실제 예보로 표시하지 않는다',()=>{
 assert.equal(raceCity(race),'seoul');assert.equal(forecastEligibility(race,'2026-11-04'),'ready');assert.equal(forecastEligibility({...race,date:'2026-11-20'},'2026-11-04'),'too-far');assert.equal(forecastEligibility({...race,sample:true},'2026-11-04'),'sample');assert.equal(forecastEligibility({...race,location:'어딘가'},'2026-11-04'),'location');assert.equal(forecastEligibility({...race,date:'2026-11-19'},'2026-11-04'),'ready');
});
test('선택한 날짜와 시간의 예보만 추출하고 누락값을 0으로 바꾸지 않는다',()=>{
 assert.equal(extractForecast(response,race).temp,12);assert.equal(extractForecast(response,{...race,weatherHour:'09'}).temp,14);assert.equal(extractForecast(response,{...race,date:'2026-11-11'}),null);assert.equal(extractForecast({hourly:{time:['2026-11-10T08:00'],temperature_2m:[null]}},race),null);assert.equal(extractForecast({hourly:{time:['2026-11-10T08:00'],temperature_2m:[12]}},race).rain,null);
});
test('공개 API URL에 좌표·단위·한국 시간대를 명시하고 요청 실패를 구분한다',async()=>{
 const url=new URL(forecastUrl(race));assert.equal(url.hostname,'api.open-meteo.com');assert.equal(url.searchParams.get('timezone'),'Asia/Seoul');assert.equal(url.searchParams.get('forecast_days'),'16');assert.equal(weatherDescription(95),'뇌우');
 assert.equal((await fetchRaceForecast(race,{fetcher:async()=>({ok:true,json:async()=>response})})).temp,12);
 await assert.rejects(()=>fetchRaceForecast(race,{fetcher:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(()=>fetchRaceForecast(race,{fetcher:async()=>{throw Error('network');}}),/network/);
});
