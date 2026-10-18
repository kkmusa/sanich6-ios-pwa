const CACHE='operator-dng-pwa-v19';
const VNR_CACHE='operator-dng-vnr-pages-v1';
const VNR_TOTAL=207;
const OP_CACHE='operator-dng-photos-v1';
const SHELL=['./','./index.html','./styles.css?v=19','./js/core.js?v=19','./js/ui-components.js?v=19','./js/math.js?v=19','./js/calculators.js?v=19','./js/manual.js?v=19','./js/reference-data.js?v=19','./js/reference-ui.js?v=19','./js/ped.js?v=19','./js/operator-data.js?v=19','./js/operators.js?v=19','./js/bootstrap.js?v=19','./vnr/index.html','./manifest.webmanifest','./assets/logo.png','./assets/PedCoolingDatabase.json','./assets/ic_manual_debit.png','./assets/ic_well_inflow.png','./assets/icons/icon-180.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE && key!==VNR_CACHE && key!==OP_CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(resp=>resp.ok?resp:Promise.reject(new Error('HTTP '+resp.status)))
      .catch(async()=>await caches.match(req) || await caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{
    if(resp.ok && resp.type==='basic'){
      const copy=resp.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
    }
    return resp;
  })));
});

// Explicit offline download; keep the document cache independent of app releases.
let vnrDownloadRunning=false;
self.addEventListener('message',event=>{
  if(!event.data || event.data.type!=='VNR_DOWNLOAD')return;
  const port=event.ports && event.ports[0];
  if(!port)return;
  if(vnrDownloadRunning){port.postMessage({type:'error',message:'Загрузка уже выполняется'});return;}
  vnrDownloadRunning=true;
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(VNR_CACHE);
      let saved=0;
      for(let i=1;i<=VNR_TOTAL;i++){
        const url=new URL('./vnr/pages/'+String(i).padStart(3,'0')+'.jpg',self.registration.scope);
        const old=await cache.match(url);
        if(old && old.ok){saved++;port.postMessage({type:'progress',saved,total:VNR_TOTAL});continue;}
        const response=await fetch(url,{cache:'no-store'});
        if(!response.ok || response.type==='opaque')throw new Error('Страница '+i+': HTTP '+response.status);
        await cache.put(url,response);
        saved++;
        port.postMessage({type:'progress',saved,total:VNR_TOTAL});
      }
      port.postMessage({type:'complete',saved,total:VNR_TOTAL});
    }catch(err){port.postMessage({type:'error',message:String(err && err.message || err)});}
    finally{vnrDownloadRunning=false;port.close();}
  })());
});
self.addEventListener('message',event=>{
  if(!event.data || event.data.type!=='VNR_STATUS')return;
  const port=event.ports && event.ports[0];if(!port)return;
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(VNR_CACHE);let saved=0;
      for(let i=1;i<=VNR_TOTAL;i++){
        const url=new URL('./vnr/pages/'+String(i).padStart(3,'0')+'.jpg',self.registration.scope);
        if(await cache.match(url))saved++;
      }
      port.postMessage({type:'status',saved,total:VNR_TOTAL});
    }catch(err){port.postMessage({type:'error',message:String(err)});}
    finally{port.close();}
  })());
});

// Download station photographs into a version-independent cache.
let opBusy=false;
self.addEventListener('message',event=>{
 if(event.data?.type!=='OPERATORS_DOWNLOAD')return;
 const port=event.ports?.[0];if(!port)return;
 event.waitUntil((async()=>{
  if(opBusy){port.postMessage({type:'error',message:'Загрузка уже выполняется'});return;}
  opBusy=true;
  try{
   const paths=event.data.paths;
   if(!Array.isArray(paths)||paths.length>100||paths.some(p=>typeof p!=='string'||!/^assets\/operators\/[a-z0-9_-]+\.jpg$/.test(p)))throw Error('Некорректные имена фотографий');
   const unique=[...new Set(paths)];const cache=await caches.open(OP_CACHE);let saved=0;
   for(const path of unique){const url=new URL(path,self.registration.scope);let response=await cache.match(url);
    if(!response?.ok){response=await fetch(url,{cache:'no-store'});if(!response.ok||response.type==='opaque')throw Error('Ошибка загрузки: '+path);await cache.put(url,response);}
    port.postMessage({type:'progress',saved:++saved,total:unique.length});
   }
   port.postMessage({type:'complete',saved,total:unique.length});
  }catch(err){port.postMessage({type:'error',message:String(err.message||err)});}
  finally{opBusy=false;port.close();}
 })());
});
