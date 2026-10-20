const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../assets/admin-auth');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function fixture(options={}){
  let event,clock=0;const timers=new Map();let timerId=0;
  const calls={logout:[],mail:[],load:0,lookup:0,user:0};
  const state={screen:'initial',message:'',retry:false,sendEnabled:false};
  const user={id:'test-user',email:'Admin@example.invalid'};
  const client={auth:{
    initialize:async()=>options.initialize?options.initialize():{error:null},
    getUser:async()=>{calls.user++;return options.getUser?options.getUser():{data:{user},error:null}},
    signOut:async args=>{calls.logout.push(args);return options.signOut?options.signOut():{error:null}},
    signInWithOtp:async args=>{calls.mail.push(args);return options.mail?options.mail():{error:null}},
    onAuthStateChange:callback=>{event=callback;return {data:{subscription:{unsubscribe(){event=null}}}}}
  },from(table){assert.equal(table,'cms_admin_emails');return {select(column){assert.equal(column,'email');return {eq(column,email){assert.equal(column,'email');assert.equal(email,'admin@example.invalid');return {maybeSingle:async()=>{calls.lookup++;return options.lookup?options.lookup():{data:{email},error:null}}}}}}}}};
  const controller=create({client,redirectTo:'https://cms.example.invalid/admin.html',
    load:async()=>{calls.load++;if(options.load)await options.load()},
    now:()=>clock,schedule:(fn,ms)=>{timers.set(++timerId,{fn,at:clock+ms});return timerId},cancel:id=>timers.delete(id),
    view:{loading(){state.screen='loading'},login(message,retry){Object.assign(state,{screen:'login',message,retry})},ready(user){state.screen='app';state.user=user},message:message=>state.message=message,sendEnabled:enabled=>state.sendEnabled=enabled,logoutRetry:()=>state.logoutRetry=true}});
  return {controller,calls,state,emit:(name,session)=>event(name,session),async tick(ms=0){clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn()}await new Promise(setImmediate)}};
}
test('valid admin is shown only after protected data finishes loading',async()=>{
 const data=deferred(),f=fixture({load:()=>data.promise});const pending=f.controller.start();
 await new Promise(setImmediate);assert.equal(f.state.screen,'loading');data.resolve();await pending;
 assert.equal(f.state.screen,'app');assert.equal(f.calls.logout.length,0);
});
for(const reason of ['network','403','server'])test('lookup '+reason+' keeps session and blocks app until retry succeeds',async()=>{
 let failed=true;const f=fixture({lookup:async()=>failed?{data:null,error:{code:reason}}:{data:{email:'admin@example.invalid'},error:null}});
 await f.controller.start();assert.equal(f.state.screen,'login');assert.equal(f.state.retry,true);assert.match(f.state.message,/권한을 확인하지/);
 assert.equal(f.calls.logout.length,0);assert.equal(f.calls.load,0);
 failed=false;await f.controller.check();assert.equal(f.state.screen,'app');
});
test('missing admin row denies access without global logout',async()=>{
 const f=fixture({lookup:async()=>({data:null,error:null})});await f.controller.start();
 assert.equal(f.state.screen,'login');assert.match(f.state.message,/등록되어 있지/);assert.equal(f.state.retry,false);assert.equal(f.calls.load,0);assert.equal(f.calls.logout.length,0);
});
test('expired callback explains new link instead of silently returning to login',async()=>{
 const f=fixture({initialize:async()=>({error:{name:'AuthImplicitGrantRedirectError'}})});await f.controller.start();
 assert.equal(f.state.screen,'login');assert.match(f.state.message,/만료.*새 링크/);assert.equal(f.calls.user,0);assert.equal(f.state.sendEnabled,true);
});
test('general initialization errors are retryable and are not labelled expired links',async()=>{
 const f=fixture({initialize:async()=>({error:{name:'AuthUnknownError'}})});await f.controller.start();
 assert.equal(f.state.retry,true);assert.match(f.state.message,/인증 상태/);
});
test('missing session shows login without querying admin table',async()=>{
 const f=fixture({getUser:async()=>({data:{user:null},error:{name:'AuthSessionMissingError'}})});await f.controller.start();
 assert.equal(f.state.screen,'login');assert.equal(f.state.message,'');assert.equal(f.calls.lookup,0);
});
test('thrown user request does not leave a blank or loading screen',async()=>{
 const f=fixture({getUser:async()=>{throw new Error('not to be displayed')}});await f.controller.start();
 assert.equal(f.state.screen,'login');assert.equal(f.state.retry,true);assert.doesNotMatch(f.state.message,/not to be displayed/);
});
test('CMS data failure stays behind login with retry',async()=>{
 const f=fixture({load:async()=>{throw new Error('private response')}});await f.controller.start();
 assert.equal(f.state.screen,'login');assert.match(f.state.message,/데이터/);assert.equal(f.state.retry,true);
});
test('signout invalidates in-flight authorization so stale results cannot reopen app',async()=>{
 const query=deferred(),f=fixture({lookup:()=>query.promise});const pending=f.controller.start();await new Promise(setImmediate);
 f.emit('SIGNED_OUT',null);query.resolve({data:{email:'admin@example.invalid'},error:null});await pending;
 assert.equal(f.state.screen,'login');assert.equal(f.calls.load,0);
});
test('signout during data loading also prevents stale app display',async()=>{
 const data=deferred(),f=fixture({load:()=>data.promise});const pending=f.controller.start();await new Promise(setImmediate);
 f.emit('SIGNED_OUT',null);data.resolve();await pending;assert.equal(f.state.screen,'login');
});
test('cross-tab sign-in rechecks outside synchronous auth callback',async()=>{
 let signedIn=false;const f=fixture({getUser:async()=>({data:{user:signedIn?{id:'test-user',email:'admin@example.invalid'}:null},error:null})});
 await f.controller.start();signedIn=true;f.emit('SIGNED_IN',{user:{id:'test-user'}});assert.equal(f.calls.user,1);
 await f.tick();assert.equal(f.state.screen,'app');assert.equal(f.calls.user,2);
});
test('same-user sign-in and token refresh do not interrupt an open editor',async()=>{
 const f=fixture();await f.controller.start();f.emit('SIGNED_IN',{user:{id:'test-user'}});f.emit('TOKEN_REFRESHED',{user:{id:'test-user'}});
 await f.tick();assert.equal(f.state.screen,'app');assert.equal(f.calls.load,1);
});
test('mail request deduplicates clicks, prevents signup and allows resend after cooldown',async()=>{
 const mail=deferred(),f=fixture({mail:()=>mail.promise});await f.controller.start();
 const pending=f.controller.sendLink(' admin@example.invalid ');await f.controller.sendLink('admin@example.invalid');assert.equal(f.calls.mail.length,1);
 assert.equal(f.state.sendEnabled,false);mail.resolve({error:null});await pending;
 assert.equal(f.calls.mail[0].options.shouldCreateUser,false);assert.equal(f.calls.mail[0].options.emailRedirectTo,'https://cms.example.invalid/admin.html');
 await f.controller.sendLink('admin@example.invalid');assert.equal(f.calls.mail.length,1);await f.tick(60000);assert.equal(f.state.sendEnabled,true);
});
test('mail exceptions and rate limits have safe actionable feedback',async()=>{
 const f=fixture({mail:async()=>{throw new Error('sensitive diagnostic')}});await f.controller.start();await f.controller.sendLink('admin@example.invalid');
 assert.equal(f.state.sendEnabled,true);assert.match(f.state.message,/연결 오류/);assert.doesNotMatch(f.state.message,/sensitive/);
 const limited=fixture({mail:async()=>({error:{status:429}})});await limited.controller.start();await limited.controller.sendLink('admin@example.invalid');
 assert.match(limited.state.message,/1분/);assert.equal(limited.state.sendEnabled,false);
});
test('logout is scoped locally and failed logout can be retried',async()=>{
 const f=fixture({signOut:async()=>({error:{status:500}})});await f.controller.start();await f.controller.logout();
 assert.deepEqual(f.calls.logout,[{scope:'local'}]);assert.equal(f.state.screen,'login');assert.equal(f.state.logoutRetry,true);
});

test('pending sign-in events cannot reopen the app while explicit logout is in progress',async()=>{
 const out=deferred(),f=fixture({signOut:()=>out.promise});await f.controller.start();
 f.emit('USER_UPDATED',{user:{id:'test-user'}});const pending=f.controller.logout();
 f.emit('SIGNED_IN',{user:{id:'test-user'}});await f.tick();assert.equal(f.state.screen,'loading');
 out.resolve({error:null});await pending;assert.equal(f.state.screen,'login');assert.equal(f.calls.load,1);
});
