from pathlib import Path

p=Path('dist/js/scene.js')
s=p.read_text(encoding='utf-8')

old="this.geos={box:new THREE.BoxGeometry(1,1,1),plane:new THREE.PlaneGeometry(1,1),cylinder:new THREE.CylinderGeometry(.6,.65,.2,12), flame:new THREE.IcosahedronGeometry(.14,0)};"
new="this.geos={box:new THREE.BoxGeometry(1,1,1),plane:new THREE.PlaneGeometry(1,1),ring:new THREE.RingGeometry(.58,.82,32),cylinder:new THREE.CylinderGeometry(.6,.65,.2,12), flame:new THREE.IcosahedronGeometry(.14,0)};"
assert old in s
s=s.replace(old,new,1)

old="this.teal=new THREE.MeshBasicMaterial({color:0x4abab8});this.gold=new THREE.MeshBasicMaterial({color:0xffcc80});"
new="this.teal=new THREE.MeshBasicMaterial({color:0x4abab8});this.gold=new THREE.MeshBasicMaterial({color:0xffcc80});this.enemyGroundMat=new THREE.MeshBasicMaterial({color:0xff6c54,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});this.enemyGroundLineMat=new THREE.MeshBasicMaterial({color:0xffb087,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide});"
assert old in s
s=s.replace(old,new,1)

old="const obj=new THREE.Sprite(material);obj.position.set(x,1.3,z);obj.scale.set(2.65,2.65,1);this.group.add(obj);this.eventMeshes.push({obj,cell:c,kind:'enemy',spriteMaterial:material});"
new="const obj=new THREE.Sprite(material);obj.position.set(x,1.3,z);obj.scale.set(2.65,2.65,1);this.group.add(obj);\n        // Ground-locked depth cue: unlike the billboard sprite, this lies on the enemy's exact dungeon tile, so perspective makes one-vs-two-cell distance immediately readable.\n        const marker=new THREE.Group();marker.position.set(x,.012,z);\n        const ring=new THREE.Mesh(this.geos.ring,this.enemyGroundMat);ring.rotation.x=-Math.PI/2;marker.add(ring);\n        for(const a of [0,Math.PI/2]){const line=new THREE.Mesh(this.geos.plane,this.enemyGroundLineMat);line.rotation.x=-Math.PI/2;line.rotation.z=a;line.scale.set(1.6,.065,1);line.position.y=.002;marker.add(line);}\n        this.group.add(marker);this.eventMeshes.push({obj,marker,cell:c,kind:'enemy',spriteMaterial:material});"
assert old in s
s=s.replace(old,new,1)

old="item.obj.visible=!item.cell.cleared||item.kind==='stairs';\n      if(item.kind==='enemy'){"
new="item.obj.visible=!item.cell.cleared||item.kind==='stairs';if(item.marker)item.marker.visible=item.obj.visible;\n      if(item.kind==='enemy'){"
assert old in s
s=s.replace(old,new,1)

old="item.active=active&&inBattle;item.baseX=item.cell.x*TILE+(active?dx*.9:0);item.baseZ=item.cell.z*TILE+(active?dz*.9:0);item.obj.position.set(item.baseX,1.3,item.baseZ);\n        if(active&&inBattle)item.obj.visible=true;"
new="item.active=active&&inBattle;item.baseX=item.cell.x*TILE+(active?dx*.9:0);item.baseZ=item.cell.z*TILE+(active?dz*.9:0);item.obj.position.set(item.baseX,1.3,item.baseZ);if(item.marker){item.marker.position.set(item.baseX,.012,item.baseZ);item.marker.visible=item.obj.visible;for(const child of item.marker.children)if(child.material)child.material.opacity=inBattle?.20:(active?.38:.34);}\n        if(active&&inBattle){item.obj.visible=true;if(item.marker)item.marker.visible=true;}"
assert old in s
s=s.replace(old,new,1)

# Keep marker transforms live while freezing static dungeon geometry.
old="this.group.traverse(obj=>{if(obj===this.group||obj.isSprite)return;if(obj.matrixAutoUpdate){obj.updateMatrix();obj.matrixAutoUpdate=false;}});"
new="this.group.traverse(obj=>{if(obj===this.group||obj.isSprite||this.eventMeshes.some(e=>e.marker===obj||e.marker?.children.includes(obj)))return;if(obj.matrixAutoUpdate){obj.updateMatrix();obj.matrixAutoUpdate=false;}});"
assert old in s
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')

sw=Path('dist/sw.js')
t=sw.read_text(encoding='utf-8')
import re
m=re.search(r"const CACHE = 'card-dungeon-v(\d+)\.(\d+)\.(\d+)'",t)
assert m
major,minor,patch=map(int,m.groups())
t=t.replace(m.group(0),f"const CACHE = 'card-dungeon-v{major}.{minor}.{patch+1}'",1)
sw.write_text(t,encoding='utf-8')
