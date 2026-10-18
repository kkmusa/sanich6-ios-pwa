const APP_VERSION='2.8.1-web.19';
const app=document.getElementById('app');
const state={route:'splash',navStack:[],historyDraftId:null,historyDraftRoute:null,_last:null};
const num=v=>{const x=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(x)?x:null};
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d).replace(/\.?0+$/,''):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const historyKey='operator_dng_history_v1';
function history(){try{return JSON.parse(localStorage.getItem(historyKey)||'[]')}catch{return[]}}
function saveHistory(entry){const list=history();const id=crypto.randomUUID?.()||String(Date.now());list.unshift({...entry,id,ts:Date.now()});localStorage.setItem(historyKey,JSON.stringify(list.slice(0,150)));return id}
function updateHistory(id,entry){const list=history();const i=list.findIndex(x=>x.id===id);if(i<0)return false;list[i]={...list[i],...entry,ts:Date.now()};localStorage.setItem(historyKey,JSON.stringify(list.slice(0,150)));return true}
function recordCalculation(entry){
  state._last=entry;
  if(!entry)return;
  if(state.historyDraftRoute!==state.route){state.historyDraftId=null;state.historyDraftRoute=state.route}
  if(state.historyDraftId && updateHistory(state.historyDraftId,entry))return;
  state.historyDraftId=saveHistory(entry);
  state.historyDraftRoute=state.route;
}
Object.defineProperty(state,'last',{get(){return state._last},set(v){recordCalculation(v)}});
function resetHistoryDraft(){state.historyDraftId=null;state.historyDraftRoute=null;state._last=null}
function clearHistory(){localStorage.removeItem(historyKey);resetHistoryDraft()}
// Route-scoped drafts survive reloads within the same browser session.
// Never persist password/file inputs, and avoid storing calculation history twice.
const DRAFTS_KEY='operator_dng_route_drafts_v2';
const routeDrafts=new Map();
try {
  const saved=JSON.parse(sessionStorage.getItem(DRAFTS_KEY)||'{}');
  for(const [route,fields] of Object.entries(saved)) {
    if(fields && typeof fields==='object' && !Array.isArray(fields))routeDrafts.set(route,fields);
  }
} catch { /* storage may be disabled in private browsing */ }
function persistDrafts(){
  try {sessionStorage.setItem(DRAFTS_KEY,JSON.stringify(Object.fromEntries(routeDrafts)))}catch{}
}
function snapshotRoute(){
  if(!state.route || !app)return;
  const fields={};
  app.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>{
    if(['password','file','hidden'].includes(el.type))return;
    fields[el.id]=el.type==='checkbox'||el.type==='radio'?{checked:el.checked}:{value:el.value};
  });
  if(Object.keys(fields).length){routeDrafts.set(state.route,fields);persistDrafts()}
}
function restoreRoute(){
  const fields=routeDrafts.get(state.route);
  if(!fields)return;
  let firstChanged=null;
  Object.entries(fields).forEach(([id,saved])=>{
    const el=document.getElementById(id);if(!el)return;
    if('checked' in saved){
      if(el.checked!==!!saved.checked)firstChanged??=el;
      el.checked=!!saved.checked;
    }else if('value' in saved){
      if(el.value!==String(saved.value))firstChanged??=el;
      el.value=String(saved.value);
    }
  });
  // Recompute results after restoring drafts, without rerendering the whole screen.
  if(firstChanged)firstChanged.dispatchEvent(new Event('input',{bubbles:true}));
}
// Capture changes without rerendering screens or disturbing the caret / keyboard.
// A calculation may update its result independently of this persistence layer.
document.addEventListener('input',e=>{
  if(e.target?.matches?.('input[id],textarea[id]'))snapshotRoute();
},true);
document.addEventListener('change',e=>{
  if(e.target?.matches?.('input[id],select[id],textarea[id]'))snapshotRoute();
},true);
window.addEventListener('pagehide',snapshotRoute);
// Keep live DOM nodes and event handlers for calculator screens instead of
// rebuilding them on every navigation. Dynamic lists and timer screens are
// deliberately excluded because they need a fresh render or active cleanup.
const CACHED_CALCULATOR_ROUTES=new Set(['level','frequency','flow','upr','apv','sko','tap']);
const screenCache=new Map();
// Remember scroll positions per route while moving through the application.
// A new forward visit starts at the top; Back restores the previous position.
const routeScroll=new Map();
function saveRouteScroll(){
  if(state.route)routeScroll.set(state.route,window.scrollY||0);
}
function restoreRouteScroll(route){
  const position=routeScroll.get(route)||0;
  requestAnimationFrame(()=>window.scrollTo(0,position));
}

function parkCurrentScreen(){
  const route=state.route;
  if(!CACHED_CALCULATOR_ROUTES.has(route)||!app?.firstChild)return;
  const fragment=document.createDocumentFragment();
  while(app.firstChild)fragment.appendChild(app.firstChild);
  screenCache.delete(route);
  screenCache.set(route,fragment);
}
function showCachedScreen(route){
  const fragment=screenCache.get(route);
  if(!fragment)return false;
  screenCache.delete(route);
  app.replaceChildren(fragment);
  return true;
}
function clearScreenCache(){screenCache.clear()}
function go(route){
  if(route===state.route)return;
  if(state.route)state.navStack.push(state.route);
  snapshotRoute();
  saveRouteScroll();
  parkCurrentScreen();
  resetHistoryDraft();
  state.route=route;routeScroll.set(route,0);render();scrollTo(0,0)
}
function goBack(){
  if(state.route==='assistant' && state.assistantIndex!==undefined && state.assistantIndex!==null){state.assistantIndex=null;renderAssistant();scrollTo(0,0);return}
  snapshotRoute();
  saveRouteScroll();
  parkCurrentScreen();
  const prev=state.navStack.pop();
  if(prev){resetHistoryDraft();state.route=prev;render();restoreRouteScroll(prev);return}
  if(state.route!=='home'){resetHistoryDraft();state.route='home';render();restoreRouteScroll('home')}
}
function bind(ids,fn){ids.forEach(id=>document.getElementById(id)?.addEventListener('input',fn));ids.forEach(id=>document.getElementById(id)?.addEventListener('change',fn))}
function setResult(title,value,error){const el=document.getElementById('liveResult');if(el)el.outerHTML=`<div id="liveResult">${resultCard(title,value,error)}</div>`}
function iconSvg(type){
  const common='class="menu-svg" viewBox="0 0 48 48" aria-hidden="true"';
  if(type==='level')return `<svg ${common}><path d="M10 30c6-7 22-7 28 0v8H10z" fill="#39a9db"/><path d="M10 30c7 4 21 4 28 0" fill="none" stroke="#fff" stroke-width="2.5"/><text x="24" y="23" text-anchor="middle" font-size="20" font-weight="900" fill="#171717">H</text></svg>`;
  if(type==='frequency')return `<svg ${common}><rect x="7" y="7" width="34" height="34" rx="11" fill="#fff3cd" stroke="#f28c00" stroke-width="2"/><text x="24" y="31" text-anchor="middle" font-size="27" font-weight="900" font-style="italic" fill="#171717">F</text></svg>`;
  if(type==='manual')return `<img class="menu-img" src="assets/ic_manual_debit.png" alt="">`;
  if(type==='flow')return `<img class="menu-img" src="assets/ic_well_inflow.png" alt="">`;
  if(type==='sko')return `<svg ${common}><path d="M17 7h14v4l-4 6v5l9 15c1 2-.4 4-2.8 4H14.8c-2.4 0-3.8-2-2.8-4l9-15v-5l-4-6z" fill="#fff" stroke="#171717" stroke-width="2.4"/><path d="M15 34h18l3 5H12z" fill="#38a95a"/><path d="M18 31c4-2 8 2 13 0" fill="none" stroke="#38a95a" stroke-width="4"/></svg>`;
  if(type==='zsp')return `<svg ${common}><rect x="5" y="9" width="38" height="30" rx="9" fill="#fff3cd" stroke="#f28c00" stroke-width="2"/><text x="24" y="30" text-anchor="middle" font-size="17" font-weight="900" fill="#171717">ЗСП</text></svg>`;
  if(type==='pipeLarge')return `<svg ${common}><ellipse cx="24" cy="12" rx="15" ry="7" fill="#d9dde1" stroke="#59636d" stroke-width="2.4"/><path d="M9 12v24c0 4 30 4 30 0V12" fill="#c4cad0" stroke="#59636d" stroke-width="2.4"/><ellipse cx="24" cy="12" rx="8" ry="3.5" fill="#f6f6f6" stroke="#59636d" stroke-width="2"/></svg>`;
  if(type==='pipeSmall')return `<svg ${common}><ellipse cx="24" cy="14" rx="11" ry="5" fill="#d9dde1" stroke="#59636d" stroke-width="2.3"/><path d="M13 14v22c0 3 22 3 22 0V14" fill="#c4cad0" stroke="#59636d" stroke-width="2.3"/><ellipse cx="24" cy="14" rx="5.5" ry="2.4" fill="#f6f6f6" stroke="#59636d" stroke-width="1.8"/></svg>`;
  return type;
}
function menuCard(icon,title,subtitle,route){return `<div class="card menu-card pressable" onclick="go('${route}')"><div class="emoji">${iconSvg(icon)}</div><div class="grow"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><div class="chev">›</div></div>`}

