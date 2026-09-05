const CACHE = 'card-dungeon-v1.0.0';
const CORE = ['./','./index.html','./style.css','./js/app.js','./js/data.js','./js/engine.js','./js/audio.js','./js/scene.js','./lib/three.module.min.js','./assets/enemies.webp','./assets/icon.svg','./manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  // Never skipWaiting or reload an active game. A new version activates after all tabs close.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('card-dungeon-')&&key!==CACHE).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==location.origin||!CORE.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
