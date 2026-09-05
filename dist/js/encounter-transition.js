const screen=document.getElementById('screen');
const fx=document.getElementById('fx');
const app=document.getElementById('app');
const state={lastKey:null,timers:[]};
const later=(fn,ms)=>{const id=setTimeout(fn,ms);state.timers.push(id);return id;};
function clear(){state.timers.forEach(clearTimeout);state.timers=[];fx?.querySelectorAll('.encounter-cinematic').forEach(el=>el.remove());app?.classList.remove('encounter-contacting');}
function run(){
  const encounter=screen?.querySelector('.encounter-screen');
  if(!encounter)return;
  const name=encounter.querySelector('.encounter-label h2')?.textContent?.trim()||'UNKNOWN';
  const rank=encounter.querySelector('.encounter-label .eyebrow')?.textContent?.trim()||'ENCOUNTER';
  const key=`${name}|${rank}`;
  if(state.lastKey===key)return;
  state.lastKey=key;
  clear();
  app?.classList.add('encounter-contacting');
  const layer=document.createElement('div');
  layer.className='encounter-cinematic';
  layer.innerHTML=`<div class="encounter-vignette"></div><div class="encounter-scan"></div><div class="encounter-lock"><i></i><i></i><i></i><i></i><span>CONTACT</span></div><div class="encounter-title"><small>${rank}</small><b>ENCOUNTER</b><strong>${name}</strong></div><div class="encounter-flash"></div>`;
  fx?.append(layer);
  later(()=>layer.classList.add('phase-two'),210);
  later(()=>layer.classList.add('phase-three'),480);
  later(()=>{layer.remove();app?.classList.remove('encounter-contacting');},920);
}
let queued=false;
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run();});}
if(screen)new MutationObserver(queue).observe(screen,{childList:true,subtree:true});
window.addEventListener('pagehide',clear);
queue();
