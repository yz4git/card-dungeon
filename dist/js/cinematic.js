const fx=document.getElementById('fx');
const screen=document.getElementById('screen');
const app=document.getElementById('app');
const state={lastTurn:null,queued:false,timers:[]};

const glyph=type=>({attack:'↗',guard:'◇',heal:'✚',focus:'◆'})[type]||'◆';
const cardType=el=>['attack','guard','heal','focus'].find(type=>el?.classList.contains(type))||'focus';
const numberFrom=(text,re)=>{const m=text.match(re);return m?Number(m[1]):0;};
const center=el=>{
  if(!el)return null;
  const r=el.getBoundingClientRect();
  return{x:r.left+r.width/2,y:r.top+r.height/2};
};
const later=(fn,delay)=>{
  const id=setTimeout(fn,delay);
  state.timers.push(id);
  return id;
};

function clearTimers(){
  state.timers.forEach(clearTimeout);
  state.timers.length=0;
}
function clearCinematic(){
  clearTimers();
  fx?.querySelectorAll('[class*="cinematic-"],[class*="cine-"]').forEach(el=>el.remove());
  app?.classList.remove('cine-shake-light','cine-shake-heavy','cine-hitstop');
}
function make(className,parent=fx){
  const el=document.createElement('div');
  el.className=className;
  parent?.append(el);
  return el;
}
function place(el,point){
  if(!el||!point)return;
  el.style.left=`${point.x}px`;
  el.style.top=`${point.y}px`;
}
function stageRect(){
  return document.querySelector('.battle-stage')?.getBoundingClientRect()||null;
}
function getPoints(){
  const enemy=document.querySelector('.battle-stage .portrait')||document.querySelector('.battle-enemy');
  const player=document.querySelector('.player-vitals');
  return{enemy:center(enemy),player:center(player)};
}
function cardIntro(data){
  const r=stageRect();
  if(!r||!fx)return;
  const intro=make('cinematic-turn');
  intro.style.left=`${r.left+r.width/2}px`;
  intro.style.top=`${r.top+52}px`;
  intro.style.width=`${Math.min(340,Math.max(250,r.width-34))}px`;
  intro.innerHTML=
    `<div class="cine-turn-no">TURN ${String(data.turn).padStart(2,'0')}</div>`+
    `<div class="cine-card-row">`+
      `<div class="cine-card cine-player ${data.playerType}"><i>${glyph(data.playerType)}</i><b>${data.playerCard}</b></div>`+
      `<span class="cine-clash">×</span>`+
      `<div class="cine-card cine-enemy ${data.enemyType}"><i>${glyph(data.enemyType)}</i><b>${data.enemyCard}</b></div>`+
    `</div>`;
}
function flash(kind){
  if(!fx)return;
  const el=make(`cinematic-flash ${kind}`);
  later(()=>el.remove(),360);
}
function shake(heavy=false){
  if(!app)return;
  const cls=heavy?'cine-shake-heavy':'cine-shake-light';
  app.classList.remove(cls);
  void app.offsetWidth;
  app.classList.add(cls,'cine-hitstop');
  later(()=>app.classList.remove('cine-hitstop'),95);
  later(()=>app.classList.remove(cls),430);
}
function ring(point,kind){
  if(!point)return;
  const el=make(`cinematic-ring ${kind}`);
  place(el,point);
}
function sparks(point,kind,count=12){
  if(!point||!fx)return;
  const box=make(`cinematic-sparks ${kind}`);
  place(box,point);
  for(let i=0;i<count;i++){
    const s=document.createElement('i');
    const angle=(Math.PI*2*i/count)+(i%2)*.17;
    const distance=38+(i%5)*12;
    s.style.setProperty('--dx',`${Math.cos(angle)*distance}px`);
    s.style.setProperty('--dy',`${Math.sin(angle)*distance}px`);
    s.style.setProperty('--delay',`${(i%4)*18}ms`);
    box.append(s);
  }
}
function trail(from,to,kind){
  if(!from||!to||!fx)return;
  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const el=make(`cinematic-trail ${kind}`);
  el.style.left=`${from.x}px`;
  el.style.top=`${from.y}px`;
  el.style.width=`${distance}px`;
  el.style.transform=`rotate(${angle}deg)`;
}
function slash(point,kind){
  if(!point||!fx)return;
  const box=make(`cinematic-slash ${kind}`);
  place(box,point);
  box.innerHTML='<i></i><i></i><i></i>';
}
function shield(point,kind){
  if(!point||!fx)return;
  const el=make(`cinematic-shield ${kind}`);
  place(el,point);
  el.innerHTML='<i>◇</i>';
}
function aura(point,kind,symbol){
  if(!point||!fx)return;
  const el=make(`cinematic-aura ${kind}`);
  place(el,point);
  el.innerHTML=`<i>${symbol}</i><span></span><span></span>`;
}
function resultNumber(point,text,kind){
  if(!point||!fx||!text)return;
  const el=make(`cinematic-number ${kind}`);
  el.textContent=text;
  place(el,point);
}
function action(type,from,to,side,blocked=false){
  if(type==='attack'){
    trail(from,to,side);
    later(()=>{
      slash(to,side);
      ring(to,blocked?'block':side);
      sparks(to,side,14);
      flash(side);
      shake(!blocked);
    },180);
  }else if(type==='guard'){
    shield(from,side);
    ring(from,'guard');
  }else if(type==='heal'){
    aura(from,'heal','✚');
    ring(from,'heal');
  }else{
    aura(from,'focus','◆');
    ring(from,'focus');
  }
}
function play(data){
  if(!fx)return;
  clearCinematic();
  const points=getPoints();
  if(!points.player||!points.enemy)return;
  cardIntro(data);
  flash('turn');

  later(()=>{
    action(data.playerType,points.player,points.enemy,'player',data.enemyBlocked);
    if(data.playerType==='heal'&&data.healPlayer>0)resultNumber(points.player,`+${data.healPlayer}`,'heal');
  },230);

  later(()=>{
    action(data.enemyType,points.enemy,points.player,'enemy',data.playerBlocked);
  },650);

  later(()=>{
    if(data.enemyDamage>0)resultNumber(points.enemy,`−${data.enemyDamage}`,'enemy-damage');
    else if(data.enemyBlocked)resultNumber(points.enemy,'BLOCK','block');
    if(data.playerDamage>0)resultNumber(points.player,`−${data.playerDamage}`,'player-damage');
    else if(data.playerBlocked)resultNumber(points.player,'BLOCK','block');
  },890);

  later(()=>{
    const r=stageRect();
    if(!r)return;
    const beat=make('cinematic-beat');
    beat.style.left=`${r.left+r.width/2}px`;
    beat.style.top=`${Math.min(r.bottom-42,r.top+r.height*.68)}px`;
    beat.textContent='NEXT';
  },1660);

  later(clearCinematic,2080);
}

function readTurn(){
  const feedback=document.querySelector('.battle-feedback');
  if(!feedback){state.lastTurn=null;return null;}
  const label=feedback.querySelector(':scope > .eyebrow')?.textContent?.trim()||'';
  if(!label.startsWith('TURN'))return null;
  const heading=feedback.querySelector(':scope > h3')?.textContent?.trim()||'';
  const parts=heading.split(/\s+vs\s+/i);
  if(parts.length<2)return null;
  const summary=feedback.querySelector(':scope > p')?.textContent||'';
  const detail=feedback.querySelector(':scope > small')?.textContent||'';
  const details=detail.split(' · ').map(item=>item.trim()).filter(Boolean);
  return{
    label,
    turn:label.replace(/\D/g,'')||'',
    playerCard:parts[0],
    enemyCard:parts[1],
    enemyDamage:numberFrom(summary,/敵に\s*(\d+)/),
    playerDamage:numberFrom(summary,/被ダメージ\s*(\d+)/),
    healPlayer:numberFrom(summary,/回復\s*(\d+)/),
    playerBlocked:details.includes('攻撃を防いだ'),
    enemyBlocked:details.includes('敵が攻撃を防いだ'),
    playerType:cardType(document.querySelector('.plan-slot.active')),
    enemyType:cardType(document.querySelector('.forecast-card.active'))
  };
}
function enhance(){
  const data=readTurn();
  if(!data)return;
  if(state.lastTurn===data.label)return;
  state.lastTurn=data.label;
  play(data);
}
function queue(){
  if(state.queued)return;
  state.queued=true;
  requestAnimationFrame(()=>{
    state.queued=false;
    enhance();
  });
}

if(screen)new MutationObserver(queue).observe(screen,{childList:true,subtree:true});
window.addEventListener('pagehide',clearCinematic);
queue();
