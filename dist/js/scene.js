import * as THREE from '../lib/three.module.min.js';
import { DIRS, posKey } from './engine.js';

const TILE=4;
export class DungeonView {
  constructor(host,onFallback=()=>{}) {
    this.host=host;this.onFallback=onFallback;this.time=0;this.map=null;this.mode='title';this.target=new THREE.Vector3(0,1.55,0);this.angle=0;this.targetAngle=0;this.eventMeshes=[];this.materials=[];this.enemyHit=0;
    try {
      this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
      this.renderer.setClearColor(0x070e14);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
      host.appendChild(this.renderer.domElement);
      this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.startFallback();this.onFallback();},{once:true});
      this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x070f18,.057);
      this.camera=new THREE.PerspectiveCamera(67,1,.06,65);this.camera.rotation.order='YXZ';
      this.scene.add(new THREE.HemisphereLight(0x8babc0,0x222432,2.1));
      this.lamp=new THREE.PointLight(0xf6ae67,22,19,1.5);this.scene.add(this.lamp);
      this.fill=new THREE.PointLight(0x49d9df,10,16,1.7);this.scene.add(this.fill);
      this.group=new THREE.Group();this.scene.add(this.group);
      this.texture=new THREE.TextureLoader().load('./assets/enemies.webp',texture=>{for(const item of this.eventMeshes)if(item.spriteMaterial){item.spriteMaterial.map.source=texture.source;item.spriteMaterial.map.needsUpdate=true;}});this.texture.colorSpace=THREE.SRGBColorSpace;
      this.geos={box:new THREE.BoxGeometry(1,1,1),plane:new THREE.PlaneGeometry(1,1),cylinder:new THREE.CylinderGeometry(.6,.65,.2,12), flame:new THREE.IcosahedronGeometry(.14,0)};
      this.stone=this.material(0x59606b, this.stoneTexture());
      this.floorMat=this.material(0x3e4a55,this.stoneTexture(true));this.pillarMat=this.material(0x343e4b);this.trimMat=this.material(0x73716a);
      this.bronze=this.material(0x796244);this.wood=this.material(0x503a2a);this.black=this.material(0x111a22);
      this.teal=new THREE.MeshBasicMaterial({color:0x4abab8});this.gold=new THREE.MeshBasicMaterial({color:0xffcc80});
      this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();
    } catch(e) {this.startFallback();this.onFallback();}
    this.lastFrame=0;this.lastTime=performance.now();this.activeUntil=performance.now()+1600;this.raf=0;this.frameTimer=0;this.renderFrames=0;
    this.tick=this.tick.bind(this);
    this.visibilityHandler=()=>{if(document.hidden){if(this.raf)cancelAnimationFrame(this.raf);if(this.frameTimer)clearTimeout(this.frameTimer);this.raf=0;this.frameTimer=0;}else{this.lastTime=performance.now();this.wake(1200);}};
    document.addEventListener('visibilitychange',this.visibilityHandler,{passive:true});
    this.schedule();
  }
  material(color,map=null){const m=new THREE.MeshStandardMaterial({color,map,roughness:.96,metalness:.04});this.materials.push(m);return m;}
  stoneTexture(floor=false){
    const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');
    x.fillStyle='#333943';x.fillRect(0,0,256,256);
    let seed=7123;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let row=0;row<4;row++)for(let col=-1;col<4;col++){
      const px=col*(floor?128:96)+(row%2)*48,py=row*64,v=85+Math.floor(rnd()*30);
      x.fillStyle=`rgb(${v},${v+3},${v+8})`;x.fillRect(px+2,py+2,(floor?128:96)-4,60);
      x.fillStyle='rgba(255,255,255,.08)';x.fillRect(px+3,py+3,(floor?128:96)-6,2);
      x.fillStyle='rgba(0,0,0,.12)';x.fillRect(px+3,py+58,(floor?128:96)-6,3);
    }
    for(let i=0;i<3500;i++){const v=rnd()>.5?255:0;x.fillStyle=`rgba(${v},${v},${v},.06)`;x.fillRect(rnd()*256,rnd()*256,1+rnd()*3,1+rnd()*3);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=2;return t;
  }
  box(parent,mat,x,y,z,sx,sy,sz){const m=new THREE.Mesh(this.geos.box,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  batch(mat,items){
    if(!items.length)return;
    const mesh=new THREE.InstancedMesh(this.geos.box,mat,items.length),m=new THREE.Matrix4(),q=new THREE.Quaternion();
    items.forEach((a,i)=>{m.compose(new THREE.Vector3(...a.slice(0,3)),q,new THREE.Vector3(...a.slice(3)));mesh.setMatrixAt(i,m);});this.group.add(mesh);
  }
  build(map) {
    this.map=map;
    if(this.fallback)return;
    for(const m of this.eventMeshes){if(m.spriteMaterial){m.spriteMaterial.map?.dispose();m.spriteMaterial.dispose();}}
    this.group.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();});this.group.clear();this.eventMeshes=[];
    const occupied=new Set(map.cells.map(c=>posKey(c.x,c.z))),walls=[],floors=[],ceilings=[],pillars=[],trims=[];
    const corners=new Set();
    for(const c of map.cells){
      const x=c.x*TILE,z=c.z*TILE;
      floors.push([x,-.18,z,TILE,.35,TILE]);ceilings.push([x,3.5,z,TILE,.25,TILE]);
      for(let d=0;d<4;d++){
        const [dx,dz]=DIRS[d];
        if(!occupied.has(posKey(c.x+dx,c.z+dz))){
          walls.push([x+dx*2,1.7,z+dz*2,d%2?.35:4,3.5,d%2?4:.35]);
          trims.push([x+dx*1.79,.25,z+dz*1.79,d%2?.15:4,.22,d%2?4:.15]);
          trims.push([x+dx*1.79,2.85,z+dz*1.79,d%2?.15:4,.16,d%2?4:.15]);
          if((c.x+c.z+d)%3===0){
            this.box(this.group,this.bronze,x+dx*1.73,1.9,z+dz*1.73,.15,.55,.15);
            const f=new THREE.Mesh(this.geos.flame,((c.x+c.z)%3===0)?this.teal:this.gold);f.position.set(x+dx*1.65,2.27,z+dz*1.65);f.scale.set(.8,1.7,.8);this.group.add(f);
          }
        }
      }
      for(const cx of [-1.84,1.84])for(const cz of [-1.84,1.84]){
        const key=posKey(x+cx,z+cz);if(corners.has(key))continue;corners.add(key);
        pillars.push([x+cx,1.72,z+cz,.27,3.45,.27]);
      }
      if(['enemy','boss'].includes(c.event)){
        const sprite=c.enemyIndex||0,texture=this.texture.clone();texture.needsUpdate=true;texture.repeat.set(.5,.5);texture.offset.set((sprite%2)*.5,sprite<2?.5:0);
        const material=new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.06,depthWrite:false});
        const obj=new THREE.Sprite(material);obj.position.set(x,1.3,z);obj.scale.set(2.65,2.65,1);this.group.add(obj);this.eventMeshes.push({obj,cell:c,kind:'enemy',spriteMaterial:material});
      } else if(c.event==='chest'){
        const obj=new THREE.Group();obj.position.set(x,0,z);this.group.add(obj);
        this.box(obj,this.wood,0,.32,0,.85,.58,.6);this.box(obj,this.bronze,0,.6,0,.9,.12,.66);
        for(const a of [-.27,.27])this.box(obj,this.bronze,a,.35,-.32,.09,.52,.04);
        this.box(obj,this.gold,0,.42,-.34,.1,.12,.035);this.eventMeshes.push({obj,cell:c,kind:'chest'});
      } else if(c.event==='spring'){
        const obj=new THREE.Group();obj.position.set(x,0,z);this.group.add(obj);
        const basin=new THREE.Mesh(this.geos.cylinder,this.trimMat);basin.position.y=.1;obj.add(basin);
        const water=new THREE.Mesh(this.geos.cylinder,this.teal);water.position.y=.2;water.scale.set(.8,.25,.8);obj.add(water);this.eventMeshes.push({obj,cell:c,kind:'spring'});
      } else if(c.event==='stairs'){
        const obj=new THREE.Group();obj.position.set(x,0,z);this.group.add(obj);
        this.box(obj,this.black,0,.015,0,2.7,.05,2.9);
        for(let i=0;i<6;i++)this.box(obj,this.pillarMat,0,.04+i*.012,1.1-i*.4,2.6,.03,.18);
        for(const side of [-1,1]){this.box(obj,this.trimMat,side*1.42,1.18,0,.32,2.36,.5);this.box(obj,this.teal,side*1.42,1.5,-.28,.1,.9,.03);}
        this.box(obj,this.trimMat,0,2.35,0,3.15,.35,.6);this.eventMeshes.push({obj,cell:c,kind:'stairs'});
      }
    }
    this.batch(this.stone,walls);this.batch(this.floorMat,floors);this.batch(this.pillarMat,ceilings);this.batch(this.pillarMat,pillars);this.batch(this.trimMat,trims);
    // The dungeon geometry never moves after build. Freezing its transforms avoids thousands of matrix checks every rendered frame without changing pixels.
    this.group.traverse(obj=>{if(obj===this.group||obj.isSprite)return;if(obj.matrixAutoUpdate){obj.updateMatrix();obj.matrixAutoUpdate=false;}});
    this.wake(1600);
  }
  title(){
    this.mode='title';
    const cells=[];for(let z=0;z>=-5;z--)cells.push({x:0,z,event:z===-4?'stairs':'empty',seen:true});
    for(let x of [-1,1])for(let z of [-2,-3])cells.push({x,z,event:'empty',seen:true});
    this.build({cells,position:{x:0,z:0},facing:0});this.target.set(0,1.55,1);this.targetAngle=0;this.angle=0;this.camera?.position.copy(this.target);
  }
  sync(game,instant=false){
    this.mode=game.mode;this.wake(1400);
    if(this.map!==game.dungeon || this.builtFloor!==game.floor){this.build(game.dungeon);this.builtFloor=game.floor;instant=true;}
    const p=game.dungeon.position, dir=game.dungeon.facing,[dx,dz]=DIRS[dir];
    const inBattle=['battle','encounter','reward'].includes(game.mode);
    const offset=inBattle?-1.65:0;
    this.target.set(p.x*TILE+dx*offset,1.48,p.z*TILE+dz*offset);
    let aim=-dir*Math.PI/2;while(aim-this.angle>Math.PI)aim-=Math.PI*2;while(aim-this.angle< -Math.PI)aim+=Math.PI*2;this.targetAngle=aim;
    if(instant&&this.camera){this.camera.position.copy(this.target);this.angle=aim;}
    for(const item of this.eventMeshes){
      item.obj.visible=!item.cell.cleared||item.kind==='stairs';
      if(item.kind==='enemy'){
        const active=item.cell.x===p.x&&item.cell.z===p.z;
        item.active=active&&inBattle;item.baseX=item.cell.x*TILE+(active?dx*.9:0);item.baseZ=item.cell.z*TILE+(active?dz*.9:0);item.obj.position.set(item.baseX,1.3,item.baseZ);
        if(active&&inBattle)item.obj.visible=true;
      }
    }
    this.battleView=inBattle;this.size();
  }
  impact(who,damage){this.wake(1000);if(who==='enemy'&&damage>0){this.enemyHit=Math.min(.34,.10+damage*.006);this.hitTime=performance.now();return;}this.shake=who==='player'&&damage>0?.12:.025;this.hitTime=performance.now();}
  size(){
    const width=this.host.clientWidth||innerWidth,height=this.host.clientHeight||innerHeight;
    if(width===this.width&&height===this.height)return;
    this.width=width;this.height=height;
    if(this.fallback){const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=width*ratio;this.canvas.height=height*ratio;this.wake(900);return;}
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.fov=height>width?70:65;this.camera.updateProjectionMatrix();this.wake(900);
  }
  startFallback(){
    this.fallback=true;this.renderer?.domElement.remove();
    this.canvas=document.createElement('canvas');this.host.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.size();
    if(!this.resize){this.resize=new ResizeObserver(()=>this.size());this.resize.observe(this.host);}
  }
  drawFallback(){
    const x=this.ctx,w=this.canvas.width,h=this.canvas.height;if(!x)return;
    x.fillStyle='#0b131e';x.fillRect(0,0,w,h/2);x.fillStyle='#202931';x.fillRect(0,h/2,w,h/2);
    if(!this.map)return;
    const occupied=new Set(this.map.cells.map(c=>posKey(c.x,c.z))),px=this.target.x/TILE,pz=this.target.z/TILE;
    for(let i=0;i<w;i+=4){
      const a=-this.angle+(i/w-.5)*1.15;let d=.03;
      for(;d<12;d+=.035){if(!occupied.has(posKey(Math.floor(px+Math.sin(a)*d+.5),Math.floor(pz-Math.cos(a)*d+.5))))break;}
      const hh=Math.min(h,h/(d*Math.cos((i/w-.5)*1.15)*1.5)),shade=Math.max(19,85-d*12);
      x.fillStyle=`rgb(${shade*.85},${shade},${shade*1.12})`;x.fillRect(i,(h-hh)/2,4,hh);
      x.fillStyle='rgba(0,0,0,.17)';for(let r=1;r<5;r++)x.fillRect(i,(h-hh)/2+hh*r/5,4,Math.max(1,hh/110));
    }
  }
  schedule(delay=0){
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
}
