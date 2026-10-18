const OPERATOR_PHOTOS=[...new Set(Object.values(operatorSteps).flatMap(stations=>Object.values(stations).flatMap(steps=>steps.map(step=>step.image).filter(Boolean))))];
const OP_STATIONS=['Борец КАСКАД-НТ','Эталон ЧР','ЭЛЕКТОН','ОРИОН-01','ТРИОЛ (УМКА)'];
let operatorMode='ramp',operatorStep=0,operatorViewing=false;
const opValues={ramp:{start:'',end:'',delta:'',stepMinutes:'',station:OP_STATIONS[0]},rich:{high:'',low:'',highMinutes:'',lowMinutes:'',station:OP_STATIONS[0]}};
function opNumber(v){const x=Number(String(v).replace(',','.'));return String(v).trim()!==''&&Number.isFinite(x)?x:null}
function opCalc(mode,v){
 const n=k=>opNumber(v[k]);
 if(mode==='ramp'){
  const [start,end,delta,stepMinutes]=['start','end','delta','stepMinutes'].map(n);
  if([start,end,delta,stepMinutes].some(x=>x===null)||start<=0||end<=start||delta<=0||stepMinutes<=0)return null;
  const seconds=(end-start)/delta*stepMinutes;
  return {st:fmt(start),en:fmt(end),rt:fmt(delta*3600/stepMinutes),dv:fmt(delta),sm:fmt(stepMinutes),totalMinutes:fmt(seconds/60),duration:String(Math.round(seconds/60)/60|0).padStart(2,'0')+':'+String(Math.round(seconds/60)%60).padStart(2,'0')};
 }
 const [high,low,highMinutes,lowMinutes]=['high','low','highMinutes','lowMinutes'].map(n);
 if([high,low,highMinutes,lowMinutes].some(x=>x===null)||high<=low||low<=0||highMinutes<=0||lowMinutes<=0)return null;
 const uv=(lowMinutes+1)*60;
 const time=x=>`${Math.floor(Math.round(x)/60)} ч ${String(Math.round(x)%60).padStart(2,'0')} мин`;
 const sec=x=>`${Math.floor(Math.round(x)/60)} мин ${String(Math.round(x)%60).padStart(2,'0')} с`;
 return {hi:fmt(high),lo:fmt(low),htime:fmt(highMinutes),ltime:fmt(lowMinutes),uv:fmt(uv),uvClock:sec(uv),highClock:time(highMinutes),lowClock:time(lowMinutes)};
}
function opDescription(raw,c){
 return raw.replace(/\$\{formatNumber\(dv!!\)\}/g,c.dv||'').replace(/\$\{formatNumber\(sm!!\)\}/g,c.sm||'')
 .replace(/\$\{formatNumber\(uv!!\)\}/g,c.uv||'').replace(/\$\{secondsClock\(uv!!\)\}/g,c.uvClock||'')
 .replace(/\$\{minutesClock\(hm!!\)\}/g,c.highClock||'').replace(/\$\{minutesClock\(lm!!\)\}/g,c.lowClock||'')
 .replace(/\$\{formatNumber\(\(lm!! \+ 1\.0\) \* 60\.0\)\}/g,c.uv||'')
 .replace(/\$\{formatNumber\(totalMinutes\)\}/g,c.totalMinutes||'')
 .replace(/\$duration/g,c.duration||'')
 .replace(/\$(st|en|rt|hi|lo|htime|ltime)/g,(_,key)=>c[key]||'');
}
async function downloadOperatorPhotos(){
 const status=document.getElementById('opOfflineStatus');const button=document.getElementById('opOfflineDownload');
 button.disabled=true;
 try{
  if(!('serviceWorker' in navigator))throw Error('Service Worker недоступен');
  const registration=await navigator.serviceWorker.ready;const worker=navigator.serviceWorker.controller||registration.active;
  if(!worker)throw Error('Перезапустите приложение');
  await new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{
   const m=e.data;if(m.type==='progress')status.textContent=`Сохранено ${m.saved} из ${m.total} фотографий`;
   if(m.type==='complete'){channel.port1.close();resolve();}
   if(m.type==='error'){channel.port1.close();reject(Error(m.message));}
  };worker.postMessage({type:'OPERATORS_DOWNLOAD',paths:OPERATOR_PHOTOS},[channel.port2]);});
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{button.disabled=false;}
}
function renderOperator(){
 const mode=operatorMode,v=opValues[mode],calc=opCalc(mode,v),title=mode==='ramp'?'Разгон':'РИЧ';
 if(operatorViewing){
  const steps=operatorSteps[mode]?.[v.station]||[];
  if(!calc||!steps.length){operatorViewing=false;return renderOperator()}
  operatorStep=Math.max(0,Math.min(operatorStep,steps.length-1));const s=steps[operatorStep];
  app.innerHTML=screen(`${topbar(title+' — '+v.station)}<main class="content stack"><div class="card"><div class="subtle">Шаг ${operatorStep+1} из ${steps.length}</div><h2>${esc(s.title)}</h2>${s.image?`<img class="operator-photo" src="${s.image}" alt="${esc(s.title)}" loading="lazy">`:''}<p>${esc(opDescription(s.description,calc))}</p></div><div class="row"><button class="btn secondary" id="opPrev">Назад</button><button class="btn" id="opNext">${operatorStep===steps.length-1?'К параметрам':'Далее'}</button></div><p class="hint">Параметры и шаги перенесены из Android-версии. Перед применением сверяйте с документацией конкретной СУ и утверждённой технологией.</p></main>`);
  document.getElementById('opPrev').onclick=()=>{if(operatorStep===0)operatorViewing=false;else operatorStep--;renderOperator()};
  document.getElementById('opNext').onclick=()=>{if(operatorStep===steps.length-1)operatorViewing=false;else operatorStep++;renderOperator()};return;
 }
 const fields=mode==='ramp'?[['start','Начальная частота, Гц'],['end','Конечная частота, Гц'],['delta','Шаг изменения частоты, Гц'],['stepMinutes','Время одного шага, с']]:[['high','Рабочая / повышенная частота, Гц'],['low','Пониженная частота, Гц'],['highMinutes','Время на рабочей частоте, мин'],['lowMinutes','Время на пониженной частоте, мин']];
 app.innerHTML=screen(`${topbar('Операторы — '+title)}<main class="content stack"><div class="chips"><button class="chip ${mode==='ramp'?'active':''}" data-opmode="ramp">Разгон</button><button class="chip ${mode==='rich'?'active':''}" data-opmode="rich">РИЧ</button></div><div class="card stack"><h2>Введите свои значения</h2>${fields.map(([key,label])=>`<div class="field"><label for="op-${key}">${label}</label><input id="op-${key}" type="text" inputmode="decimal" value="${esc(v[key])}" autocomplete="off"></div>`).join('')}<div class="field"><label for="opStation">Станция управления</label><select id="opStation">${OP_STATIONS.map(s=>`<option ${s===v.station?'selected':''}>${esc(s)}</option>`).join('')}</select></div>${mode==='rich'&&calc?`<div class="hint">Время срабатывания недогрузки: ${calc.uv} с</div>`:''}<div id="opValidation" class="hint"></div><button class="btn full" id="opStart" ${calc?'':'disabled'}>Перейти к инструкции</button></div><div class="card stack"><h3>Фотографии станций офлайн</h3><p class="hint">Загрузите фотографии при наличии интернета.</p><button class="btn secondary full" id="opOfflineDownload">↓ Скачать фотографии</button><p id="opOfflineStatus" class="hint" role="status"></p></div></main>`);
 document.getElementById("opOfflineDownload").onclick=downloadOperatorPhotos;
 document.querySelectorAll('[data-opmode]').forEach(b=>b.onclick=()=>{operatorMode=b.dataset.opmode;renderOperator()});
 fields.forEach(([key])=>document.getElementById('op-'+key).addEventListener('input',e=>{v[key]=e.target.value;const c=opCalc(mode,v);document.getElementById('opStart').disabled=!c;document.getElementById('opValidation').textContent=c?'':'Проверьте частоты и время: значения должны быть положительными.'}));
 document.getElementById('opStation').onchange=e=>{v.station=e.target.value};
 document.getElementById('opStart').onclick=()=>{if(!opCalc(mode,v))return;operatorStep=0;operatorViewing=true;renderOperator()};
}
