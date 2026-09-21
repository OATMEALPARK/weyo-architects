const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {render,extractRenderSource}=require('../api/site');
const template=fs.readFileSync('index.html','utf8');
const project={slug:'smoke-project',title:'Smoke Project',imgs:['https://example.com/hero.jpg'],location:'Seoul',display:'Residential',year:2026};
const data={P:[project],HERO:[],SELECTED:[]};
test('renderer markers fail explicitly when absent or reversed',()=>{
 assert.ok(extractRenderSource(template).includes('function home()'));
 for(const marker of ['const href=','const renderCurrent=','<!-- SEO:START -->','<!-- SEO:END -->','<div id="app"></div>'])assert.throws(()=>extractRenderSource(template.replace(marker,'')),/SSR .*markers/);
 assert.throws(()=>extractRenderSource('const renderCurrent=;const href='),/out of order/);
});
test('home, detail, invalid slug, environment robots and responsive preload',()=>{
 const previous=process.env.VERCEL_ENV;
 try{
  for(const env of ['production','preview','development',undefined]){
   if(env)process.env.VERCEL_ENV=env;else delete process.env.VERCEL_ENV;
   for(const route of ['/','/projects/smoke-project']){
    const result=render(route,data);assert.equal(result.status,200);assert.match(result.html,/Smoke Project/);
    assert.ok(result.html.includes('content="'+(env==='production'?'index,follow,max-image-preview:large':'noindex,nofollow')+'"'));
   }
   const missing=render('/projects/missing',data);assert.equal(missing.status,404);assert.match(missing.html,/noindex,nofollow/);
  }
  const home=render('/',data).html;assert.equal((home.match(/rel="preload"/g)||[]).length,2);assert.match(home,/fetchpriority="high"/);
 }finally{if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});
