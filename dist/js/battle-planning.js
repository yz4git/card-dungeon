const screen=document.getElementById('screen');

const TYPE_LABEL={attack:'攻撃',guard:'防御',heal:'回復',focus:'集中'};

function typeOf(el){
  return ['attack','guard','heal','focus'].find(type=>el?.classList?.contains(type))||null;
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
    planLabel.querySelector('span:first-child')?.replaceChildren(document.createTextNode('あなたの5手'));
  }

  // Recommendation/advice UI is intentionally disabled. The player reads the enemy
  // forecast and decides freely; only the currently edited lane is highlighted.
  panel.querySelector('.pick-guide')?.remove();
  board.querySelectorAll('.planning-badge').forEach(el=>el.remove());

  const forecasts=[...board.querySelectorAll('.forecast-card')];
  const slots=[...board.querySelectorAll('.plan-slot')];
  const foundTarget=slots.findIndex(slot=>slot.classList.contains('target'));
  const targetIndex=Math.max(0,foundTarget);

  forecasts.forEach((card,index)=>{
    card.classList.toggle('paired-target',index===targetIndex);
    const type=typeOf(card);
    if(type)card.dataset.kind=TYPE_LABEL[type];
  });

  slots.forEach(slot=>{
    slot.classList.remove('match-counter','match-risk','match-neutral');
    slot.querySelectorAll('.planning-badge').forEach(el=>el.remove());
  });

  const handCards=[...panel.querySelectorAll('.hand-scroll .game-card')];
  handCards.forEach(card=>{
    const type=typeOf(card);
    card.classList.remove('planning-recommended');
    delete card.dataset.pick;
    card.dataset.kind=type?TYPE_LABEL[type]:'';
  });

  board.querySelectorAll('.duel-lanes span').forEach((lane,index)=>{
    lane.classList.toggle('active',index===targetIndex);
    if(index===targetIndex)lane.setAttribute('data-state','選択中');
    else lane.removeAttribute('data-state');
  });
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
