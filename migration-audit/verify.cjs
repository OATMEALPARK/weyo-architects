// Read-only audit; never writes to the CMS or Storage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadCMS,mediaUrl}=require('../lib/cms');
const source=require('./source-manifest.json').filter(r=>r.status!=='deferred-by-user');
const asset=path=>path.split('/').pop().replace(/^\d+-/,'').replace('-mv2','~mv2');
(async()=>{
 const data=await loadCMS();
 for(const row of source){
  const project=data.P.find(p=>p.slug===row.slug);
  assert.ok(project,'Missing project '+row.slug);
  assert.deepEqual(project.images.map(asset),row.assets,'Asset/order mismatch '+row.slug);
  assert.equal(new Set(project.images.map(asset)).size,row.assets.length);
 }
 const images=source.flatMap(r=>r.images);
 const results=[];
 for(let start=0;start<images.length;start+=8){
  results.push(...await Promise.all(images.slice(start,start+8).map(async path=>{
   let r;
   for(let attempt=0;attempt<3;attempt++){try{r=await fetch(mediaUrl(path),{method:'HEAD',signal:AbortSignal.timeout(15000)});if(r.ok)break}catch{}}
   assert.ok(r?.ok,'Broken Storage image '+path);
   assert.ok(r.headers.get('content-type')?.startsWith('image/'),'Not image '+path);
   return {path,status:r.status};
  })));
 }
 console.log(JSON.stringify({projects:source.length,images:images.length,missing:0,duplicates:0,broken:0,order:'matches source'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
