from pathlib import Path
import re

scene_path=Path('dist/js/scene.js')
scene=scene_path.read_text()

old="""    this.lastFrame=0;this.lastTime=performance.now();
    this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
"""
new="""    this.lastFrame=0;this.lastTime=performance.now();this.activeUntil=performance.now()+1600;this.raf=0;this.frameTimer=0;this.renderFrames=0;
    this.tick=this.tick.bind(this);
    this.visibilityHandler=()=>{if(document.hidden){if(this.raf)cancelAnimationFrame(this.raf);if(this.frameTimer)clearTimeout(this.frameTimer);this.raf=0;this.frameTimer=0;}else{this.lastTime=performance.now();this.wake(1200);}};
    document.addEventListener('visibilitychange',this.visibilityHandler,{passive:true});
    this.schedule();
"""
if old not in scene: raise SystemExit('constructor anchor not found')
scene=scene.replace(old,new,1)

old="""    this.batch(this.stone,walls);this.batch(this.floorMat,floors);this.batch(this.pillarMat,ceilings);this.batch(this.pillarMat,pillars);this.batch(this.trimMat,trims);
  }
"""
new="""    this.batch(this.stone,walls);this.batch(this.floorMat,floors);this.batch(this.pillarMat,ceilings);this.batch(this.pillarMat,pillars);this.batch(this.trimMat,trims);
    // The dungeon geometry never moves after build. Freezing its transforms avoids thousands of matrix checks every rendered frame without changing pixels.
    this.group.traverse(obj=>{if(obj===this.group||obj.isSprite)return;if(obj.matrixAutoUpdate){obj.updateMatrix();obj.matrixAutoUpdate=false;}});
    this.wake(1600);
  }
"""
if old not in scene: raise SystemExit('build anchor not found')
scene=scene.replace(old,new,1)

scene=scene.replace("""  sync(game,instant=false){
    this.mode=game.mode;
""","""  sync(game,instant=false){
    this.mode=game.mode;this.wake(1400);
""",1)

old="""  impact(who,damage){if(who==='enemy'&&damage>0){this.enemyHit=Math.min(.34,.10+damage*.006);this.hitTime=performance.now();return;}this.shake=who==='player'&&damage>0?.12:.025;this.hitTime=performance.now();}
"""
new="""  impact(who,damage){this.wake(1000);if(who==='enemy'&&damage>0){this.enemyHit=Math.min(.34,.10+damage*.006);this.hitTime=performance.now();return;}this.shake=who==='player'&&damage>0?.12:.025;this.hitTime=performance.now();}
"""
if old not in scene: raise SystemExit('impact anchor not found')
scene=scene.replace(old,new,1)

size_re=re.compile(r"  size\(\)\{\n    const width=this\.host\.clientWidth\|\|innerWidth,height=this\.host\.clientHeight\|\|innerHeight;\n    this\.width=width;this\.height=height;\n    if\(this\.fallback\)\{this\.canvas\.width=width\*Math\.min\(devicePixelRatio\|\|1,1\.5\);this\.canvas\.height=height\*Math\.min\(devicePixelRatio\|\|1,1\.5\);return;\}\n    this\.renderer\.setSize\(width,height,false\);this\.camera\.aspect=width/height;this\.camera\.fov=height>width\?70:65;this\.camera\.updateProjectionMatrix\(\);\n  \}")
size_new="""  size(){
    const width=this.host.clientWidth||innerWidth,height=this.host.clientHeight||innerHeight;
    if(width===this.width&&height===this.height)return;
    this.width=width;this.height=height;
    if(this.fallback){const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=width*ratio;this.canvas.height=height*ratio;if(this.raf!==undefined)this.wake(900);return;}
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.fov=height>width?70:65;this.camera.updateProjectionMatrix();if(this.raf!==undefined)this.wake(900);
  }"""
scene,n=size_re.subn(size_new,scene,count=1)
if n!=1: raise SystemExit('size method not found')

tick_re=re.compile(r"  tick\(now\)\{\n.*?\n  \}\n\}",re.S)
tick_new="""  schedule(delay=0){
    if(document.hidden||this.raf||this.frameTimer)return;
    if(delay>0){this.frameTimer=setTimeout(()=>{this.frameTimer=0;if(!document.hidden)this.raf=requestAnimationFrame(this.tick);},delay);return;}
    this.raf=requestAnimationFrame(this.tick);
  }
  wake(ms=1200){
    this.activeUntil=Math.max(this.activeUntil||0,performance.now()+ms);
    if(this.frameTimer){clearTimeout(this.frameTimer);this.frameTimer=0;}
    this.schedule();
  }
  tick(now){
    this.raf=0;if(document.hidden)return;
    const cameraMoving=!!this.camera&&(this.camera.position.distanceToSquared(this.target)>.00002||Math.abs(this.targetAngle-this.angle)>.0005);
    const visuallyActive=this.mode==='title'||cameraMoving||(this.shake||0)>.002||(this.enemyHit||0)>.002||now<(this.activeUntil||0);
    // Full interaction and combat stay at the existing ~30 fps. Only ambient idle drops to 15 fps; resolution, geometry, lighting and FX remain identical.
    const frameMs=visuallyActive?32:66;
    const elapsed=now-this.lastFrame;
    if(elapsed<frameMs){this.schedule(Math.max(0,frameMs-elapsed-9));return;}
    const dt=Math.min(.06,(now-this.lastTime)/1000);this.lastTime=now;this.lastFrame=now;this.time+=dt;
    const smooth=1-Math.exp(-dt*11);this.angle+=(this.targetAngle-this.angle)*smooth;
    if(this.fallback){this.drawFallback();this.renderFrames++;this.schedule(visuallyActive?0:48);return;}
    this.camera.position.lerp(this.target,smooth);this.camera.rotation.y=this.angle;
    this.camera.rotation.z=(this.shake||0)*Math.sin(now*.08);this.shake=(this.shake||0)*.73;
    if(this.mode==='title'){this.camera.position.x=Math.sin(this.time*.13)*.12;this.camera.rotation.y=Math.sin(this.time*.11)*.035;}
    this.lamp.position.copy(this.camera.position);this.lamp.position.x+=.5;this.lamp.position.y=2.1;this.lamp.intensity=20+Math.sin(this.time*7)*1.5+Math.sin(this.time*12)*.7;
    this.fill.position.copy(this.camera.position);this.fill.position.x-=Math.sin(this.angle)*5;this.fill.position.z-=Math.cos(this.angle)*5;this.fill.position.y=1.6;
    for(const item of this.eventMeshes)if(item.kind==='enemy'&&item.obj.visible){const hit=item.active?(this.enemyHit||0):0;item.obj.position.x=(item.baseX??item.obj.position.x)+Math.sin(now*.19)*hit;item.obj.position.z=item.baseZ??item.obj.position.z;item.obj.position.y=1.3+Math.sin(this.time*1.8+item.cell.x)*.025+Math.abs(Math.sin(now*.14))*hit*.16;const baseScale=item.active?2.65:2.30,sx=baseScale*(1+hit*.12),sy=baseScale*(1-hit*.08);item.obj.scale.set(sx,sy,1);}this.enemyHit=(this.enemyHit||0)*.72;
    this.renderer.render(this.scene,this.camera);this.renderFrames++;
    if(typeof window!=='undefined')window.__CARD_DUNGEON_POWER__={renderFrames:this.renderFrames,idle:!visuallyActive,frameMs,mode:this.mode};
    this.schedule(visuallyActive?0:48);
  }
}"""
scene,n=tick_re.subn(tick_new,scene,count=1)
if n!=1: raise SystemExit('tick method not found')

scene_path.write_text(scene)

sw=Path('dist/sw.js')
text=sw.read_text()
match=re.search(r"const CACHE = 'card-dungeon-v(\d+)\.(\d+)\.(\d+)';",text)
if not match: raise SystemExit('sw cache version not found')
major,minor,patch=map(int,match.groups())
text=text[:match.start()]+f"const CACHE = 'card-dungeon-v{major}.{minor}.{patch+1}';"+text[match.end():]
sw.write_text(text)

print('Applied quality-preserving power optimizations')
