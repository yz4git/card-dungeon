from pathlib import Path
import re


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'{label}: pattern not found in {path}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

# Keep absolute turn information in aria-label, but make the selected-card marker a tiny ①–⑤ corner badge.
replace_once(
    'dist/js/app.js',
    "extra:b.plan.includes(c.uid)?`<span class=\"assigned-badge\">${base+b.plan.indexOf(c.uid)+1}手目</span>`:''",
    "extra:b.plan.includes(c.uid)?`<span class=\"assigned-badge compact-assigned\" aria-label=\"${base+b.plan.indexOf(c.uid)+1}手目\">${['①','②','③','④','⑤'][b.plan.indexOf(c.uid)]}</span>`:''",
    'compact assigned badge'
)

# Attack/heal origins still belong to the hand center, but the persistent YOU marker belongs just above it.
p=Path('dist/js/battle-actor-fx.js'); s=p.read_text(encoding='utf-8')
old="""  return{\n    enemy:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.46},\n    enemyFx:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.51},\n    player:{x:px,y:py},\n    playerFx:{x:px,y:py-lift}\n  };"""
new="""  const markerY=hand?Math.max(stage.top+stage.height*.62,hand.top-22):py-lift-18;\n  return{\n    enemy:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.46},\n    enemyFx:{x:stage.left+stage.width*.5,y:stage.top+stage.height*.51},\n    player:{x:px,y:py},\n    playerFx:{x:px,y:py-lift},\n    playerMarker:{x:px,y:markerY}\n  };"""
if old not in s: raise SystemExit('battle actor points pattern not found')
s=s.replace(old,new,1).replace('clear();const p=points();if(!p)return;presence(p.player);','clear();const p=points();if(!p)return;presence(p.playerMarker);',1)
p.write_text(s,encoding='utf-8')

# Put the versus-card intro high in the battle stage and make it materially narrower so the enemy remains visible.
p=Path('dist/js/cinematic.js'); s=p.read_text(encoding='utf-8')
s=s.replace("intro.style.top=`${Math.max(r.top+54,r.top+r.height*.38)}px`;","intro.style.top=`${r.top+52}px`;",1)
s=s.replace("intro.style.width=`${Math.min(520,Math.max(250,r.width-20))}px`;","intro.style.width=`${Math.min(340,Math.max(250,r.width-34))}px`;",1)
p.write_text(s,encoding='utf-8')

# Exploration enemies are slightly smaller for corridor readability; active encounter/battle enemies keep full scale and hit deformation.
p=Path('dist/js/scene.js'); s=p.read_text(encoding='utf-8')
old="const sx=2.65*(1+hit*.12),sy=2.65*(1-hit*.08);item.obj.scale.set(sx,sy,1);"
new="const baseScale=item.active?2.65:2.30,sx=baseScale*(1+hit*.12),sy=baseScale*(1-hit*.08);item.obj.scale.set(sx,sy,1);"
if old not in s: raise SystemExit('scene enemy scale pattern not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Final visual layer: preserve the 3D enemy, reduce overlay collisions, and compact portrait exploration spacing.
p=Path('dist/visual-cleanup.css'); s=p.read_text(encoding='utf-8')
marker='/* Real-WebGL review polish v1 */'
if marker not in s:
    s += r'''

/* Real-WebGL review polish v1 */
/* Battle planning should keep the actual Three.js enemy readable instead of crushing it into silhouette. */
body[data-mode="battle"] #world canvas{
  filter:brightness(1.26) contrast(1.02) saturate(1.04)!important;
}
body[data-mode="battle"] .vignette{
  background:
    linear-gradient(180deg,#02070c75 0%,transparent 19%,transparent 69%,#02070c78 91%,#02070ca8 100%),
    radial-gradient(ellipse at 50% 42%,transparent 53%,#02060d30 100%)!important;
}
.battle-layout.planning-enhanced .battle-stage{
  box-shadow:inset 0 0 54px #0004!important;
}

/* Keep the turn/card identity, but park it above the enemy rather than across its face and torso. */
.cinematic-turn{z-index:44!important;filter:drop-shadow(0 7px 16px #000b)!important}
.cinematic-turn .cine-turn-no{padding:3px 10px!important;font-size:8px!important;letter-spacing:2.3px!important}
.cinematic-turn .cine-card-row{grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr)!important;gap:5px!important;margin-top:5px!important}
.cinematic-turn .cine-card{min-height:34px!important;padding:4px 7px!important;border-radius:6px!important;background:linear-gradient(180deg,#10202bcc,#081118df)!important}
.cinematic-turn .cine-card i{width:21px!important;height:21px!important;font-size:14px!important}
.cinematic-turn .cine-card b{font-size:10px!important}
.cinematic-turn .cine-clash{font-size:17px!important}

/* YOU is a locator, not a card-covering effect. Attack/heal coordinates remain unchanged in JS. */
.actor-player-presence{width:116px!important;height:48px!important;opacity:.72!important;filter:drop-shadow(0 0 11px #69d9d360)!important}
.actor-player-presence:before{width:92px!important;height:20px!important}
.actor-player-presence i{width:52px!important;bottom:10px!important}
.actor-player-presence b{bottom:-4px!important;font-size:6px!important;letter-spacing:2.2px!important}

/* Selected hand cards use a small ①–⑤ corner marker. Never cover the card power/name again. */
.battle-layout .hand-scroll .game-card .assigned-badge.compact-assigned{
  inset:4px 4px auto auto!important;transform:none!important;width:18px!important;height:18px!important;min-width:18px!important;
  padding:0!important;display:grid!important;place-items:center!important;border-radius:50%!important;overflow:visible!important;text-indent:0!important;
  background:#e7ce8deb!important;border:1px solid #fff0bc!important;color:#0a141b!important;font:900 10px/1 ui-sans-serif,-apple-system,sans-serif!important;
  box-shadow:0 2px 8px #0008,0 0 9px #dbbd692e!important;z-index:9!important
}
.battle-layout .hand-scroll .game-card:has(.compact-assigned) .rank{margin-right:20px!important}

/* Pull only the exploration information upward; the movement pad remains anchored and unobstructed. */
@media(max-aspect-ratio:1/1){
  body[data-mode="explore"] .tile-prompt{transform:translateY(-88px)!important}
  body[data-mode="explore"] .explore-vitals{transform:translateY(-78px)!important}
  body[data-mode="explore"] .explore-bottom{background:linear-gradient(0deg,#050d14eb 0%,#050d14b0 48%,transparent 84%)!important}
  .encounter-stage .encounter-health{right:10px!important;bottom:12px!important;width:min(150px,39vw)!important}
  .actor-player-presence{width:104px!important;height:44px!important}
}
'''
p.write_text(s,encoding='utf-8')

# Force fresh CSS/JS on iPhone after the visual pass.
p=Path('dist/sw.js'); s=p.read_text(encoding='utf-8')
s2=re.sub(r"card-dungeon-v1\.1\.\d+",'card-dungeon-v1.1.5',s,count=1)
if s2==s: raise SystemExit('service worker cache version pattern not found')
p.write_text(s2,encoding='utf-8')

print('Applied real-WebGL review polish')
