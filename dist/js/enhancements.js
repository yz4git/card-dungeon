const state={handLeft:0,handTop:0,focusUid:null,keyboardFocus:false,lastTurn:null,queued:false};
const fx=document.getElementById('fx');
const screen=document.getElementById('screen');

function rememberHand(hand=document.querySelector('.hand-scroll')){
  if(!hand)return;
  state.handLeft=hand.scrollLeft;
  state.handTop=hand.scrollTop;
}

function restoreHand(){
  const hand=document.querySelector('.hand-scroll');
  if(!hand)return;
  const maxLeft=Math.max(0,hand.scrollWidth-hand.clientWidth);
  const maxTop=Math.max(0,hand.scrollHeight-hand.clientHeight);
  hand.scrollLeft=Math.min(state.handLeft,maxLeft);
  hand.scrollTop=Math.min(state.handTop,maxTop);
  if(state.keyboardFocus&&state.focusUid){
    const card=[...hand.querySelectorAll('.game-card[data-uid]')].find(item=>item.dataset.uid===state.focusUid);
    if(card)card.focus({preventScroll:true});
  }
}

function cardType(el){
  if(!el)return 'focus';
  return ['attack','guard','heal','focus'].find(type=>el.classList.contains(type))||'focus';
}
function glyph(type){return ({attack:'↗',guard:'◇',heal:'✚',focus:'◆'})[type]||'◆';}
function numberFrom(text,re){const m=text.match(re);return m?Number(m[1]):0;}

function addFlowRow(flow,actor,card,target,type,result){
  const row=document.createElement('div');row.className=`combat-flow-row ${actor==='あなた'?'player-flow':'enemy-flow'} ${type}`;
  const action=document.createElement('span');action.className='combat-action';
  const who=document.createElement('b');who.textContent=actor;
  const move=document.createElement('span');move.textContent=`${glyph(type)} ${card}`;
  const arrow=document.createElement('i');arrow.textContent='→';
  const to=document.createElement('span');to.textContent=target;
  action.append(who,move,arrow,to);
  const outcome=document.createElement('strong');outcome.className='combat-outcome';outcome.textContent=result;
  row.append(action,outcome);flow.append(row);
}

function center(el){
  if(!el)return null;
  const r=el.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
}
function addBeam(from,to,kind,blocked=false){
  if(!fx||!from||!to)return;
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;
  const beam=document.createElement('div');beam.className=`combat-beam ${kind}${blocked?' blocked':''}`;
  beam.style.left=`${from.x}px`;beam.style.top=`${from.y}px`;beam.style.width=`${d}px`;beam.style.transform=`rotate(${a}deg)`;
  fx.append(beam);
}
function addBurst(point,text,kind,offsetY=0){
  if(!fx||!point)return;
  const burst=document.createElement('div');burst.className=`combat-burst ${kind}`;burst.textContent=text;
  burst.style.left=`${point.x}px`;burst.style.top=`${point.y+offsetY}px`;fx.append(burst);
}
function clearCombatFx(){
  if(!fx)return;
  fx.querySelectorAll('.combat-beam,.combat-burst').forEach(el=>el.remove());
}

function playCombatFx(data){
  if(!fx)return;
  clearCombatFx();
  const enemyPoint=center(document.querySelector('.battle-enemy'));
  const playerPoint=center(document.querySelector('.player-vitals'));
  const playerAttacked=data.enemyDamage>0||data.playerType==='attack';
  const enemyAttacked=data.playerDamage>0||data.enemyType==='attack';
  if(playerAttacked)addBeam(playerPoint,enemyPoint,'player-to-enemy',data.enemyDamage===0);
  if(enemyAttacked)addBeam(enemyPoint,playerPoint,'enemy-to-player',data.playerDamage===0);
  if(data.enemyDamage>0)addBurst(enemyPoint,`−${data.enemyDamage}`,'damage-enemy');
  else if(data.enemyBlocked)addBurst(enemyPoint,'BLOCK','block-enemy');
  if(data.playerDamage>0)addBurst(playerPoint,`−${data.playerDamage}`,'damage-player');
  else if(data.playerBlocked)addBurst(playerPoint,'BLOCK','block-player');
  if(data.healPlayer>0)addBurst(playerPoint,`+${data.healPlayer}`,'heal-player',34);
  setTimeout(clearCombatFx,900);
}

function enhanceBattle(){
  restoreHand();
  const feedback=document.querySelector('.battle-feedback');
  if(!feedback){state.lastTurn=null;return;}
  const label=feedback.querySelector(':scope > .eyebrow')?.textContent?.trim()||'';
  if(!label.startsWith('TURN'))return;
  const heading=feedback.querySelector(':scope > h3')?.textContent?.trim()||'';
  const parts=heading.split(/\s+vs\s+/i);
  if(parts.length<2)return;
  const summary=feedback.querySelector(':scope > p')?.textContent||'';
  const detail=feedback.querySelector(':scope > small')?.textContent||'';
  const enemyDamage=numberFrom(summary,/敵に\s*(\d+)/);
  const playerDamage=numberFrom(summary,/被ダメージ\s*(\d+)/);
  const healPlayer=numberFrom(summary,/回復\s*(\d+)/);
  const playerBlocked=playerDamage===0&&detail.includes('攻撃を防いだ');
  const enemyBlocked=enemyDamage===0&&detail.includes('敵が攻撃を防いだ');
  const playerType=cardType(document.querySelector('.plan-slot.active'));
  const enemyType=cardType(document.querySelector('.forecast-card.active'));
  if(!feedback.querySelector('.combat-flow')){
    feedback.classList.add('enhanced-feedback');
    const flow=document.createElement('div');flow.className='combat-flow';
    let playerResult=enemyDamage>0?`敵 −${enemyDamage} HP`:enemyBlocked?'敵 BLOCK':'効果発動';
    if(healPlayer>0)playerResult+=` / 自分 +${healPlayer} HP`;
    const enemyResult=playerDamage>0?`あなた −${playerDamage} HP`:playerBlocked?'あなた BLOCK':'効果発動';
    addFlowRow(flow,'あなた',parts[0],'敵',playerType,playerResult);
    addFlowRow(flow,'敵',parts[1],'あなた',enemyType,enemyResult);
    if(detail){const note=document.createElement('div');note.className='combat-note';note.textContent=detail;flow.append(note);}
    feedback.append(flow);
  }
  if(state.lastTurn!==label){
    state.lastTurn=label;
    playCombatFx({enemyDamage,playerDamage,healPlayer,playerBlocked,enemyBlocked,playerType,enemyType});
  }
}

function queueEnhance(){
  if(state.queued)return;state.queued=true;
  requestAnimationFrame(()=>{state.queued=false;enhanceBattle();});
}

document.addEventListener('scroll',event=>{
  if(event.target?.classList?.contains('hand-scroll'))rememberHand(event.target);
},true);
document.addEventListener('pointerdown',event=>{
  const card=event.target.closest?.('.hand-scroll .game-card[data-uid]');
  if(!card)return;
  rememberHand(card.closest('.hand-scroll'));state.focusUid=card.dataset.uid;state.keyboardFocus=false;
},true);
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const card=document.activeElement?.closest?.('.hand-scroll .game-card[data-uid]');
  if(!card)return;
  rememberHand(card.closest('.hand-scroll'));state.focusUid=card.dataset.uid;state.keyboardFocus=true;
},true);

if(screen)new MutationObserver(queueEnhance).observe(screen,{childList:true,subtree:true});
queueEnhance();
