(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WEYOAdminAuth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const messages={
    expired:'로그인 링크가 만료되었거나 이미 사용되었습니다. 새 링크를 요청해 주세요.',
    auth:'인증 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
    permission:'관리자 권한을 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
    denied:'이 이메일은 CMS 관리자로 등록되어 있지 않습니다.',
    data:'관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  };
  function create({client,view,load,redirectTo,schedule=setTimeout,cancel=clearTimeout,now=Date.now}){
    let generation=0,initialized=false,initialization,authorizedUserId=null;
    let subscription,timer,cooldownTimer,sending=false,cooldownUntil=0,loggingOut=false;
    function login(message='',retry=false){authorizedUserId=null;view.login(message,retry);updateSend()}
    function updateSend(){view.sendEnabled(!sending&&now()>=cooldownUntil)}
    function cooldown(){
      cooldownUntil=now()+60000;
      cancel(cooldownTimer);
      cooldownTimer=schedule(updateSend,60000);
    }
    async function check(){
      const current=++generation;
      authorizedUserId=null;
      view.loading();
      let stage='auth';
      try{
        if(!initialized){
          initialization ||= Promise.resolve().then(()=>client.auth.initialize());
          const result=await initialization;
          if(current!==generation)return;
          initialized=true;
          if(result.error){
            const callbackError=result.error.name==='AuthImplicitGrantRedirectError'||result.error.name==='AuthPKCEGrantCodeExchangeError';
            login(callbackError?messages.expired:messages.auth,!callbackError);return;
          }
        }
        const {data,error}=await client.auth.getUser();
        if(current!==generation)return;
        if(error){
          if(error.name==='AuthSessionMissingError'){login();return}
          login(error.status===401||error.status===403?messages.expired:messages.auth,
            error.status!==401&&error.status!==403);
          return;
        }
        const user=data?.user;
        if(!user){login();return}
        stage='permission';
        const result=await client.from('cms_admin_emails').select('email')
          .eq('email',(user.email||'').toLowerCase()).maybeSingle();
        if(current!==generation)return;
        // A failed lookup is not evidence that this user has lost access.
        // Keep the session, but keep the editor inaccessible until a successful check.
        if(result.error){login(messages.permission,true);return}
        if(!result.data){login(messages.denied);return}
        stage='data';
        await load();
        if(current!==generation)return;
        authorizedUserId=user.id;
        view.ready(user);
      }catch{
        if(current===generation)login(messages[stage],true);
      }
    }
    async function sendLink(email){
      if(sending||now()<cooldownUntil)return;
      email=email.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        view.message('올바른 이메일 주소를 입력해 주세요.');return;
      }
      sending=true;updateSend();view.message('로그인 링크를 요청하고 있습니다…');
      try{
        const {error}=await client.auth.signInWithOtp({email,
          options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});
        if(error){
          if(error.status===429){cooldown();view.message('요청이 많습니다. 1분 후 다시 요청해 주세요.')}
          else view.message('로그인 링크를 보내지 못했습니다. 이메일과 연결 상태를 확인해 주세요.');
          return;
        }
        cooldown();
        view.message('메일함에서 새 로그인 링크를 눌러 주세요. 재발송은 1분 후 가능합니다.');
      }catch{view.message('메일 요청 중 연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')}
      finally{sending=false;updateSend()}
    }
    async function logout(){
      if(loggingOut)return;
      loggingOut=true;cancel(timer);
      authorizedUserId=null;++generation;
      view.loading();
      try{
        const {error}=await client.auth.signOut({scope:'local'});
        login(error?'로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.':'');
        if(error)view.logoutRetry();
      }catch{login('로그아웃 중 연결 오류가 발생했습니다. 다시 시도해 주세요.');view.logoutRetry()}
      finally{loggingOut=false}
    }
    function start(){
      subscription=client.auth.onAuthStateChange((event,session)=>{
        // Never await another Auth API inside the SDK's auth notification lock.
        if(event==='SIGNED_OUT'){
          ++generation;cancel(timer);login('로그아웃되었습니다.');
        }else if(!loggingOut&&(event==='USER_UPDATED'||(event==='SIGNED_IN'&&session?.user?.id!==authorizedUserId))){
          ++generation;view.loading();cancel(timer);
          timer=schedule(()=>{void check()},0);
        }
      }).data.subscription;
      return check();
    }
    function stop(){++generation;cancel(timer);cancel(cooldownTimer);subscription?.unsubscribe()}
    return {start,check,sendLink,logout,stop};
  }
  return {create};
});
