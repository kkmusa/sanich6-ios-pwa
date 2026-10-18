// Manual measurement screen. Independent from the rest of the calculator UI.
let manualTimerHandle=null,manualTimerStart=0,manualTimerElapsed=0;
function stopManualTimer(){if(manualTimerHandle!==null){clearInterval(manualTimerHandle);manualTimerHandle=null}}
function wheelHTML(id,label,max,initial){
  return `<div class="time-wheel-column"><div class="time-wheel-label">${label}</div><div class="time-wheel" id="${id}" role="listbox" tabindex="0" aria-label="${label}">${Array.from({length:max},(_,i)=>`<button type="button" class="time-wheel-option" data-value="${i}" role="option" aria-selected="${i===initial}">${String(i).padStart(2,'0')}</button>`).join('')}</div></div>`;
}
function initWheel(id,initial,onChange){
  const el=document.getElementById(id),rowHeight=48,max=el.children.length;
  let current=initial,scrollTimer=null;
  function select(value,animate=true){
    current=Math.max(0,Math.min(max-1,value));
    el.querySelectorAll('.time-wheel-option').forEach((node,i)=>node.setAttribute('aria-selected',String(i===current)));
    el.scrollTo({top:current*rowHeight,behavior:animate?'smooth':'instant'});
    onChange();
  }
  el.addEventListener('scroll',()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{const next=Math.max(0,Math.min(max-1,Math.round(el.scrollTop/rowHeight)));select(next,false)},110);
  },{passive:true});
  el.addEventListener('click',event=>{const item=event.target.closest('[data-value]');if(item)select(Number(item.dataset.value))});
  el.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();select(current+(event.key==='ArrowDown'?1:-1))}});
  requestAnimationFrame(()=>select(initial,false));
  return ()=>current;
}
function renderManual(){
  stopManualTimer();manualTimerElapsed=0;
  const now=new Date(),hour=now.getHours(),minute=now.getMinutes();
  app.innerHTML=screen(`${topbar('Ручной замер дебита')}<main class="content stack">
    ${field('liters','Набежавший объём, л')}
    <label class="switchline card"><span><b>Расчёт по временному интервалу</b></span><input id="manualIntervalMode" type="checkbox"></label>
    <section id="manualStopwatch" class="stack">
      ${field('seconds','Время замера, с')}
      <div class="row"><button class="btn" id="timerBtn">Старт</button><button class="btn secondary" id="resetBtn">Сброс времени</button></div>
    </section>
    <section id="manualInterval" class="stack" hidden>
      <div class="card stack"><div class="section-title">Начало</div><div class="chips" id="startDayChoices"><button type="button" class="chip" data-day="0">Вчера</button><button type="button" class="chip active" data-day="1">Сегодня</button></div>
      <div class="time-wheel-pair">${wheelHTML('startHours','Часы',24,hour)}${wheelHTML('startMinutes','Минуты',60,minute)}</div></div>
      <div class="card stack"><div class="section-title">Конец — сегодня</div><div class="time-wheel-pair">${wheelHTML('endHours','Часы',24,hour)}${wheelHTML('endMinutes','Минуты',60,minute)}</div></div>
      <div class="hint" id="intervalDuration">Выберите время начала и окончания</div>
    </section>
    <div id="liveResult">${resultCard('Дебит скважины','','Введите объём и время')}</div>
    <button class="btn full" id="saveManual">Сохранить замер в историю</button>
    <button class="btn secondary full" id="clear">Очистить</button>
  </main>`);
  const byId=id=>document.getElementById(id),volume=byId('liters'),seconds=byId('seconds'),toggle=byId('manualIntervalMode');
  let startDay=1,getSH=()=>hour,getSM=()=>minute,getEH=()=>hour,getEM=()=>minute,lastEntry=null;
  function calc(){
    const liters=num(volume.value),isInterval=toggle.checked;
    let duration=null,debit=null,details='';
    if(isInterval){
      duration=DngMath.intervalMinutes(startDay,getSH(),getSM(),getEH(),getEM());
      byId('intervalDuration').textContent=duration===null?'Проверьте интервал: конец должен быть позже начала':`Продолжительность: ${Math.floor(duration/60)} ч ${duration%60} мин`;
      debit=DngMath.manualDebitInterval(liters,duration);
      details=`Объём=${liters} л; начало=${startDay===0?'вчера':'сегодня'} ${String(getSH()).padStart(2,'0')}:${String(getSM()).padStart(2,'0')}; конец=сегодня ${String(getEH()).padStart(2,'0')}:${String(getEM()).padStart(2,'0')}; интервал=${duration} мин`;
    }else{
      duration=num(seconds.value);debit=DngMath.manualDebit(liters,duration);
      details=`Объём=${liters} л; время=${duration} с`;
    }
    lastEntry=debit===null?null:{title:'Ручной замер дебита',method:isInterval?'Временной интервал':'Секундомер / ручной ввод',result:`${fmt(debit)} м³/сут`,details};
    setResult('Дебит скважины',lastEntry?.result||'',lastEntry?undefined:'Введите положительный объём и корректное время');
    byId('saveManual').disabled=!lastEntry;
  }
  getSH=initWheel('startHours',hour,calc);getSM=initWheel('startMinutes',minute,calc);
  getEH=initWheel('endHours',hour,calc);getEM=initWheel('endMinutes',minute,calc);
  byId('startDayChoices').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;startDay=Number(b.dataset.day);byId('startDayChoices').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));calc()});
  toggle.addEventListener('change',()=>{stopManualTimer();byId('timerBtn').textContent='Старт';seconds.disabled=false;byId('manualStopwatch').hidden=toggle.checked;byId('manualInterval').hidden=!toggle.checked;calc()});
  function tick(){seconds.value=((manualTimerElapsed+performance.now()-manualTimerStart)/1000).toFixed(1);calc()}
  byId('timerBtn').addEventListener('click',()=>{if(manualTimerHandle!==null){manualTimerElapsed+=performance.now()-manualTimerStart;seconds.value=(manualTimerElapsed/1000).toFixed(1);stopManualTimer();seconds.disabled=false;byId('timerBtn').textContent='Продолжить'}else{manualTimerElapsed=(num(seconds.value)||0)*1000;manualTimerStart=performance.now();manualTimerHandle=setInterval(tick,100);seconds.disabled=true;byId('timerBtn').textContent='Стоп'}});
  byId('resetBtn').addEventListener('click',()=>{stopManualTimer();manualTimerElapsed=0;seconds.disabled=false;seconds.value='';byId('timerBtn').textContent='Старт';calc()});
  bind(['liters','seconds'],()=>{if(manualTimerHandle===null)manualTimerElapsed=(num(seconds.value)||0)*1000;calc()});
  byId('saveManual').addEventListener('click',()=>{calc();if(!lastEntry)return;saveHistory(lastEntry);resetHistoryDraft();byId('saveManual').textContent='Сохранено ✓';setTimeout(()=>{const button=byId('saveManual');if(button)button.textContent='Сохранить замер в историю'},1200)});
  byId('clear').addEventListener('click',()=>{volume.value='';byId('resetBtn').click();calc()});
  calc();
}
