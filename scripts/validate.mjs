import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const root=path.resolve('dist');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)]);}
const files=walk(root);
for(const file of files){
  if(file.endsWith('.js')){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  if(!/\.(html|js|css|webmanifest)$/.test(file)||file.includes('/lib/'))continue;
  const text=fs.readFileSync(file,'utf8');
  const refs=file.endsWith('.html')?[...text.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m=>m[1]):file.endsWith('.css')?[...text.matchAll(/url\(['"]?(\.\/[^)'"#]+)['"]?\)/g)].map(m=>m[1]):file.endsWith('.webmanifest')?JSON.parse(text).icons.map(x=>x.src):[...text.matchAll(/(?:from\s+|import\()['"](\.{1,2}\/[^'"]+)['"]/g)].map(m=>m[1]);
  for(const ref of refs){const target=path.resolve(path.dirname(file),ref);assert(target.startsWith(root+path.sep));assert(fs.existsSync(target),`${file}: missing ${ref}`);}
}
assert(fs.existsSync(path.join(root,'index.html')));
assert.equal(JSON.parse(fs.readFileSync('.openai/hosting.json')).static.directory,'dist');
const bytes=files.reduce((total,f)=>total+fs.statSync(f).size,0);
assert(bytes<3_000_000,`Startup assets unexpectedly large: ${bytes}`);
console.log(`Validated ${files.length} static files, local imports and syntax. Total ${(bytes/1024).toFixed(0)} KiB.`);
