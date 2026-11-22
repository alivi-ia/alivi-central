'use strict';
// ALIVI CENTRAL 1.0 — somente a chave PÚBLICA do Supabase no navegador.
// Segurança dos dados: o banco aplica RLS com base no JWT da conta autenticada.
const SB='https://xadzckilujbydycebizj.supabase.co';
const PUB='sb_publishable_Gm2JW3ns-WmQmFvg3JNXjA_n0VjCDpD';
const SESSION_KEY='alivi-central-session-v1';
const THEME_KEY='alivi-central-theme-v1';
const $=id=>document.getElementById(id);
let session=null,identity=null,permission=null,refreshing=null;
const titles={overview:['Visão geral','Sua operação, em um só lugar.','Base administrativa pronta para receber os módulos comerciais com segurança e controle.'],clients:['Clientes','Gestão de clientes.','Estrutura preparada para o cadastro e acompanhamento dos futuros usuários.'],subscriptions:['Assinaturas','Planos e assinaturas.','Acompanhamento comercial com cobranças seguras, numa próxima etapa.'],monitoring:['Monitoramento','Funcionamento da ALIVI.','Indicadores operacionais que serão conectados a rotas protegidas.'],settings:['Configurações','Seu painel, suas escolhas.','Personalize a aparência da ALIVI CENTRAL neste aparelho.']};
function status(message,error=false){$('login-status').textContent=message;$('login-status').classList.toggle('error',error)}
function setTheme(name){const theme=name==='cristal'?'cristal':'orbital';document.body.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);$('theme-label').textContent=theme==='cristal'?'Azul Orbital':'Azul Cristal';$('theme-toggle').firstChild.textContent=theme==='cristal'?'☾ ':'☀ ';$('pick-orbital').classList.toggle('selected',theme==='orbital');$('pick-cristal').classList.toggle('selected',theme==='cristal')}
function showAuth(message='Somente contas administrativas autorizadas.',error=false){$('panel-view').hidden=true;$('auth-view').hidden=false;status(message,error)}
function showPanel(){if(!identity||!permission?.active)throw Error('Sem autorização administrativa');$('auth-view').hidden=true;$('panel-view').hidden=false;const role=permission.role==='owner'?'Proprietário':permission.role==='admin'?'Administrador':'Suporte';$('access-role').textContent=role;$('account-role').textContent=role;$('account-email').textContent=identity.email||'Conta autorizada';$('settings-email').textContent=identity.email||'Conta autorizada';navigate('overview')}
function navigate(screen){const entry=titles[screen];if(!entry)return;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+screen));document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));$('breadcrumb-current').textContent=entry[0];$('page-heading').textContent=entry[1];$('page-description').textContent=entry[2];closeMenu()}
function closeMenu(){$('sidebar').classList.remove('open');$('drawer-overlay').hidden=true}
function storeSession(data){session=data;localStorage.setItem(SESSION_KEY,JSON.stringify(data))}
function clearSession(){session=null;identity=null;permission=null;refreshing=null;localStorage.removeItem(SESSION_KEY)}
async function request(path,opts={}){const r=await fetch(SB+path,{...opts,headers:{apikey:PUB,'Content-Type':'application/json',...(opts.token?{Authorization:'Bearer '+opts.token}:{}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const err=new Error(data.msg||data.error_description||data.message||data.error||('Erro HTTP '+r.status));err.status=r.status;throw err}return data}
async function accessToken(){if(!session?.access_token)throw Error('Entre novamente na CENTRAL');if(Number(session.expires_at||0)>Date.now()/1000+90)return session.access_token;if(!session.refresh_token)throw Error('Sessão expirada. Entre novamente.');if(!refreshing)refreshing=(async()=>{const d=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});storeSession(d);return d.access_token})().finally(()=>{refreshing=null});return refreshing}
async function validateAccess(){const token=await accessToken();const user=await request('/auth/v1/user',{method:'GET',token});if(!user.id||!user.email_confirmed_at)throw Error('Confirme seu e-mail antes de acessar a CENTRAL');const rows=await request('/rest/v1/alivi_central_admins?select=user_id,role,active&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{method:'GET',token});if(!Array.isArray(rows)||rows.length!==1||rows[0].active!==true)throw Error('Esta conta não tem autorização ativa para a ALIVI CENTRAL.');identity=user;permission=rows[0];return true}
async function doLogin(ev){ev.preventDefault();const email=$('email').value.trim(),password=$('password').value;const button=$('login-button');button.disabled=true;status('Verificando sua conta...');try{const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});storeSession(data);await validateAccess();$('password').value='';showPanel()}catch(err){clearSession();status(err.message||'Falha de autenticação.',true)}finally{button.disabled=false}}
async function restore(){setTheme(localStorage.getItem(THEME_KEY));try{const saved=localStorage.getItem(SESSION_KEY);if(!saved)return;session=JSON.parse(saved);status('Restaurando acesso administrativo...');await validateAccess();showPanel()}catch(err){clearSession();showAuth(err.message||'Entre novamente para continuar.',true)}}
async function logout(){const old=session?.access_token;clearSession();showAuth('Você saiu da ALIVI CENTRAL.');$('password').value='';if(old)fetch(SB+'/auth/v1/logout',{method:'POST',headers:{apikey:PUB,Authorization:'Bearer '+old}}).catch(()=>{})}
$('login-form').addEventListener('submit',doLogin);
$('logout-button').addEventListener('click',logout);
$('theme-toggle').addEventListener('click',()=>setTheme(document.body.dataset.theme==='orbital'?'cristal':'orbital'));
$('pick-orbital').addEventListener('click',()=>setTheme('orbital'));
$('pick-cristal').addEventListener('click',()=>setTheme('cristal'));
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.screen)));
$('mobile-menu').addEventListener('click',()=>{$('sidebar').classList.add('open');$('drawer-overlay').hidden=false});
$('drawer-overlay').addEventListener('click',closeMenu);
$('recheck-button').addEventListener('click',async()=>{const b=$('recheck-button');b.disabled=true;$('check-status').textContent='Conferindo permissão no Supabase...';try{await validateAccess();showPanel();$('check-status').textContent='Acesso confirmado com sucesso.'}catch(err){clearSession();showAuth('Seu acesso precisa ser confirmado novamente: '+err.message,true)}finally{b.disabled=false}});
window.addEventListener('pageshow',e=>{if(e.persisted&&session)validateAccess().catch(()=>{clearSession();showAuth('Sua sessão precisa ser renovada.',true)})});
restore();
