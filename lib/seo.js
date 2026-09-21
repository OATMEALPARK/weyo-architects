const ORIGIN = 'https://www.we-yo.com';
const NAME = 'WE.YO architects | 건축사사무소 위요';
const DESCRIPTION = '건축사사무소 위요 WE.YO architects. 일상을 위요하는 공간을 고민하며 주거, 상업시설, 리모델링 등 다양한 건축 프로젝트를 진행합니다.';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
function metadata(path, p, image) {
  const pages = {
    '/': [NAME, DESCRIPTION],
    '/projects': ['Projects | '+NAME, '건축사사무소 위요의 건축 프로젝트. 단독주택, 상가주택, 상업시설, 리모델링 및 설계공모 작업을 소개합니다.'],
    '/studio': ['Studio | '+NAME, '건축사사무소 위요의 건축 철학과 건축가 이경섭, 서인지를 소개합니다. 일상을 위요하는 공간을 고민합니다.'],
    '/contact': ['Contact | '+NAME, '건축사사무소 위요 건축 설계 및 프로젝트 문의. 이메일 weyoarch@gmail.com · 전화 070-8080-2229.']
  };
  const title = p ? p.title+' | '+NAME : pages[path]?.[0] || '페이지를 찾을 수 없습니다 | '+NAME;
  const description = p ? String(p.description || [p.title, p.location, p.year, p.program, '건축사사무소 위요의 건축 프로젝트.'].filter(Boolean).join(' · ')).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,160) : pages[path]?.[1] || DESCRIPTION;
  return {title,description,url:ORIGIN+path,image};
}
function head(meta, noindex=false) {
  const graph = {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':ORIGIN+'/#organization',name:'건축사사무소 위요',alternateName:'WE.YO architects',url:ORIGIN+'/',email:'weyoarch@gmail.com',telephone:'+82-70-8080-2229',sameAs:['https://www.instagram.com/we.yo.architects/','https://www.facebook.com/profile.php?id=61562161161529']},
    {'@type':'WebSite','@id':ORIGIN+'/#website',url:ORIGIN+'/',name:NAME,inLanguage:'ko-KR',publisher:{'@id':ORIGIN+'/#organization'}}
  ]};
  const m=(name,value,property=false)=>`<meta ${property?'property':'name'}="${name}" content="${esc(value)}">`;
  return `<title>${esc(meta.title)}</title>\n`+m('description',meta.description)+`\n<link rel="canonical" href="${esc(meta.url)}">\n`+
    m('robots',noindex?'noindex,nofollow':'index,follow,max-image-preview:large')+
    m('google-site-verification','khMS2Yx84sdd7oV0sMyb7At7fBhhRz1jTWvqEI1JM_Q')+
    m('naver-site-verification','7d1d94c08bd5e9d4c30f44493bfdf5339bc54f5a')+
    Object.entries({'og:type':'website','og:site_name':'WE.YO architects','og:locale':'ko_KR','og:title':meta.title,'og:description':meta.description,'og:url':meta.url,...(meta.image?{'og:image':meta.image,'og:image:alt':meta.title}:{})}).map(([k,v])=>m(k,v,true)).join('\n')+
    Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,...(meta.image?{'twitter:image':meta.image,'twitter:image:alt':meta.title}:{})}).map(([k,v])=>m(k,v)).join('\n')+
    `<script type="application/ld+json">${json(graph)}</script>`;
}
module.exports={ORIGIN,NAME,DESCRIPTION,esc,json,metadata,head};
