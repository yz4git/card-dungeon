import { CARDS } from './data.js';

const fx=document.getElementById('fx');
const screen=document.getElementById('screen');
const BY_NAME=Object.fromEntries(Object.values(CARDS).map(card=>[card.name,card]));
const state={last:null,timers:[],queued:false};
const num=(text,re)=>{const m=text.match(re);return m?Number(m[1]):0;};
const later=(fn,ms)=>{const id=setTimeout(fn,ms);state.timers.push(id);return id;};
function clear(){state.timers.forEach(clearTimeout);state.timers=[];fx?.querySelectorAll('[class*="actor-"]').forEach(el=>el.remove());}
function make(cls){const el=document.createElement('div');el.className=cls;fx?.append(el);return el;}
function place(el,p){if(!el||!p)return;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;}
function points(){const r=document.querySelector('.battle-stage')?.getBoundingClientRect();if(!r)return null;return{enemy:{x:r.left+r.width*.5,y:r.top+r.height*.39},player:{x:r.left+r.width*.5,y:r.bottom-Math.max(36,Math.min(62,r.height*.09))}};}
function presence(p){const el=make('actor-player-presence');place(el,p);el.innerHTML='<i></i><i></i><b>YOU</b>';}
function beam(from,to,side,pierce=false,counter=false){if(!from||!to)return;const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;const el=make(`actor-beam ${side}${pierce?' pierce':''}${counter?' counter':''}`);el.style.left=`${from.x}px`;el.style.top=`${from.y}px`;el.style.width=`${d}px`;el.style.transform=`rotate(${a}deg)`;el.innerHTML='<i class="actor-beam-glow"></i><i class="actor-beam-core"></i><i class="actor-beam-edge"></i><span></span><span></span><span></span><span></span>';}
function impact(p,side,kind='hit',label=''){const el=make(`actor-impact ${side} ${kind}`);place(el,p);el.innerHTML='<i></i><i></i><i></i><i></i><b></b>'+(label?`<span>${label}</span>`:'');}
function shield(p,side,strong=false){const el=make(`actor-shield ${side}${strong?' strong':''}`);place(el,p);el.innerHTML='<i></i><i></i><i></i><b>◇</b><span>'+(strong?'BLOCK':'GUARD')+'</span>';}
function poison(p,side,tick=0){const el=make(`actor-poison ${side}`);place(el,p);el.innerHTML=`<b>${tick?`POISON −${tick}`:'POISON'}</b>`+Array.from({length:10},(_,i)=>`<i style="--i:${i}"></i>`).join('');}
function aura(p,kind,symbol,label,count=3){const el=make(`actor-aura ${kind}`);place(el,p);el.innerHTML=`<b>${symbol}</b><span>${label}</span>${Array.from({length:count},()=>'<i></i>').join('')}`;}
function drain(from,to,side){if(!from||!to)return;const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;const el=make(`actor-drain ${side}`);el.style.left=`${from.x}px`;el.style.top=`${from.y}px`;el.style.width=`${d}px`;el.style.transform=`rotate(${a}deg)`;el.innerHTML='<i></i><i></i><i></i>';}
function hitPlayer(p){const el=make('actor-player-hit');place(el,p);el.innerHTML='<i></i><i></i><b></b>';}
function action(def,type,from,to,side,blocked=false,dealt=0){
  if(type==='attack'){
    beam(from,to,side,!!def?.pierce,false);
    later(()=>{impact(to,side,def?.pierce?'pierce':'hit',def?.pierce?'PIERCE':def?.shatter?'SHATTER':def?.ambush?'AMBUSH':'');if(blocked)shield(to,side,true);if(side==='enemy'&&dealt>0)hitPlayer(to);},170);
  }else if(type==='guard')shield(from,side,false);
  else if(type==='heal')aura(from,'heal','✚','RECOVER',4);
  else aura(from,'focus','◆','FOCUS',3);
  if(def?.cleanse)later(()=>aura(from,'cleanse','✦','CLEANSE',2),70);
  if(def?.regen)later(()=>aura(from,'regen','＋','REGEN',3),170);
  if(def?.poison&&dealt>0)later(()=>poison(to,side,0),300);
  if(def?.drain&&dealt>0)later(()=>drain(to,from,side),360);
}
function read(){
  const fb=document.querySelector('.battle-feedback');if(!fb){state.last=null;return null;}
  const label=fb.querySelector(':scope > .eyebrow')?.textContent?.trim()||'';if(!label.startsWith('TURN'))return null;
  const h=fb.querySelector(':scope > h3')?.textContent?.trim()||'',parts=h.split(/\s+vs\s+/i);if(parts.length<2)return null;
  const summary=fb.querySelector(':scope > p')?.textContent||'',detail=fb.querySelector(':scope > small')?.textContent||'';
  return{label,playerCard:parts[0],enemyCard:parts[1],playerType:['attack','guard','heal','focus'].find(t=>document.querySelector('.plan-slot.active')?.classList.contains(t))||'focus',enemyType:['attack','guard','heal','focus'].find(t=>document.querySelector('.forecast-card.active')?.classList.contains(t))||'focus',enemyDamage:num(summary,/敵に\s*(\d+)/),playerDamage:num(summary,/被ダメージ\s*(\d+)/),playerBlocked:detail.includes('攻撃を防いだ'),enemyBlocked:detail.includes('敵が攻撃を防いだ'),playerCounter:num(detail,/あなたの反撃\s*(\d+)/),enemyCounter:num(detail,/敵の反撃\s*(\d+)/),playerPoison:num(detail,/あなたに毒\s*(\d+)/),enemyPoison:num(detail,/敵に毒\s*(\d+)/)};
}
function play(data){clear();const p=points();if(!p)return;presence(p.player);const pd=BY_NAME[data.playerCard]||{},ed=BY_NAME[data.enemyCard]||{};later(()=>action(pd,data.playerType,p.player,p.enemy,'player',data.enemyBlocked,data.enemyDamage),220);later(()=>action(ed,data.enemyType,p.enemy,p.player,'enemy',data.playerBlocked,data.playerDamage),650);later(()=>{if(data.playerCounter){beam(p.player,p.enemy,'player',false,true);impact(p.enemy,'player','counter','COUNTER');}if(data.enemyCounter){beam(p.enemy,p.player,'enemy',false,true);impact(p.player,'enemy','counter','COUNTER');}if(data.enemyPoison)poison(p.enemy,'player',data.enemyPoison);if(data.playerPoison)poison(p.player,'enemy',data.playerPoison);},900);later(clear,2050);}
function enhance(){const d=read();if(!d||d.label===state.last)return;state.last=d.label;play(d);}
function queue(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;enhance();});}
if(screen)new MutationObserver(queue).observe(screen,{childList:true,subtree:true});window.addEventListener('pagehide',clear);queue();
