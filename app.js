'use strict';
// ALIVI CONTROL 1.9 — somente a chave PÚBLICA do Supabase no navegador.
// Segurança dos dados: o banco aplica RLS com base no JWT da conta autenticada.
const CONTROL_VERSION='1.10.0';
const SB='https://xadzckilujbydycebizj.supabase.co';
const PUB='sb_publishable_Gm2JW3ns-WmQmFvg3JNXjA_n0VjCDpD';
const SESSION_KEY='alivi-central-session-v1';
const THEME_KEY='alivi-central-theme-v1';
const $=id=>document.getElementById(id);
let session=null,identity=null,permission=null,refreshing=null,clientRows=null,clientsLoading=null,sessionEpoch=0,staffRows=null,staffLoading=null,staffPermissions=null;
const cache={companies:null,plans:null,subscriptions:null,usage:null};
const inFlight={};
const titles={overview:['Visão geral','Sua operação, em um só lugar.','Acompanhe clientes, empresas, planos e consumo sem acessar dados privados.'],clients:['Clientes','Gestão de clientes.','Consulta protegida de contas cadastradas no Supabase, sem acesso a conversas particulares.'],companies:['Empresas','Empresas e acessos.','Cadastre empresas e confira os vínculos autorizados nesta conta.'],subscriptions:['Planos e assinaturas','Planos e assinaturas.','Acompanhamento comercial sem cobranças reais nesta versão.'],monitoring:['Consumo e custos','Indicadores de consumo.','Eventos registrados pela operação, não faturas do provedor de IA.'],feedback:['ALIVI Feedback','Sugestões e problemas dos testadores.','Mensagens enviadas voluntariamente pela MOBILE, sem acesso a chats privados.'],staff:['Equipe e acessos','Acesso dos seus colaboradores.','Defina permissões administrativas restritas, sem acesso a conversas particulares.'],settings:['Configurações','Seu painel, suas escolhas.','Personalize a aparência da ALIVI CONTROL neste aparelho.']};
function status(message,error=false){$('login-status').textContent=message;$('login-status').classList.toggle('error',error)}
function setTheme(name){const theme=name==='cristal'?'cristal':'orbital';document.body.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);$('theme-label').textContent=theme==='cristal'?'Azul Orbital':'Azul Cristal';$('theme-toggle').firstChild.textContent=theme==='cristal'?'☾ ':'☀ ';$('pick-orbital').classList.toggle('selected',theme==='orbital');$('pick-cristal').classList.toggle('selected',theme==='cristal')}
function showAuth(message='Somente contas administrativas autorizadas.',error=false){$('panel-view').hidden=true;$('auth-view').hidden=false;status(message,error)}
// A ocultacao dos botoes melhora a experiencia, mas a protecao real e aplicada pelo Supabase.
const permissionKeys={clients:'can_view_clients',companies:'can_view_companies',plans:'can_view_plans',subscriptions:'can_view_subscriptions',usage:'can_view_usage'};
function isManager(){return !!permission?.active&&['owner','admin'].includes(permission.role)}
function isSupport(){return !!permission?.active&&permission.role==='support'}
function canModule(name){return isManager()||(isSupport()&&staffPermissions?.[permissionKeys[name]]===true)}
function canScreen(screen){
 if(!permission?.active)return false;
 if(screen==='overview'||screen==='settings')return true;
 if(screen==='staff'||screen==='feedback')return permission.role==='owner';
 if(screen==='subscriptions')return canModule('plans')||canModule('subscriptions');
 if(screen==='monitoring')return canModule('usage');
 if(screen==='clients'||screen==='companies')return canModule(screen);
 return false;
}
function applyAccessView(){
 document.querySelectorAll('[data-screen]').forEach(button=>{button.hidden=!canScreen(button.dataset.screen)});
 $('company-create-card').hidden=!isManager();
 $('plans-panel').hidden=!canModule('plans');
 $('subscriptions-panel').hidden=!canModule('subscriptions');
 $('plan-manage-card').hidden=permission?.role!=='owner';
 $('trial-manage-card').hidden=permission?.role!=='owner';
 $('limited-access-box').hidden=!isSupport();
 $('limited-overview-note').hidden=!isSupport();
 if(isSupport()){
  const allowed=Object.entries(permissionKeys).filter(([key])=>canModule(key));
  const names={clients:'Clientes',companies:'Empresas',plans:'Planos',subscriptions:'Assinaturas',usage:'Consumo e custos'};
  $('limited-access-summary').textContent=allowed.length?'Módulos autorizados: '+allowed.map(([key])=>names[key]).join(', ')+'.':'Nenhum módulo autorizado. Peça ao proprietário que configure seu acesso.';
 }
}
function showPanel(){
 if(!identity||!permission?.active)throw Error('Sem autorização administrativa');
 $('auth-view').hidden=true;$('panel-view').hidden=false;
 const role=permission.role==='owner'?'Proprietário':permission.role==='admin'?'Administrador':'Colaborador';
 $('access-role').textContent=role;$('account-role').textContent=role;
 $('account-email').textContent=identity.email||'Conta autorizada';
 $('settings-email').textContent=identity.email||'Conta autorizada';
 applyAccessView();navigate('overview');
}
function navigate(screen){
 const entry=titles[screen];if(!entry||!canScreen(screen))return;
 document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+screen));
 document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));
 $('breadcrumb-current').textContent=entry[0];$('page-heading').textContent=entry[1];$('page-description').textContent=entry[2];closeMenu();
 if(screen==='clients'&&clientRows===null)loadClients();
 if(screen==='companies')loadCompanies();
 if(screen==='subscriptions')loadCommercial();
 if(screen==='monitoring')loadUsage();
 if(screen==='overview')loadOverview();
 if(screen==='staff')loadStaff();if(screen==='feedback')loadControlFeedback();
}
function closeMenu(){$('sidebar').classList.remove('open');$('drawer-overlay').hidden=true}
function storeSession(data){session=data;localStorage.setItem(SESSION_KEY,JSON.stringify(data))}
function clearSession(){session=null;identity=null;permission=null;staffPermissions=null;refreshing=null;clientRows=null;clientsLoading=null;staffRows=null;staffLoading=null;sessionEpoch++;$('staff-nav').hidden=true;$('staff-form').reset();$('staff-save-status').textContent='Entre como proprietário para gerenciar a equipe.';escTable('staff-table-body',5,'Entre novamente para consultar a equipe.');$('staff-status').textContent='Entre novamente para consultar.';Object.keys(cache).forEach(k=>{cache[k]=null;delete inFlight[k]});localStorage.removeItem(SESSION_KEY);$('feedback-control-list').replaceChildren();$('feedback-control-count').textContent='—';$('feedback-control-open').textContent='—';$('clients-count').textContent='—';$('clients-verified').textContent='—';$('clients-table-body').replaceChildren();$('clients-status').textContent='Entre novamente para consultar os cadastros.';for(const [id,cols] of [['companies-table-body',4],['plans-table-body',5],['subs-table-body',5],['usage-table-body',5]])escTable(id,cols,'Entre novamente para consultar.');for(const id of ['companies-count','companies-active','overview-companies','overview-plans','overview-subs','overview-usage','overview-cost','usage-count','usage-input','usage-output','usage-cost'])$(id).textContent='—';for(const id of ['companies-status','plans-status','subs-status','usage-status','overview-status','company-create-status'])$(id).textContent='Entre novamente para consultar ou alterar registros.';$('plan-form').reset();$('trial-form').reset();$('plan-existing').replaceChildren(new Option('+ Criar novo plano',''));$('trial-company').replaceChildren(new Option('Escolha uma empresa cadastrada',''));$('trial-plan').replaceChildren(new Option('Escolha um plano ativo',''));$('plan-save-status').textContent='Entre novamente para editar planos.';$('trial-save-status').textContent='Entre novamente para cadastrar testes.'}
async function request(path,opts={}){const r=await fetch(SB+path,{...opts,headers:{apikey:PUB,'Content-Type':'application/json',...(opts.token?{Authorization:'Bearer '+opts.token}:{}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const err=new Error(data.msg||data.error_description||data.message||data.error||('Erro HTTP '+r.status));err.status=r.status;throw err}return data}
async function accessToken(){if(!session?.access_token)throw Error('Entre novamente na CONTROL');if(Number(session.expires_at||0)>Date.now()/1000+90)return session.access_token;if(!session.refresh_token)throw Error('Sessão expirada. Entre novamente.');if(!refreshing)refreshing=(async()=>{const d=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});storeSession(d);return d.access_token})().finally(()=>{refreshing=null});return refreshing}
async function validateAccess(){const token=await accessToken();const user=await request('/auth/v1/user',{method:'GET',token});if(!user.id||!user.email_confirmed_at)throw Error('Confirme seu e-mail antes de acessar a CENTRAL');const rows=await request('/rest/v1/alivi_central_admins?select=user_id,role,active&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{method:'GET',token});if(!Array.isArray(rows)||rows.length!==1||rows[0].active!==true||!['owner','admin','support'].includes(rows[0].role))throw Error('Esta conta não tem autorização ativa para a ALIVI CONTROL.');
 let staff=null;
 if(rows[0].role==='support'){
  const flags=await request('/rest/v1/alivi_control_staff_permissions?select=user_id,can_view_clients,can_view_companies,can_view_plans,can_view_subscriptions,can_view_usage&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{method:'GET',token});
  if(!Array.isArray(flags)||flags.length!==1)throw Error('O proprietário ainda não configurou suas permissões.');
  staff=flags[0];
 }
 identity=user;permission=rows[0];staffPermissions=staff;return true}
async function doLogin(ev){ev.preventDefault();const email=$('email').value.trim(),password=$('password').value;const button=$('login-button');button.disabled=true;status('Verificando sua conta...');try{const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});storeSession(data);await validateAccess();$('password').value='';showPanel()}catch(err){clearSession();status(err.message||'Falha de autenticação.',true)}finally{button.disabled=false}}
async function restore(){setTheme(localStorage.getItem(THEME_KEY));try{const saved=localStorage.getItem(SESSION_KEY);if(!saved)return;session=JSON.parse(saved);status('Restaurando acesso administrativo...');await validateAccess();showPanel()}catch(err){clearSession();showAuth(err.message||'Entre novamente para continuar.',true)}}
async function logout(){const old=session?.access_token;clearSession();showAuth('Você saiu da ALIVI CONTROL.');$('password').value='';if(old)fetch(SB+'/auth/v1/logout',{method:'POST',headers:{apikey:PUB,Authorization:'Bearer '+old}}).catch(()=>{})}
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
   if(!identity||!canModule('clients'))throw Error('Este perfil não tem acesso ao módulo Clientes.');
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

window.addEventListener('pageshow',e=>{if(e.persisted&&session)recheckPermissions()});
async function recheckPermissions(){
 if(!session)return;
 const wasSupport=permission?.role==='support';
 const before=wasSupport?JSON.stringify(staffPermissions):null;
 try{
  await validateAccess();
  if(wasSupport&&JSON.stringify(staffPermissions)!==before){
   clearVisibleCache();applyAccessView();navigate('overview');
  }
 }catch(err){clearSession();showAuth('Seu acesso precisa ser confirmado novamente: '+(err?.message||err),true)}
}
function clearVisibleCache(){
 clientRows=null;staffRows=null;
 Object.keys(cache).forEach(k=>{cache[k]=null;delete inFlight[k]});
 $('clients-table-body').replaceChildren();
 for(const [id,cols] of [['companies-table-body',4],['plans-table-body',5],['subs-table-body',5],['usage-table-body',5]])escTable(id,cols,'Consulte novamente para atualizar.');
}
window.addEventListener('focus',()=>{if(isSupport())recheckPermissions()});


// ALIVI CONTROL 1.6 — consultas protegidas por JWT e RLS no Supabase.
// As tabelas comerciais sao de LEITURA; cadastro de empresa somente por RPC autorizado.
const nfmt=new Intl.NumberFormat('pt-BR');
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function escTable(id,cols,text){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=cols;td.className='clients-empty';td.textContent=text;tr.appendChild(td);$(id).replaceChildren(tr)}
function addCells(tr,values){for(const value of values){const td=document.createElement('td');td.textContent=String(value ?? '—');tr.appendChild(td)}return tr}
function dateFmt(v){return clientDate(v)}
function moneyCents(cents){return brl.format(Number(cents||0)/100)}
function moneyBrl(number){return brl.format(Number(number||0))}
function textStatus(id,msg){$(id).textContent=msg}
function checkEpoch(epoch){return epoch===sessionEpoch && !!identity && !!permission?.active}
async function tableRows(key,force=false){
 if(!force&&Array.isArray(cache[key]))return cache[key];
 if(inFlight[key])return inFlight[key];
 const spec={companies:['alivi_control_companies','id,name,segment,active,created_at'],plans:['alivi_control_plans','id,code,name,monthly_price_cents,annual_price_cents,active'],subscriptions:['alivi_control_subscriptions','id,company_id,plan_id,billing_cycle,status,price_snapshot_cents,created_at'],usage:['alivi_control_usage_events','id,company_id,usage_type,units,input_tokens,output_tokens,estimated_cost_brl,occurred_at']}[key];
 if(!spec)throw Error('Consulta indisponível');
 if(!canModule(({companies:'companies',plans:'plans',subscriptions:'subscriptions',usage:'usage'})[key]))throw Error('Módulo não autorizado para este usuário.');
 const epoch=sessionEpoch;
 inFlight[key]=(async()=>{
  if(!checkEpoch(epoch))throw Error('Entre novamente para consultar os registros.');
  const token=await accessToken();
  const order=key==='usage'?'occurred_at':'created_at';
  const url='/rest/v1/'+spec[0]+'?select='+encodeURIComponent(spec[1])+'&order='+order+'.desc&limit=200';
  const rows=await request(url,{method:'GET',token});
  if(!Array.isArray(rows))throw Error('Resposta inesperada da tabela '+spec[0]);
  if(!checkEpoch(epoch))throw Error('Sessão alterada durante a consulta.');
  cache[key]=rows;
  return rows;
 })();
 try{return await inFlight[key]}finally{delete inFlight[key]}
}
function renderCompanyRows(){
 const rows=cache.companies||[];
 const term=$('companies-search').value.trim().toLocaleLowerCase('pt-BR');
 const shown=rows.filter(r=>(r.name+' '+r.segment).toLocaleLowerCase('pt-BR').includes(term));
 $('companies-count').textContent=nfmt.format(rows.length);
 $('companies-active').textContent=nfmt.format(rows.filter(r=>r.active).length);
 const body=$('companies-table-body');body.replaceChildren();
 if(!shown.length){escTable('companies-table-body',4,term?'Nenhum resultado para essa pesquisa.':'Nenhuma empresa vinculada a esta conta.');return}
 for(const r of shown)body.appendChild(addCells(document.createElement('tr'),[r.name,r.segment,r.active?'Ativa':'Inativa',dateFmt(r.created_at)]));
}
async function loadCompanies(force=false){
 const btn=$('companies-refresh');btn.disabled=true;textStatus('companies-status','Consultando empresas vinculadas...');
 try{const rows=await tableRows('companies',force);renderCompanyRows();if(permission?.role==='owner')fillCommercialEditors(cache.plans||[],rows);textStatus('companies-status',`${rows.length} empresa(s) vinculada(s) carregada(s), até 200 por consulta.`)}
 catch(e){textStatus('companies-status','Falha na consulta: '+e.message);$('companies-count').textContent='—';$('companies-active').textContent='—';escTable('companies-table-body',4,'Não foi possível carregar as empresas.')}
 finally{btn.disabled=false}
}
const subState={draft:'Rascunho',trial:'Teste',active:'Ativa',past_due:'Atrasada',paused:'Pausada',canceled:'Cancelada'};
async function loadCommercial(force=false){
 const btn=$('commercial-refresh');btn.disabled=true;
 const canPlans=canModule('plans'),canSubs=canModule('subscriptions');
 textStatus('plans-status',canPlans?'Consultando planos no Supabase...':'Sem permissão para consultar planos.');
 textStatus('subs-status',canSubs?'Consultando assinaturas...':'Sem permissão para consultar assinaturas.');
 try{
  const plans=canPlans?await tableRows('plans',force):[];
  const subs=canSubs?await tableRows('subscriptions',force):[];
  let companies=[];
  if(canModule('companies')){try{companies=await tableRows('companies',force)}catch(e){console.warn('Visibilidade de empresas:',e.message)}}
  const companyNames=new Map(companies.map(c=>[c.id,c.name]));
  const planNames=new Map(plans.map(p=>[p.id,p.name]));
  const tb=$('plans-table-body');tb.replaceChildren();
  if(!plans.length)escTable('plans-table-body',5,canPlans?'Nenhum plano cadastrado.':'Sem permissão.');
  else for(const p of plans)tb.appendChild(addCells(document.createElement('tr'),[p.name,p.code,moneyCents(p.monthly_price_cents),moneyCents(p.annual_price_cents),p.active?'Ativo':'Inativo']));
  if(canPlans)textStatus('plans-status',`${plans.length} plano(s) na consulta (até 200).`);
  const sb=$('subs-table-body');sb.replaceChildren();
  if(!subs.length)escTable('subs-table-body',5,canSubs?'Nenhuma assinatura cadastrada.':'Sem permissão.');
  else for(const s of subs)sb.appendChild(addCells(document.createElement('tr'),[companyNames.get(s.company_id)||'Empresa não visível',planNames.get(s.plan_id)||'Plano não autorizado ou não listado',s.billing_cycle==='annual'?'Anual':'Mensal',subState[s.status]||s.status,moneyCents(s.price_snapshot_cents)]));
  if(canSubs)textStatus('subs-status',`${subs.length} assinatura(s) na consulta (até 200).`);
  if(permission?.role==='owner')fillCommercialEditors(plans,companies);
 }catch(e){textStatus('plans-status','Erro: '+e.message);textStatus('subs-status','Erro: '+e.message);escTable('plans-table-body',5,'Consulta indisponível.');escTable('subs-table-body',5,'Consulta indisponível.')}
 finally{btn.disabled=false}
}
const usageTypes={chat:'Chat',voice:'Voz',notification:'Notificação',other:'Outro'};
async function loadUsage(force=false){
 const btn=$('usage-refresh');btn.disabled=true;textStatus('usage-status','Consultando eventos de consumo...');
 try{
  const events=await tableRows('usage',force);let companies=[];
  try{companies=await tableRows('companies')}catch(e){console.warn('Visibilidade de empresas:',e.message)}
  const names=new Map(companies.map(c=>[c.id,c.name]));
  $('usage-count').textContent=nfmt.format(events.length);
  $('usage-input').textContent=nfmt.format(events.reduce((sum,r)=>sum+Number(r.input_tokens||0),0));
  $('usage-output').textContent=nfmt.format(events.reduce((sum,r)=>sum+Number(r.output_tokens||0),0));
  $('usage-cost').textContent=moneyBrl(events.reduce((sum,r)=>sum+Number(r.estimated_cost_brl||0),0));
  const body=$('usage-table-body');body.replaceChildren();
  if(!events.length)escTable('usage-table-body',5,'Nenhum evento gravado — integração de medição ainda pendente.');
  else for(const r of events)body.appendChild(addCells(document.createElement('tr'),[dateFmt(r.occurred_at),usageTypes[r.usage_type]||r.usage_type,names.get(r.company_id)||'Empresa não visível',nfmt.format(Number(r.units)||0),moneyBrl(r.estimated_cost_brl)]));
  textStatus('usage-status',`${events.length} evento(s) na consulta. Não representa automaticamente o consumo real total.`);
 }catch(e){textStatus('usage-status','Falha: '+e.message);for(const id of ['usage-count','usage-input','usage-output','usage-cost'])$(id).textContent='—';escTable('usage-table-body',5,'Falha na consulta do Supabase.')}
 finally{btn.disabled=false}
}
async function loadOverview(force=false){
 const btn=$('overview-refresh');btn.disabled=true;textStatus('overview-status','Buscando indicadores protegidos...');
 const keys=['companies','plans','subscriptions','usage'];
 const res=await Promise.allSettled(keys.map(k=>canModule(k)?tableRows(k,force):Promise.resolve(null)));
 if(!identity){btn.disabled=false;return}
 const ids=['overview-companies','overview-plans','overview-subs','overview-usage'];
 res.forEach((r,i)=>$(ids[i]).textContent=r.status==='fulfilled'?(r.value===null?'Sem acesso':nfmt.format(r.value.length)):'—');
 $('overview-cost').textContent=res[3].status==='fulfilled'?(res[3].value===null?'Sem acesso':moneyBrl(res[3].value.reduce((sum,r)=>sum+Number(r.estimated_cost_brl||0),0))):'—';
 const err=res.find(r=>r.status==='rejected');
 textStatus('overview-status',err?'Consulta parcial. Confira permissões e tente atualizar.':'Resumo com dados dos módulos autorizados (até 200 registros por módulo).');
 btn.disabled=false;
}
$('companies-refresh').addEventListener('click',()=>loadCompanies(true));
$('companies-search').addEventListener('input',()=>{if(Array.isArray(cache.companies))renderCompanyRows()});
$('commercial-refresh').addEventListener('click',()=>loadCommercial(true));
$('usage-refresh').addEventListener('click',()=>loadUsage(true));
$('overview-refresh').addEventListener('click',()=>loadOverview(true));
$('company-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!isManager()){textStatus('company-create-status','Este perfil não pode cadastrar empresas.');return}
 const name=$('company-name').value.trim();const segment=$('company-segment').value;
 if(name.length<2){textStatus('company-create-status','Informe um nome válido.');return}
 if(!window.confirm(`Cadastrar de verdade a empresa "${name}" no Supabase?\nEste registro NÃO será apenas um teste visual.`))return;
 const epoch=sessionEpoch;const b=$('company-create');b.disabled=true;textStatus('company-create-status','Cadastrando empresa...');
 try{
  const token=await accessToken();
  const id=await request('/rest/v1/rpc/alivi_control_create_company',{method:'POST',token,body:JSON.stringify({p_name:name,p_segment:segment})});
  if(!checkEpoch(epoch))return;
  textStatus('company-create-status','Empresa cadastrada com sucesso. Identificador: '+id);
  $('company-form').reset();
  cache.companies=null;await loadCompanies(true);await loadOverview(true);
 }catch(err){if(checkEpoch(epoch))textStatus('company-create-status','Não foi possível cadastrar: '+err.message)}finally{b.disabled=false}
});

// ALIVI CONTROL 1.7 — equipe: a decisão de acesso é SEMPRE do RPC protegido no Supabase.
// Nunca expor service_role no navegador. As permissões ainda não habilitam login do perfil support.
const staffFlags=[['staff-clients','view_clients','Clientes'],['staff-companies','view_companies','Empresas'],['staff-plans','view_plans','Planos'],['staff-subs','view_subscriptions','Assinaturas'],['staff-usage','view_usage','Consumo e custos']];
function staffStatus(msg){$('staff-status').textContent=msg}
function clearStaffForm(){
 $('staff-form').reset();$('staff-email').readOnly=false;$('staff-save-status').textContent='Nenhuma alteração efetuada.';
}
function renderStaff(){
 const rows=Array.isArray(staffRows)?staffRows:[];
 const body=$('staff-table-body');body.replaceChildren();
 if(!rows.length){escTable('staff-table-body',5,'Nenhuma conta administrativa encontrada.');return}
 for(const r of rows){
  const tr=document.createElement('tr');
  addCells(tr,[r.staff_email||'—',r.staff_role==='owner'?'Proprietário':r.staff_role==='admin'?'Administrador':'Suporte',r.staff_active?'Ativa':'Inativa']);
  const mod=document.createElement('td');mod.textContent=staffFlags.filter(x=>r[x[1]]===true).map(x=>x[2]).join(', ')||'Nenhum';tr.appendChild(mod);
  const actions=document.createElement('td');
  if(r.staff_role==='support'){
   const b=document.createElement('button');b.type='button';b.className='secondary-button';b.textContent='Editar';
   b.addEventListener('click',()=>{
    $('staff-email').value=r.staff_email||'';
    $('staff-active').checked=!!r.staff_active;
    for(const [id,key] of staffFlags)$(id).checked=!!r[key];
    $('staff-save-status').textContent='Editando permissões deste colaborador. Salvar fará alteração real.';
    $('staff-email').focus();$('staff-form').scrollIntoView({behavior:'smooth',block:'center'});
   });actions.appendChild(b);
  }else{actions.textContent='Protegido'}
  tr.appendChild(actions);body.appendChild(tr);
 }
}
async function loadStaff(){
 if(permission?.role!=='owner'){staffStatus('Apenas o proprietário consulta a equipe.');return}
 if(staffLoading)return staffLoading;
 const epoch=sessionEpoch;const btn=$('staff-refresh');btn.disabled=true;staffStatus('Consultando equipe autorizada...');
 staffLoading=(async()=>{
  try{
   const token=await accessToken();
   const rows=await request('/rest/v1/rpc/alivi_control_list_staff',{method:'POST',token,body:'{}'});
   if(!checkEpoch(epoch)||permission?.role!=='owner')return;
   if(!Array.isArray(rows))throw Error('Resposta inesperada da consulta de equipe');
   staffRows=rows;renderStaff();
   staffStatus(`${rows.length} conta(s) administrativa(s) retornada(s), incluindo o proprietário.`);
  }catch(e){if(!checkEpoch(epoch))return;staffRows=null;escTable('staff-table-body',5,'Falha na consulta de equipe.');staffStatus('Erro: '+String(e.message||e))}
  finally{if(epoch===sessionEpoch)btn.disabled=false}
 })();
 try{await staffLoading}finally{staffLoading=null}
}
$('staff-refresh').addEventListener('click',loadStaff);
$('staff-clear').addEventListener('click',clearStaffForm);
$('staff-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(permission?.role!=='owner'){textStatus('staff-save-status','Somente o proprietário pode alterar a equipe.');return}
 const email=$('staff-email').value.trim();const active=$('staff-active').checked;
 const flags=staffFlags.map(x=>$(x[0]).checked);
 if(!email||!$('staff-email').checkValidity())return;
 const summary=staffFlags.filter((x,i)=>active&&flags[i]).map(x=>x[2]).join(', ')||'Nenhum módulo';
 const action=active?'AUTORIZAR':'DESATIVAR';
 if(!window.confirm(`${action} a conta ${email} na ALIVI CONTROL?\nMódulos de leitura selecionados: ${active?summary:'nenhum'}\n\nEsta operação modifica o Supabase. Um colaborador ativo pode entrar no painel e consultar somente os módulos autorizados.`))return;
 const epoch=sessionEpoch;const btn=$('staff-save');btn.disabled=true;
 textStatus('staff-save-status','Salvando a autorização no Supabase...');
 try{
  const token=await accessToken();
  await request('/rest/v1/rpc/alivi_control_set_staff',{method:'POST',token,body:JSON.stringify({
   p_email:email,p_active:active,p_clients:active&&flags[0],p_companies:active&&flags[1],p_plans:active&&flags[2],p_subscriptions:active&&flags[3],p_usage:active&&flags[4]
  })});
  if(!checkEpoch(epoch))return;
  clearStaffForm();textStatus('staff-save-status',active?'Autorização salva. Colaborador liberado apenas para os módulos autorizados.':'Acesso administrativo desativado.');
  await loadStaff();
 }catch(err){if(checkEpoch(epoch))textStatus('staff-save-status','Não foi possível alterar: '+String(err.message||err))}
 finally{btn.disabled=false}
});

// ALIVI CONTROL 1.9 — contratos de teste e preços, SOMENTE owner.
// O JWT e verificado novamente pelas funcoes SQL, jamais somente pelo navegador.
const priceText=cents=>(Number(cents||0)/100).toFixed(2).replace('.',',');
function parseMoneyCents(value){
 const raw=String(value).trim();
 if(!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(raw))throw Error('Informe o preço como 49,90 (sem R$ ou separador de milhar).');
 const bits=raw.replace('.',',').split(',');
 const result=Number(bits[0])*100+Number((bits[1]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(result)||result<0)return NaN;
 return result;
}
function fillCommercialEditors(plans,companies){
 const chosen=$('plan-existing').value;
 $('plan-existing').replaceChildren(new Option('+ Criar novo plano',''));
 for(const p of plans)$('plan-existing').add(new Option(p.name+' · '+p.code,p.id));
 if(plans.some(p=>p.id===chosen))$('plan-existing').value=chosen;
 const company=$('trial-company').value,plan=$('trial-plan').value;
 $('trial-company').replaceChildren(new Option('Escolha uma empresa cadastrada',''));
 for(const x of companies.filter(x=>x.active))$('trial-company').add(new Option(x.name,x.id));
 if(companies.some(x=>x.id===company&&x.active))$('trial-company').value=company;
 $('trial-plan').replaceChildren(new Option('Escolha um plano ativo',''));
 for(const p of plans.filter(p=>p.active))$('trial-plan').add(new Option(p.name,p.id));
 if(plans.some(p=>p.id===plan&&p.active))$('trial-plan').value=plan;
}
function resetPlanForm(){
 $('plan-form').reset();$('plan-existing').value='';$('plan-monthly').value='0,00';$('plan-annual').value='0,00';
}
$('plan-clear').addEventListener('click',resetPlanForm);
$('plan-existing').addEventListener('change',()=>{
 const row=(cache.plans||[]).find(x=>x.id===$('plan-existing').value);
 if(!row){resetPlanForm();return}
 $('plan-code').value=row.code;
 $('plan-name').value=row.name;
 $('plan-monthly').value=priceText(row.monthly_price_cents);
 $('plan-annual').value=priceText(row.annual_price_cents);
 $('plan-active').checked=!!row.active;
});
$('plan-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(permission?.role!=='owner')return;
 const selected=$('plan-existing').value;
 const code=$('plan-code').value.trim().toLowerCase();
 const name=$('plan-name').value.trim();
 const active=$('plan-active').checked;
 let monthly,annual;
 try{monthly=parseMoneyCents($('plan-monthly').value);annual=parseMoneyCents($('plan-annual').value)}
 catch(e){textStatus('plan-save-status',e.message);return}
 if(!Number.isInteger(monthly)||!Number.isInteger(annual))return;
 if(!window.confirm((selected?'ALTERAR':'CRIAR')+' plano '+name+'?\nPreço mensal: '+moneyCents(monthly)+'\nPreço anual: '+moneyCents(annual)+'\nStatus: '+(active?'Ativo':'Inativo')+'\n\nNenhum pagamento será cobrado.'))return;
 const btn=$('plan-save'),epoch=sessionEpoch;btn.disabled=true;
 textStatus('plan-save-status','Gravando plano no Supabase...');
 try{
  const token=await accessToken();
  await request('/rest/v1/rpc/alivi_control_save_plan',{method:'POST',token,body:JSON.stringify({
   p_code:code,p_name:name,p_monthly_price_cents:monthly,p_annual_price_cents:annual,
   p_active:active,p_plan_id:selected||null
  })});
  if(!checkEpoch(epoch))return;
  textStatus('plan-save-status','Plano salvo. Nenhuma cobrança foi realizada.');
  resetPlanForm();await loadCommercial(true);await loadOverview(true);
 }catch(err){if(checkEpoch(epoch))textStatus('plan-save-status','Não foi possível salvar: '+(err.message||err))}
 finally{btn.disabled=false}
});
$('trial-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(permission?.role!=='owner')return;
 const company=$('trial-company'),plan=$('trial-plan');
 const days=Number($('trial-days').value);
 if(!company.value||!plan.value||!Number.isInteger(days)||days<1||days>60){textStatus('trial-save-status','Escolha empresa, plano ativo e duração de 1 a 60 dias.');return}
 if(!window.confirm('CADASTRAR TESTE de '+days+' dia(s)?\nEmpresa: '+company.selectedOptions[0].text+'\nPlano: '+plan.selectedOptions[0].text+'\n\nEsta operação grava uma assinatura trial; não cobra e não libera automaticamente acesso na MOBILE.'))return;
 const btn=$('trial-save'),epoch=sessionEpoch;btn.disabled=true;
 textStatus('trial-save-status','Registrando período de teste...');
 try{
  const token=await accessToken();
  await request('/rest/v1/rpc/alivi_control_start_trial',{method:'POST',token,body:JSON.stringify({p_company_id:company.value,p_plan_id:plan.value,p_days:days})});
  if(!checkEpoch(epoch))return;
  textStatus('trial-save-status','Teste cadastrado no banco. Nenhuma cobrança nem liberação de uso foi feita.');
  $('trial-form').reset();await loadCommercial(true);await loadOverview(true);
 }catch(err){if(checkEpoch(epoch))textStatus('trial-save-status','Não foi possível cadastrar teste: '+(err.message||err))}
 finally{btn.disabled=false}
});

// ALIVI CONTROL 1.6 — atualização do painel (GitHub Pages).
// O arquivo version.json da publicação informa a versão disponível; nunca altera o código no GitHub.
let versionCheckPending=null;
function parts(version){return String(version).split('.').map(x=>Number(x));}
function isNewerVersion(remote,local){
 const a=parts(remote),b=parts(local);
 for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0)}
 return false;
}
function updateMessage(message){$('update-control-status').textContent=message;$('update-control-button').title=message;}
function setChecking(loading){$('update-control-button').disabled=loading;$('update-control-settings').disabled=loading;}
function refreshControl(){
 const url=new URL(window.location.href);
 url.searchParams.set('alivi_refresh',String(Date.now()));
 window.location.replace(url.toString());
}
async function checkControlUpdate(interactive=true){
 if(versionCheckPending)return versionCheckPending;
 setChecking(true);updateMessage('Conferindo a versão publicada no GitHub Pages...');
 versionCheckPending=(async()=>{
  try{
   const url=new URL('version.json',document.baseURI);
   url.searchParams.set('_',String(Date.now()));
   const response=await fetch(url.toString(),{cache:'no-store',headers:{'Accept':'application/json'}});
   if(!response.ok)throw new Error('Não foi possível consultar o arquivo version.json (HTTP '+response.status+').');
   const released=await response.json();
   const version=String(released.version||'');
   if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('O arquivo de versão publicado está inválido.');
   $('published-control-version').textContent=version;
   const newer=isNewerVersion(version,CONTROL_VERSION);
   $('update-control-button').classList.toggle('update-available',newer);
   if(newer){
    updateMessage('Nova versão '+version+' disponível. Clique em Atualizar para carregar.');
    if(interactive && window.confirm('A ALIVI CONTROL '+version+' já está publicada. Atualizar o painel agora?\n\nFormulários em edição não salvos serão descartados.'))refreshControl();
   }else if(version===CONTROL_VERSION){
    updateMessage('ALIVI CONTROL '+CONTROL_VERSION+' está atualizada.');
   }else{
    updateMessage('O GitHub Pages informa '+version+', anterior à versão instalada '+CONTROL_VERSION+'. Aguarde a publicação do repositório.');
   }
  }catch(error){
   $('published-control-version').textContent='Indisponível';
   updateMessage('Não foi possível verificar atualização: '+(error?.message||'Erro de conexão'));
  }
 })().finally(()=>{versionCheckPending=null;setChecking(false)});
 return versionCheckPending;
}
$('update-control-button').addEventListener('click',()=>checkControlUpdate(true));
$('update-control-settings').addEventListener('click',()=>checkControlUpdate(true));
$('reload-control-button').addEventListener('click',()=>{
 if(window.confirm('Recarregar a ALIVI CONTROL? Formulários não enviados serão descartados.'))refreshControl();
});
$('installed-control-version').textContent=CONTROL_VERSION;

restore().then(()=>{if(identity&&permission?.active)checkControlUpdate(false)});



// CONTROL 1.10: somente o OWNER pode consultar e atualizar feedbacks.
const feedbackKindNames={suggestion:'Sugestão',bug:'Problema',feature:'Nova função',other:'Outro'};
const feedbackStatusNames={received:'Recebido',reviewing:'Em análise',planned:'Planejado',resolved:'Resolvido',closed:'Encerrado'};
let ctrlFeedbackRows=[];let ctrlFeedbackEmails=new Map();
const feedbackDate=s=>{const d=new Date(s);return Number.isNaN(+d)?'—':d.toLocaleString('pt-BR')};
function feedbackControlText(tag,value,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=value;return el}
function renderControlFeedback(){
 const target=$('feedback-control-list');target.replaceChildren();
 const f=$('feedback-control-search').value.toLocaleLowerCase('pt-BR').trim();
 const items=ctrlFeedbackRows.filter(r=>[r.body,r.user_id,r.category,r.app_version].join(' ').toLocaleLowerCase('pt-BR').includes(f));
 $('feedback-control-count').textContent=String(ctrlFeedbackRows.length);
 $('feedback-control-open').textContent=String(ctrlFeedbackRows.filter(r=>['received','reviewing','planned'].includes(r.status)).length);
 if(!items.length){target.append(feedbackControlText('p','Nenhuma mensagem corresponde à pesquisa.','muted'));return}
 for(const r of items){
  const box=document.createElement('article');box.className='feedback-admin-item';
  const head=document.createElement('div');head.className='feedback-head';
  head.append(feedbackControlText('strong',(feedbackKindNames[r.category]||r.category)+' • '+feedbackDate(r.created_at)),feedbackControlText('span','Conta: '+(ctrlFeedbackEmails.get(r.user_id)||r.user_id.slice(0,8)+'…')+' • MOBILE '+(r.app_version||'?')));
  const body=feedbackControlText('p',r.body,'feedback-body');
  const label=feedbackControlText('label','Situação (Status)');
  const statusSel=document.createElement('select');statusSel.className='control-input';
  for(const [value,name] of Object.entries(feedbackStatusNames)){const o=new Option(name,value);statusSel.add(o)}statusSel.value=r.status;
  const responseLabel=feedbackControlText('label','Resposta visível para o testador');
  const reply=document.createElement('textarea');reply.className='control-input';reply.maxLength=1500;reply.placeholder='Resposta opcional';reply.value=r.owner_reply||'';
  const actions=document.createElement('div');actions.className='feedback-admin-actions';const button=feedbackControlText('button','Salvar acompanhamento','primary-button');button.type='button';
  const note=feedbackControlText('span','','feedback-admin-note');button.onclick=async()=>{
   if(!identity||permission?.role!=='owner')return;
   if(!window.confirm('Salvar situação e resposta deste feedback? A resposta poderá ser vista pelo testador.'))return;
   button.disabled=true;note.textContent='Salvando...';const epoch=sessionEpoch;
   try{const token=await accessToken();const payload={status:statusSel.value,owner_reply:reply.value.trim()||null,updated_at:new Date().toISOString()};
    const rows=await request('/rest/v1/alivi_feedback_messages?id=eq.'+encodeURIComponent(r.id)+'&select=id,status,owner_reply,updated_at',{method:'PATCH',token,headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(epoch!==sessionEpoch)return;
    if(!Array.isArray(rows)||rows.length!==1)throw Error('Atualização não confirmada.');Object.assign(r,rows[0]);note.textContent='Acompanhamento salvo.';await loadControlFeedback();
   }catch(e){if(epoch===sessionEpoch)note.textContent='Erro: '+e.message}finally{button.disabled=false}
  };
  actions.append(button,note);box.append(head,body,label,statusSel,responseLabel,reply,actions);target.append(box);
 }
}
async function loadControlFeedback(){
 if(!identity||permission?.role!=='owner')return;
 const epoch=sessionEpoch;$('feedback-control-status').textContent='Consultando mensagens voluntárias...';
 try{const token=await accessToken();const rows=await request('/rest/v1/alivi_feedback_messages?select=id,user_id,category,body,app_version,status,owner_reply,created_at,updated_at&order=created_at.desc&limit=100',{method:'GET',token});
 if(epoch!==sessionEpoch)return;if(!Array.isArray(rows))throw Error('Resposta inesperada.');ctrlFeedbackRows=rows;
 try{const users=await request('/rest/v1/rpc/alivi_central_list_clients',{method:'POST',token,body:'{}'});if(Array.isArray(users))ctrlFeedbackEmails=new Map(users.map(u=>[u.client_id,u.client_email]))}catch{ctrlFeedbackEmails=new Map()}
 if(epoch!==sessionEpoch)return;renderControlFeedback();$('feedback-control-status').textContent=rows.length+' feedback(s) carregado(s).'+(rows.length>=100?' Consulte períodos adicionais para registros antigos.':'');
 }catch(e){if(epoch!==sessionEpoch)return;$('feedback-control-status').textContent='Falha na consulta: '+e.message;$('feedback-control-list').replaceChildren()}
}
$('feedback-control-refresh').addEventListener('click',loadControlFeedback);
$('feedback-control-search').addEventListener('input',renderControlFeedback);
