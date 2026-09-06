from pathlib import Path

p=Path('dist/js/scene.js')
s=p.read_text()
repls=[
("this.canvas.height=height*ratio;this.wake(900);return;","this.canvas.height=height*ratio;if(this.raf!==undefined)this.wake(900);return;"),
("this.camera.updateProjectionMatrix();this.wake(900);","this.camera.updateProjectionMatrix();if(this.raf!==undefined)this.wake(900);")
]
for old,new in repls:
    if s.count(old)!=1: raise SystemExit(f'Expected one init-order marker, found {s.count(old)}: {old}')
    s=s.replace(old,new,1)
p.write_text(s)

# Keep the reusable patch aligned with the fixed runtime.
patch=Path('scripts/apply-power-optimizations.py')
ps=patch.read_text()
ps=ps.replace("this.canvas.height=height*ratio;this.wake(900);return;","this.canvas.height=height*ratio;if(this.raf!==undefined)this.wake(900);return;")
ps=ps.replace("this.camera.updateProjectionMatrix();this.wake(900);","this.camera.updateProjectionMatrix();if(this.raf!==undefined)this.wake(900);")
patch.write_text(ps)
print('Fixed early scheduler wake during initial resize')
