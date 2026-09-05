import { CARDS } from './data.js';

const fx=document.getElementById('fx');
const screen=document.getElementById('screen');
const app=document.getElementById('app');
const BY_NAME=Object.fromEntries(Object.values(CARDS).map(card=>[card.name,card]));
const state={last:null,timers:[],queued:false};
const num=(text,re)=>{const m=text.match(re);return m?Number(m[1]):0;};
const later=(fn,ms)=>{const id=setTimeout(fn,ms);state.timers.push(id);return id;};
function clear(){state.timers.forEach(clearTimeout);state.timers=[];fx?.querySelectorAll('[class*="actor-"]').forEach(el=>el.remove());app?.classList.remove('actor-counter-hitstop');}
function make(cls){const el=document.createElement('div');el.className=cls;fx?.append(el);return el;}
function place(el,p){if(!el||!p)return;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;}
function points(){
  const stage=document.querySelector('.battle-stage')?.getBoundingClientRect();
  if(!stage)return null;
  const hand=document.querySelector('.battle-panel .hand-scroll')?.getBoundingClientRect();
  const px=stage.left+stage.width*.5;
  const py=hand?hand.top+hand.height*.5:stage.bottom-Math.max(36,Math.min(62,stage.height*.09));
  const lift=hand?Math.min(28,Math.max(18,hand.height*.16)):22;
  return{
    enemy:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.46},
    enemyFx:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.51},
    player:{x:px,y:py},
    playerFx:{x:px,y:py-lift}
  };
}
function presence(p){const el=make('actor-player-presence');place(el,p);el.innerHTML='<i></i><i></i><b>YOU</b>';}
function beam(from,to,side,pierce=false,counter=false){
  if(!from||!to)return;
  const rdx=to.x-from.x,rdy=to.y-from.y,rd=Math.hypot(rdx,rdy)||1;
  const lane=counter?(side==='player'?13:-13):(side==='player'?-8:8),nx=-rdy/rd,ny=rdx/rd;
  const sx=from.x+nx*lane,sy=from.y+ny*lane,tx=to.x+nx*lane,ty=to.y+ny*lane;
  const dx=tx-sx,dy=ty-sy,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;
  const el=make(`actor-beam ${side}${pierce?' pierce':''}${counter?' counter':''}`);
  el.style.left=`${sx}px`;el.style.top=`${sy}px`;el.style.width=`${d}px`;el.style.transform=`rotate(${a}deg)`;
  el.innerHTML='<i class="actor-beam-glow"></i><i class="actor-beam-core"></i><i class="actor-beam-edge"></i><span></span><span></span><span></span><span></span>';
}
function impact(p,side,kind='hit',label=''){const el=make(`actor-impact ${side} ${kind}`);place(el,p);el.innerHTML='<i></i><i></i><i></i><i></i><b></b>'+(label?`<span>${label}</span>`:'');}
function shield(p,side,strong=false){const el=make(`actor-shield ${side}${strong?' strong':''}`);place(el,p);el.innerHTML='<i></i><i></i><i></i><b>◇</b><span>'+(strong?'BLOCK':'GUARD')+'</span>';}
function poison(p,side,tick=0,applied=false){const el=make(`actor-poison ${side}${applied?' applied':''}`);place(el,p);el.innerHTML=`<b>${tick?`POISON −${tick}`:applied?'POISON ×3':'POISON'}</b>`+Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('');}
function aura(p,kind,symbol,label,count=3){const el=make(`actor-aura ${kind}`);place(el,p);el.innerHTML=`<b>${symbol}</b><span>${label}</span>${Array.from({length:count},()=>'<i></i>').join('')}`;}
function drain(from,to,side){if(!from||!to)return;const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;const el=make(`actor-drain ${side}`);el.style.left=`${from.x}px`;el.style.top=`${from.y}px`;el.style.width=`${d}px`;el.style.transform=`rotate(${a}deg)`;el.innerHTML='<i></i><i></i><i></i>';}
function hitPlayer(p){const el=make('actor-player-hit');place(el,p);el.innerHTML='<i></i><i></i><b></b>';}
function counterStrike(from,to,side){
  beam(from,to,side,false,true);impact(to,side,'counter','COUNTER');
  app?.classList.remove('actor-counter-hitstop');if(app)void app.offsetWidth;app?.classList.add('actor-counter-hitstop');
  later(()=>app?.classList.remove('actor-counter-hitstop'),150);
}
function action(def,type,from,to,side,blocked=false,dealt=0){
  if(type==='attack'){
    beam(from,to,side,!!def?.pierce,false);
    later(()=>{impact(to,side,def?.pierce?'pierce':'hit',def?.pierce?'PIERCE':def?.shatter?'SHATTER':def?.ambush?'AMBUSH':'');if(blocked)shield(to,side,true);if(side==='enemy'&&dealt>0)hitPlayer(to);},170);
  }else if(type==='guard')shield(from,side,false);
  else if(type==='heal')aura(from,'heal','✚','RECOVER',4);
  else aura(from,'focus','◆','FOCUS',3);
  if(def?.cleanse)later(()=>aura(from,'cleanse','✦','CLEANSE',2),70);
  if(def?.regen)later(()=>aura(from,'regen','＋','REGEN',3),170);
  if(def?.poison&&dealt>0)later(()=>poison(to,side,0,true),300);
  if(def?.drain&&dealt>0)later(()=>drain(to,from,side),360);
}
function read(){
  const fb=document.querySelector('.battle-feedback');if(!fb){state.last=null;return null;}
  const label=fb.querySelector(':scope > .eyebrow')?.textContent?.trim()||'';if(!label.startsWith('TURN'))return null;
  const h=fb.querySelector(':scope > h3')?.textContent?.trim()||'',parts=h.split(/\s+vs\s+/i);if(parts.length<2)return null;
  const summary=fb.querySelector(':scope > p')?.textContent||'',detail=fb.querySelector(':scope > small')?.textContent||'';
  return{label,playerCard:parts[0],enemyCard:parts[1],playerType:['attack','guard','heal','focus'].find(t=>document.querySelector('.plan-slot.active')?.classList.contains(t))||'focus',enemyType:['attack','guard','heal','focus'].find(t=>document.querySelector('.forecast-card.active')?.classList.contains(t))||'focus',enemyDamage:num(summary,/敵に\s*(\d+)/),playerDamage:num(summary,/被ダメージ\s*(\d+)/),playerBlocked:detail.includes('攻撃を防いだ'),enemyBlocked:detail.includes('敵が攻撃を防いだ'),playerCounter:num(detail,/あなたの反撃\s*(\d+)/),enemyCounter:num(detail,/敵の反撃\s*(\d+)/),playerPoison:num(detail,/あなたに毒\s*(\d+)/),enemyPoison:num(detail,/敵に毒\s*(\d+)/)};
}
function play(data){
  clear();const p=points();if(!p)return;presence(p.player);
  const pd=BY_NAME[data.playerCard]||{},ed=BY_NAME[data.enemyCard]||{};
  const playerFrom=data.playerType==='attack'?p.player:p.playerFx;
  const enemyFrom=data.enemyType==='attack'?p.enemy:p.enemyFx;
  later(()=>action(pd,data.playerType,playerFrom,p.enemy,'player',data.enemyBlocked,data.enemyDamage),220);
  later(()=>action(ed,data.enemyType,enemyFrom,p.player,'enemy',data.playerBlocked,data.playerDamage),650);
  later(()=>{
    if(data.playerCounter)counterStrike(p.player,p.enemy,'player');
    if(data.enemyCounter)counterStrike(p.enemy,p.player,'enemy');
    if(data.enemyPoison)poison(p.enemy,'player',data.enemyPoison,false);
    if(data.playerPoison)poison(p.playerFx,'enemy',data.playerPoison,false);
  },900);
  later(clear,2180);
}
function enhance(){const d=read();if(!d||d.label===state.last)return;state.last=d.label;play(d);}
function queue(){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;enhance();});}
if(screen)new MutationObserver(queue).observe(screen,{childList:true,subtree:true});window.addEventListener('pagehide',clear);queue();
