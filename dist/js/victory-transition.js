const fx=document.getElementById('fx');
const screen=document.getElementById('screen');
let active=false,lastKey='';

function enemyHp(){
  const strong=document.querySelector('.battle-stage .enemy-health strong');
  if(!strong)return null;
  const m=(strong.textContent||'').match(/(\d+)/);
  return m?Number(m[1]):null;
}
function enemyName(){return document.querySelector('.battle-stage .battle-enemy h2')?.textContent?.trim()||'ENEMY';}
function stageCenter(){
  const r=document.querySelector('.battle-stage')?.getBoundingClientRect();
  return r?{x:r.left+r.width*.5,y:r.top+r.height*.39}:null;
}
function showVictory(){
  if(active||!fx)return;
  const p=stageCenter();if(!p)return;
  active=true;lastKey=`${enemyName()}-${Date.now()}`;
  const root=document.createElement('div');root.className='victory-transition';
  root.innerHTML='<div class="victory-dark"></div><div class="victory-flash"></div><div class="victory-rays"></div><div class="victory-rings"><i></i><i></i><i></i></div><div class="victory-burst"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="victory-copy"><small>ENEMY DEFEATED</small><b>VICTORY</b><span>戦利品を獲得</span></div>';
  root.style.setProperty('--vx',`${p.x}px`);root.style.setProperty('--vy',`${p.y}px`);
  fx.append(root);
  document.getElementById('app')?.classList.add('victory-hitstop');
  setTimeout(()=>document.getElementById('app')?.classList.remove('victory-hitstop'),120);
  setTimeout(()=>root.classList.add('victory-resolve'),260);
  setTimeout(()=>root.remove(),1500);
  setTimeout(()=>{active=false;},1650);
}
function inspect(){
  if(document.body.dataset.mode!=='battle'){active=false;return;}
  const hp=enemyHp();
  if(hp===0)showVictory();
}
if(screen)new MutationObserver(()=>requestAnimationFrame(inspect)).observe(screen,{subtree:true,childList:true,characterData:true});
window.addEventListener('pagehide',()=>document.querySelectorAll('.victory-transition').forEach(el=>el.remove()));
inspect();
