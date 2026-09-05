const screen=document.getElementById('screen');

const TYPE_LABEL={attack:'攻撃',guard:'防御',heal:'回復',focus:'集中'};
const TYPE_GLYPH={attack:'↗',guard:'◇',heal:'✚',focus:'◆'};

function typeOf(el){
  return ['attack','guard','heal','focus'].find(type=>el?.classList?.contains(type))||null;
}
function adviceFor(enemyType){
  if(enemyType==='attack')return{lead:'敵は攻撃',text:'防御カードで受けるのが基本',recommended:'guard'};
  if(enemyType==='guard')return{lead:'敵は防御',text:'攻撃カードで盾を崩しやすい',recommended:'attack'};
  if(enemyType==='heal')return{lead:'敵は回復',text:'攻撃を通す好機。火力を合わせよう',recommended:'attack'};
  if(enemyType==='focus')return{lead:'敵は集中',text:'次の強化に備えるか、今のうちに攻める',recommended:'attack'};
  return{lead:'敵の手を確認',text:'カードを選んでこの手への答えを置こう',recommended:null};
}
function matchup(enemyType,playerType){
  if(!enemyType||!playerType)return'';
  if(enemyType==='attack'&&playerType==='guard')return'counter';
  if(enemyType==='guard'&&playerType==='attack')return'counter';
  if(enemyType==='attack'&&(playerType==='heal'||playerType==='focus'))return'risk';
  return'neutral';
}
function makeBadge(text,cls){
  const span=document.createElement('span');
  span.className=`planning-badge ${cls}`;
  span.textContent=text;
  return span;
}

function enhancePlanning(){
  const layout=document.querySelector('.battle-layout');
  if(!layout)return;
  const panel=layout.querySelector('.battle-panel');
  if(!panel)return;
  const phase=panel.querySelector('.battle-heading .eyebrow')?.textContent||'';
  const planning=!phase.includes('RESOLVING');
  layout.classList.toggle('planning-enhanced',planning);
  if(!planning)return;

  let board=panel.querySelector('.duel-board');
  if(!board){
    const forecastLabel=panel.querySelector('.forecast-label');
    const forecast=panel.querySelector('.forecast');
    const planLabel=panel.querySelector('.plan-label');
    const slots=panel.querySelector('.plan-slots');
    if(!forecastLabel||!forecast||!planLabel||!slots)return;
    board=document.createElement('section');
    board.className='duel-board';
    board.setAttribute('aria-label','敵の予告とあなたの5手');
    panel.insertBefore(board,forecastLabel);
    board.append(forecastLabel,forecast,planLabel,slots);
    const lanes=document.createElement('div');
    lanes.className='duel-lanes';
    lanes.setAttribute('aria-hidden','true');
    lanes.innerHTML='<span><b>1</b></span><span><b>2</b></span><span><b>3</b></span><span><b>4</b></span><span><b>5</b></span>';
    board.prepend(lanes);
    forecastLabel.querySelector('span:first-child')?.replaceChildren(document.createTextNode('敵の5手'));
    planLabel.querySelector('span:first-child')?.replaceChildren(document.createTextNode('あなたの答え'));
  }

  const forecasts=[...board.querySelectorAll('.forecast-card')];
  const slots=[...board.querySelectorAll('.plan-slot')];
  const targetIndex=Math.max(0,slots.findIndex(slot=>slot.classList.contains('target')));

  forecasts.forEach((card,index)=>{
    card.classList.toggle('paired-target',index===targetIndex);
    const type=typeOf(card);
    if(type){card.dataset.kind=TYPE_LABEL[type];card.dataset.glyph=TYPE_GLYPH[type];}
  });

  slots.forEach((slot,index)=>{
    const old=slot.querySelector('.planning-badge');
    old?.remove();
    slot.classList.remove('match-counter','match-risk','match-neutral');
    const enemyType=typeOf(forecasts[index]);
    const playerType=typeOf(slot);
    const relation=matchup(enemyType,playerType);
    if(relation){
      slot.classList.add(`match-${relation}`);
      if(relation==='counter')slot.append(makeBadge('好相性','counter'));
      else if(relation==='risk')slot.append(makeBadge('攻撃注意','risk'));
    }
  });

  let guide=panel.querySelector('.pick-guide');
  if(!guide){
    guide=document.createElement('div');
    guide.className='pick-guide';
    const handLabel=panel.querySelector('.hand-label');
    handLabel?.insertAdjacentElement('afterend',guide);
  }
  const enemyType=typeOf(forecasts[targetIndex]);
  const info=adviceFor(enemyType);
  guide.innerHTML=`<span class="pick-turn">${targetIndex+1}手目</span><span class="pick-enemy ${enemyType||''}">${enemyType?TYPE_GLYPH[enemyType]:'?'} ${info.lead}</span><strong>${info.text}</strong>`;

  const handCards=[...panel.querySelectorAll('.hand-scroll .game-card')];
  handCards.forEach(card=>{
    const type=typeOf(card);
    const recommended=!!info.recommended&&type===info.recommended;
    card.classList.toggle('planning-recommended',recommended);
    card.dataset.kind=type?TYPE_LABEL[type]:'';
    if(recommended)card.dataset.pick='おすすめ';else delete card.dataset.pick;
  });

  const activeLane=board.querySelectorAll('.duel-lanes span')[targetIndex];
  board.querySelectorAll('.duel-lanes span').forEach((lane,index)=>lane.classList.toggle('active',index===targetIndex));
  activeLane?.setAttribute('data-state','選択中');
}

let queued=false;
function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;enhancePlanning();});
}

if(screen)new MutationObserver(queue).observe(screen,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  if(event.target.closest?.('.battle-layout'))queue();
},true);
queue();
