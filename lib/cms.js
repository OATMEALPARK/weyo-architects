const URL = 'https://rmtfmegufylujrzuvczi.supabase.co';
// Same public, RLS-restricted key as the existing CMS client. No privileged key.
const KEY = 'sb_publishable_Zh_DVcw1aX3mUkCTQg8WLw_WNiPyuhz';
const mediaUrl=v=>!v?'':/^https?:\/\//i.test(v)?v:URL+'/storage/v1/object/public/project-media/'+v.replace(/^\/+/, '');
async function read(query){
  const r=await fetch(URL+'/rest/v1/'+query,{headers:{apikey:KEY},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('Public CMS read failed: '+r.status);
  return r.json();
}
async function loadCMS(){
  const [projects,hero,selected]=await Promise.all([
    read('projects?select=*&is_published=eq.true&order=list_order.asc'),
    read('homepage_hero?select=slot,desktop_image,mobile_image,projects(*)&is_enabled=eq.true&order=slot.asc'),
    read('homepage_selected?select=slot,projects(*)&order=slot.asc')
  ]);
  const normalize=p=>({...p,imgs:(p.images||[]).map(mediaUrl)});
  return {P:projects.filter(p=>p.is_published).map(normalize),
    HERO:hero.filter(x=>x.projects?.is_published).map(x=>({...normalize(x.projects),heroDesktop:mediaUrl(x.desktop_image)||mediaUrl(x.projects.images?.[0]),heroMobile:mediaUrl(x.mobile_image)||mediaUrl(x.desktop_image)||mediaUrl(x.projects.images?.[0])})),
    SELECTED:selected.filter(x=>x.projects?.is_published).map(x=>normalize(x.projects))};
}
module.exports={loadCMS,mediaUrl};
