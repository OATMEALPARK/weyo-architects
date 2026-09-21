const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadCMS,mediaUrl}=require('../lib/cms');
const {ORIGIN,esc,json,metadata,head}=require('../lib/seo');
const legacy=require('../lib/legacy-urls.json');
const template=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
// Reuse the exact existing page renderers; CSS and CMS editing code stay unchanged.
function extractRenderSource(html){
  const start=html.indexOf('const href='),end=html.indexOf('const renderCurrent=');
  if(start<0||end<=start)throw new Error('SSR renderer markers missing or out of order: const href= / const renderCurrent=');
  if(!html.includes('<!-- SEO:START -->')||!html.includes('<!-- SEO:END -->')||!html.includes('<div id="app"></div>'))throw new Error('SSR template markers missing: SEO or app');
  return html.slice(start,end);
}
const renderSource=extractRenderSource(template);
const fallbackMatch=template.match(/const FALLBACK_P=(\[[\s\S]*?\]);/);
const fallbackData={P:fallbackMatch?JSON.parse(fallbackMatch[1]).map(p=>({...p,imgs:(p.imgs||[]).map(mediaUrl)})):[],HERO:[],SELECTED:[]};
const renderer=new vm.Script(renderSource+";header+(slug?detail(slug):page==='projects'?projects():page==='studio'?studio():page==='contact'?contact():page==='404'?notFound():home())+footer;");
function sitemap(data){
  const paths=['/','/projects','/studio','/contact',...data.P.map(p=>'/projects/'+encodeURIComponent(p.slug))];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+esc(ORIGIN+p)+'</loc></url>').join('')+'</urlset>';
}
function render(route,data){
  const slug=route.startsWith('/projects/')?decodeURIComponent(route.slice(10)):null;
  const project=slug?data.P.find(p=>p.slug===slug):null;
  const valid=slug?!!project:['/','/projects','/studio','/contact'].includes(route);
  const image=project?.imgs[0]||data.HERO[0]?.heroDesktop||data.P[0]?.imgs[0]||'https://rmtfmegufylujrzuvczi.supabase.co/storage/v1/object/public/project-media/migrated/haengdang/001-17e516_9cb5ac6c996e473ba8ca84a4d0dd5b42-mv2.jpg';
  const meta=metadata(route,project,image);
  const body=valid?renderer.runInNewContext({...data,slug,page:route.slice(1)||'home',mediaUrl},{timeout:1000}):'<main class="page-main"><section class="page-title"><h1>404</h1><p>페이지를 찾을 수 없습니다. <a href="/projects">프로젝트 보기</a></p></section></main>';
  let html=template.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/,head(meta,process.env.VERCEL_ENV!=='production'||!valid||data.unavailable)).replace('<div id="app"></div>',()=>'<div id="app">'+body+'</div>');
  if(route==='/'&&valid){
    const hero=data.HERO[0]||data.P[0];
    const desktop=hero&&(hero.heroDesktop||hero.imgs[0]);
    const mobile=hero&&(hero.heroMobile||desktop);
    if(desktop)html=html.replace('</head>',()=>'<link rel="preload" as="image" fetchpriority="high" media="(min-width: 821px)" href="'+esc(desktop)+'"><link rel="preload" as="image" fetchpriority="high" media="(max-width: 820px)" href="'+esc(mobile)+'"></head>');
  }
  if(valid)html=html.replace('<script src=',()=>'<script id="cms-snapshot" type="application/json">'+json(data)+'</script><script src=');
  else html=html.replace(/<script src=[\s\S]*<\/script>/,'');
  return {html,status:data.unavailable?503:valid?200:404};
}
async function handler(req,res){
  if(process.env.VERCEL_ENV!=='production')res.setHeader('X-Robots-Tag','noindex,nofollow');
  const url=new URL(req.url,'https://placeholder.invalid');
  const rawPath=url.pathname;
  let decoded;
  try{decoded=decodeURIComponent(rawPath)}catch{res.statusCode=400;return res.end('Bad URL');}
  const clean=decoded.length>1?decoded.replace(/\/+$/,''):decoded;
  let target=legacy[clean];
  if(clean==='/'||clean==='/index.html'){
    if(url.searchParams.get('project'))target='/projects/'+encodeURIComponent(url.searchParams.get('project'));
    else if(['home','projects','studio','contact'].includes(url.searchParams.get('page')))target=url.searchParams.get('page')==='home'?'/':'/'+url.searchParams.get('page');
    else if(clean==='/index.html')target='/';
  }
  if(target){res.statusCode=301;res.setHeader('Location',target);return res.end();}
  const route=clean.startsWith('/projects/')?'/projects/'+encodeURIComponent(clean.slice(10)):clean;
  if(rawPath!==route){res.statusCode=301;res.setHeader('Location',route+url.search);return res.end();}
  try{
    let data;
    try{data=await loadCMS();res.setHeader('Cache-Control','public, max-age=0, s-maxage=60')}
    catch(cmsError){
      console.warn('CMS read failed; serving fallback:',cmsError.message);
      data={...fallbackData,unavailable:true};
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Retry-After','60');
      res.setHeader('X-WEYO-CMS','fallback');
      res.setHeader('X-Robots-Tag','noindex,nofollow');
      // Do not publish an outdated project list as a current sitemap during an outage.
      if(route==='/sitemap.xml'){res.statusCode=503;return res.end('Temporarily unavailable. Please try again.');}
    }
    if(route==='/sitemap.xml'){res.setHeader('Content-Type','application/xml; charset=utf-8');return res.end(sitemap(data));}
    const result=render(route,data);res.statusCode=result.status;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if(result.status===404)res.setHeader('X-Robots-Tag','noindex,nofollow');
    res.end(result.html);
  }catch(error){
    console.error('SEO page render failed:',error.message);
    res.statusCode=503;res.setHeader('Retry-After','60');res.setHeader('Cache-Control','no-store');
    res.end('Temporarily unavailable. Please try again.');
  }
}
module.exports=handler;
module.exports.render=render;
module.exports.extractRenderSource=extractRenderSource;
module.exports.sitemap=sitemap;
