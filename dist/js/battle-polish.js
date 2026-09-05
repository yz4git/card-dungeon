import { CARDS } from './data.js';

const screen=document.getElementById('screen');
const fx=document.getElementById('fx');
const defsByName=new Map(Object.entries(CARDS).map(([key,def])=>[def.name,{key,...def}]));

function traitsFor(def){
  if(!def)return[];
  const out=[];
  if(def.pierce)out.push(['防御無視','pierce']);
  if(def.shatter)out.push(['盾砕き','shatter']);
  if(def.ambush)out.push(['隙打ち','ambush']);
  if(def.drain)out.push(['吸収','drain']);
  if(def.poison)out.push(['毒×3','poison']);
  if(def.counter)out.push(['反撃','counter']);
  if(def.cleanse)out.push(['毒解除','cleanse']);
  if(def.regen)out.push(['再生×3','regen']);
  if(def.heal&&def.type!=='heal')out.push(['回復','heal']);
  return out.slice(0,2);
}

function decorateCard(el,role){
  if(!el)return;
  const name=el.querySelector(':scope > strong')?.textContent?.trim()||'';
  const def=defsByName.get(name);
  let strip=el.querySelector(':scope > .effect-traits');
  const traits=traitsFor(def);
  if(!traits.length){
    strip?.remove();
    el.classList.remove('has-effect-traits');
    el.removeAttribute('data-special');
    return;
  }
  if(!strip){
    strip=document.createElement('span');
    strip.className='effect-traits';
    strip.setAttribute('aria-hidden','true');
    el.append(strip);
  }
  strip.replaceChildren(...traits.map(([label,cls])=>{
    const chip=document.createElement('i');
    chip.className=`effect-trait ${cls}`;
    chip.textContent=label;
    return chip;
  }));
  el.classList.add('has-effect-traits');
  el.dataset.special=traits.map(([label])=>label).join('・');
  if(role==='enemy')el.classList.add('enemy-effect-card');
  if(role==='player')el.classList.add('player-effect-card');
}

function decorateBattleCards(){
  const layout=document.querySelector('.battle-layout');
  if(!layout)return;
  layout.querySelectorAll('.forecast-card').forEach(card=>decorateCard(card,'enemy'));
  layout.querySelectorAll('.plan-slot').forEach(slot=>{
    if(slot.querySelector(':scope > strong'))decorateCard(slot,'player');
    else{
      slot.querySelector(':scope > .effect-traits')?.remove();
      slot.classList.remove('has-effect-traits','player-effect-card');
      slot.removeAttribute('data-special');
    }
  });
  layout.querySelectorAll('.hand-scroll .game-card.selected').forEach(card=>decorateCard(card,'player'));
}

function polishTrail(el){
  if(!el||el.dataset.polished==='1')return;
  el.dataset.polished='1';
  const ribbon=document.createElement('span');
  ribbon.className='cine-trail-ribbon';
  const core=document.createElement('span');
  core.className='cine-trail-core';
  el.append(ribbon,core);
  for(let i=0;i<5;i++){
    const shard=document.createElement('i');
    shard.className='cine-trail-shard';
    shard.style.setProperty('--p',`${42+i*12}%`);
    shard.style.setProperty('--d',`${i*24}ms`);
    shard.style.setProperty('--s',`${6+(i%3)*3}px`);
    el.append(shard);
  }
}

function polishSlash(el){
  if(!el||el.dataset.polished==='1')return;
  el.dataset.polished='1';
  while(el.querySelectorAll(':scope > i').length<5)el.append(document.createElement('i'));
  if(!el.querySelector(':scope > b')){
    const flare=document.createElement('b');
    flare.className='cine-impact-flare';
    el.append(flare);
  }
}

function polishFxNode(node){
  if(!(node instanceof Element))return;
  if(node.matches('.cinematic-trail'))polishTrail(node);
  if(node.matches('.cinematic-slash'))polishSlash(node);
  node.querySelectorAll?.('.cinematic-trail').forEach(polishTrail);
  node.querySelectorAll?.('.cinematic-slash').forEach(polishSlash);
}

let queued=false;
function queueCards(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;decorateBattleCards();});
}

if(screen)new MutationObserver(queueCards).observe(screen,{childList:true,subtree:true});
if(fx)new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)polishFxNode(node);
}).observe(fx,{childList:true,subtree:true});

queueCards();
