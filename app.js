'use strict';
// ALIVI CENTRAL 1.1 — somente a chave PÚBLICA do Supabase no navegador.
// Segurança dos dados: o banco aplica RLS com base no JWT da conta autenticada.
const SB='https://xadzckilujbydycebizj.supabase.co';
const PUB='sb_publishable_Gm2JW3ns-WmQmFvg3JNXjA_n0VjCDpD';
const SESSION_KEY='alivi-central-session-v1';
const THEME_KEY='alivi-central-theme-v1';
const $=id=>document.getElementById(id);
let session=null,identity=null,permission=null,refreshing=null,clientRows=null,clientsLoading=null,sessionEpoch=0;
const titles={overview:['Visão geral','Sua operação, em um só lugar.','Base administrativa pronta para receber os módulos comerciais com segurança e controle.'],clients:['Clientes','Gestão de clientes.','Consulta protegida de contas cadastradas no Supabase, sem acesso a conversas particulares.'],subscriptions:['Assinaturas','Planos e assinaturas.','Acompanhamento comercial com cobranças seguras, numa próxima etapa.'],monitoring:['Monitoramento','Funcionamento da ALIVI.','Indicadores operacionais que serão conectados a rotas protegidas.'],settings:['Configurações','Seu painel, suas escolhas.','Personalize a aparência da ALIVI CENTRAL neste aparelho.']};
function status(message,error=false){$('login-status').textContent=message;$('login-status').classList.toggle('error',error)}
function setTheme(name){const theme=name==='cristal'?'cristal':'orbital';document.body.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);$('theme-label').textContent=theme==='cristal'?'Azul Orbital':'Azul Cristal';$('theme-toggle').firstChild.textContent=theme==='cristal'?'☾ ':'☀ ';$('pick-orbital').classList.toggle('selected',theme==='orbital');$('pick-cristal').classList.toggle('selected',theme==='cristal')}
function showAuth(message='Somente contas administrativas autorizadas.',error=false){$('panel-view').hidden=true;$('auth-view').hidden=false;status(message,error)}
function showPanel(){if(!identity||!permission?.active)throw Error('Sem autorização administrativa');$('auth-view').hidden=true;$('panel-view').hidden=false;const role=permission.role==='owner'?'Proprietário':permission.role==='admin'?'Administrador':'Suporte';$('access-role').textContent=role;$('account-role').textContent=role;$('account-email').textContent=identity.email||'Conta autorizada';$('settings-email').textContent=identity.email||'Conta autorizada';navigate('overview')}
function navigate(screen){const entry=titles[screen];if(!entry)return;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+screen));document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));$('breadcrumb-current').textContent=entry[0];$('page-heading').textContent=entry[1];$('page-description').textContent=entry[2];closeMenu();if(screen==='clients'&&clientRows===null)loadClients()}
function closeMenu(){$('sidebar').classList.remove('open');$('drawer-overlay').hidden=true}
function storeSession(data){session=data;localStorage.setItem(SESSION_KEY,JSON.stringify(data))}
function clearSession(){session=null;identity=null;permission=null;refreshing=null;clientRows=null;clientsLoading=null;sessionEpoch++;localStorage.removeItem(SESSION_KEY);$('clients-count').textContent='—';$('clients-verified').textContent='—';$('clients-table-body').replaceChildren();$('clients-status').textContent='Entre novamente para consultar os cadastros.'}
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

// Consultas estritamente administrativas. O RPC confirma o usuário owner/admin no servidor.
function clientDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)}
function clientCell(tr,value){const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);return td}
function renderClients(){
 const body=$('clients-table-body');body.replaceChildren();
 const all=Array.isArray(clientRows)?clientRows:[];
 const term=$('clients-search').value.toLocaleLowerCase('pt-BR').trim();
 const visible=all.filter(u=>String(u.client_email||'').toLocaleLowerCase('pt-BR').includes(term));
 $('clients-count').textContent=String(all.length);
 $('clients-verified').textContent=String(all.filter(u=>u.email_verified===true).length);
 if(!visible.length){const tr=document.createElement('tr');const td=clientCell(tr,term?'Nenhum e-mail corresponde à busca.':'Nenhuma conta encontrada.');td.colSpan=4;td.className='clients-empty';body.appendChild(tr);return}
 for(const row of visible){
  const tr=document.createElement('tr');
  clientCell(tr,row.client_email||'(sem e-mail)').className='clients-email';
  clientCell(tr,clientDate(row.registered_at));
  clientCell(tr,clientDate(row.last_access_at));
  const badge=clientCell(tr,row.email_verified===true?'Confirmado':'Pendente');badge.className=row.email_verified===true?'client-ok':'client-pending';
  body.appendChild(tr);
 }
}
async function loadClients(){
 if(clientsLoading)return clientsLoading;
 const button=$('clients-refresh');const epoch=sessionEpoch;
 button.disabled=true;$('clients-status').textContent='Consultando os cadastros no Supabase...';
 clientsLoading=(async()=>{
  try{
   if(!identity||!permission?.active)throw Error('Acesso administrativo não confirmado.');
   const token=await accessToken();
   const rows=await request('/rest/v1/rpc/alivi_central_list_clients',{method:'POST',token,body:'{}'});
   if(epoch!==sessionEpoch||!identity)return;
   if(!Array.isArray(rows))throw Error('Resposta inesperada do serviço de cadastros.');
   clientRows=rows;
   renderClients();
   $('clients-status').textContent=rows.length===100?'Consulta concluída. Exibindo os 100 registros mais recentes; podem existir outros.':'Consulta concluída. '+rows.length+' conta(s) encontrada(s).';
  }catch(err){
   if(epoch!==sessionEpoch)return;
   $('clients-status').textContent='Não foi possível carregar: '+(err.message||'erro desconhecido')+'.';
   clientRows=null;$('clients-count').textContent='—';$('clients-verified').textContent='—';
   const tr=document.createElement('tr');const td=clientCell(tr,'Erro na consulta. Verifique o login e tente Atualizar lista.');td.colSpan=4;td.className='clients-empty';$('clients-table-body').replaceChildren(tr);
  }finally{if(epoch===sessionEpoch)button.disabled=false}
 })();
 try{await clientsLoading}finally{clientsLoading=null}
}
$('clients-refresh').addEventListener('click',loadClients);
$('clients-search').addEventListener('input',()=>{if(Array.isArray(clientRows))renderClients()});

window.addEventListener('pageshow',e=>{if(e.persisted&&session)validateAccess().catch(()=>{clearSession();showAuth('Sua sessão precisa ser renovada.',true)})});
restore();
