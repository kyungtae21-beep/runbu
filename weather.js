// Open-Meteo's public forecast API. City coordinates are representative city points,
// not precise course coordinates; the selected location is always shown in the UI.
export const weatherCities={
 seoul:{name:'서울',lat:37.5665,lon:126.978},busan:{name:'부산',lat:35.1796,lon:129.0756},daegu:{name:'대구',lat:35.8714,lon:128.6014},incheon:{name:'인천',lat:37.4563,lon:126.7052},gwangju:{name:'광주',lat:35.1595,lon:126.8526},daejeon:{name:'대전',lat:36.3504,lon:127.3845},ulsan:{name:'울산',lat:35.5384,lon:129.3114},sejong:{name:'세종',lat:36.48,lon:127.289},jeju:{name:'제주',lat:33.4996,lon:126.5312},seogwipo:{name:'서귀포',lat:33.2541,lon:126.56},chuncheon:{name:'춘천',lat:37.8813,lon:127.73},gangneung:{name:'강릉',lat:37.7519,lon:128.8761},gyeongju:{name:'경주',lat:35.8562,lon:129.2247},suwon:{name:'수원',lat:37.2636,lon:127.0286},seongnam:{name:'성남',lat:37.4201,lon:127.1265},goyang:{name:'고양',lat:37.6584,lon:126.832},cheongju:{name:'청주',lat:36.6424,lon:127.489},jeonju:{name:'전주',lat:35.8242,lon:127.148},yeosu:{name:'여수',lat:34.7604,lon:127.6622},changwon:{name:'창원',lat:35.228,lon:128.681},pohang:{name:'포항',lat:36.019,lon:129.3435}
};
export function raceCity(race){
 if(race?.weatherCity&&weatherCities[race.weatherCity])return race.weatherCity;
 return Object.keys(weatherCities).find(key=>String(race?.location||'').includes(weatherCities[key].name))||'';
}
export function forecastEligibility(race,today){
 if(!race)return 'no-race';if(race.sample)return 'sample';
 const diff=Math.round((new Date(race.date+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000);
 if(!Number.isFinite(diff)||diff<0)return 'past';if(diff>15)return 'too-far';
 if(!raceCity(race))return 'location';return 'ready';
}
export function weatherDescription(code){
 if(code===0)return '맑음';if([1,2].includes(code))return '구름 조금';if(code===3)return '흐림';if([45,48].includes(code))return '안개';if([51,53,55,56,57].includes(code))return '이슬비';if([61,63,65,66,67,80,81,82].includes(code))return '비';if([71,73,75,77,85,86].includes(code))return '눈';if([95,96,99].includes(code))return '뇌우';return '상태 미제공';
}
export function forecastUrl(race){const city=weatherCities[raceCity(race)];if(!city)throw Error('예보 지역을 선택해 주세요.');const params=new URLSearchParams({latitude:city.lat,longitude:city.lon,hourly:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',timezone:'Asia/Seoul',forecast_days:'16',temperature_unit:'celsius',wind_speed_unit:'kmh'});return 'https://api.open-meteo.com/v1/forecast?'+params;}
export function extractForecast(data,race){
 const hour=/^\d{2}$/.test(race.weatherHour||'')?race.weatherHour:'08';
 const h=data?.hourly,index=h?.time?.indexOf(race.date+'T'+hour+':00');
 if(!Number.isInteger(index)||index<0)return null;
 const temp=h.temperature_2m?.[index];if(!Number.isFinite(temp))return null;
 const numeric=key=>Number.isFinite(h[key]?.[index])?h[key][index]:null;
 return {temp,feels:numeric('apparent_temperature'),humidity:numeric('relative_humidity_2m'),rain:numeric('precipitation_probability'),wind:numeric('wind_speed_10m'),code:numeric('weather_code'),hour,city:weatherCities[raceCity(race)].name};
}
export async function fetchRaceForecast(race,{fetcher=globalThis.fetch,signal}={}){
 const response=await fetcher(forecastUrl(race),{signal});if(!response.ok)throw Error('날씨 서비스 응답 오류 ('+response.status+')');
 const data=await response.json();if(data?.error)throw Error('날씨 서비스가 요청을 처리하지 못했어요.');return extractForecast(data,race);
}
