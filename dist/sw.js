const CACHE = 'card-dungeon-v1.0.12';
const CORE = [
  './','./index.html','./style.css','./enhancements.css','./cinematic.css','./wide-dungeon.css','./battle-planning.css','./portrait-hand-fix.css','./battle-polish.css','./card-focus.css','./battle-actor-fx.css','./encounter-transition.css',
  './js/app.js','./js/enhancements.js','./js/cinematic.js','./js/battle-planning.js','./js/battle-polish.js','./js/battle-actor-fx.js','./js/encounter-transition.js','./js/data.js','./js/engine.js','./js/audio.js','./js/scene.js',
  './lib/three.module.min.js','./assets/enemies.webp','./assets/icon.svg','./manifest.webmanifest'
];
const NETWORK_FIRST = new Set([
  './','./index.html','./style.css','./enhancements.css','./cinematic.css','./wide-dungeon.css','./battle-planning.css','./portrait-hand-fix.css','./battle-polish.css','./card-focus.css','./battle-actor-fx.css','./encounter-transition.css',
  './js/app.js','./js/enhancements.js','./js/cinematic.js','./js/battle-planning.js','./js/battle-polish.js','./js/battle-actor-fx.js','./js/encounter-transition.js','./js/data.js','./js/engine.js','./js/audio.js','./js/scene.js',
  './manifest.webmanifest'
].map(path=>new URL(path,self.registration.scope).pathname));
const IMMUTABLE = new Set([
  './lib/three.module.min.js','./assets/enemies.webp','./assets/icon.svg'
].map(path=>new URL(path,self.registration.scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('card-dungeon-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const fresh=await fetch(request,{cache:'no-store'});
    if(fresh&&fresh.ok)await cache.put(request,fresh.clone());
    return fresh;
  }catch{
    return (await cache.match(request,{ignoreSearch:true})) || (await caches.match('./index.html'));
  }
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  const fresh=await fetch(request);
  if(fresh&&fresh.ok)await cache.put(request,fresh.clone());
  return fresh;
}

self.addEventListener('fetch', event => {
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }
  if(NETWORK_FIRST.has(url.pathname)){
    event.respondWith(networkFirst(request));
    return;
  }
  if(IMMUTABLE.has(url.pathname)){
    event.respondWith(cacheFirst(request));
  }
});
