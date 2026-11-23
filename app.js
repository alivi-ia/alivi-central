'use strict';
// ALIVI CONTROL 1.6 — somente a chave PÚBLICA do Supabase no navegador.
// Segurança dos dados: o banco aplica RLS com base no JWT da conta autenticada.
const CONTROL_VERSION='1.6.0';
const SB='https://xadzckilujbydycebizj.supabase.co';
const PUB='sb_publishable_Gm2JW3ns-WmQmFvg3JNXjA_n0VjCDpD';
const SESSION_KEY='alivi-central-session-v1';
const THEME_KEY='alivi-central-theme-v1';
const $=id=>document.getElementById(id);
let session=null,identity=null,permission=null,refreshing=null,clientRows=null,clientsLoading=null,sessionEpoch=0;
const cache={companies:null,plans:null,subscriptions:null,usage:null};
const inFlight={};
const titles={overview:['Visão geral','Sua operação, em um só lugar.','Acompanhe clientes, empresas, planos e consumo sem acessar dados privados.'],clients:['Clientes','Gestão de clientes.','Consulta protegida de contas cadastradas no Supabase, sem acesso a conversas particulares.'],companies:['Empresas','Empresas e acessos.','Cadastre empresas e confira os vínculos autorizados nesta conta.'],subscriptions:['Planos e assinaturas','Planos e assinaturas.','Acompanhamento comercial sem cobranças reais nesta versão.'],monitoring:['Consumo e custos','Indicadores de consumo.','Eventos registrados pela operação, não faturas do provedor de IA.'],settings:['Configurações','Seu painel, suas escolhas.','Personalize a aparência da ALIVI CONTROL neste aparelho.']};
function status(message,error=false){$('login-status').textContent=message;$('login-status').classList.toggle('error',error)}
function setTheme(name){const theme=name==='cristal'?'cristal':'orbital';document.body.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);$('theme-label').textContent=theme==='cristal'?'Azul Orbital':'Azul Cristal';$('theme-toggle').firstChild.textContent=theme==='cristal'?'☾ ':'☀ ';$('pick-orbital').classList.toggle('selected',theme==='orbital');$('pick-cristal').classList.toggle('selected',theme==='cristal')}
function showAuth(message='Somente contas administrativas autorizadas.',error=false){$('panel-view').hidden=true;$('auth-view').hidden=false;status(message,error)}
function showPanel(){if(!identity||!permission?.active)throw Error('Sem autorização administrativa');$('auth-view').hidden=true;$('panel-view').hidden=false;const role=permission.role==='owner'?'Proprietário':permission.role==='admin'?'Administrador':'Suporte';$('access-role').textContent=role;$('account-role').textContent=role;$('account-email').textContent=identity.email||'Conta autorizada';$('settings-email').textContent=identity.email||'Conta autorizada';navigate('overview')}
function navigate(screen){const entry=titles[screen];if(!entry)return;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+screen));document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));$('breadcrumb-current').textContent=entry[0];$('page-heading').textContent=entry[1];$('page-description').textContent=entry[2];closeMenu();if(screen==='clients'&&clientRows===null)loadClients();if(screen==='companies')loadCompanies();if(screen==='subscriptions')loadCommercial();if(screen==='monitoring')loadUsage();if(screen==='overview')loadOverview()}
function closeMenu(){$('sidebar').classList.remove('open');$('drawer-overlay').hidden=true}
function storeSession(data){session=data;localStorage.setItem(SESSION_KEY,JSON.stringify(data))}
function clearSession(){session=null;identity=null;permission=null;refreshing=null;clientRows=null;clientsLoading=null;sessionEpoch++;Object.keys(cache).forEach(k=>{cache[k]=null;delete inFlight[k]});localStorage.removeItem(SESSION_KEY);$('clients-count').textContent='—';$('clients-verified').textContent='—';$('clients-table-body').replaceChildren();$('clients-status').textContent='Entre novamente para consultar os cadastros.';for(const [id,cols] of [['companies-table-body',4],['plans-table-body',5],['subs-table-body',5],['usage-table-body',5]])escTable(id,cols,'Entre novamente para consultar.');for(const id of ['companies-count','companies-active','overview-companies','overview-plans','overview-subs','overview-usage','overview-cost','usage-count','usage-input','usage-output','usage-cost'])$(id).textContent='—';for(const id of ['companies-status','plans-status','subs-status','usage-status','overview-status','company-create-status'])$(id).textContent='Entre novamente para consultar ou alterar registros.'}
async function request(path,opts={}){const r=await fetch(SB+path,{...opts,headers:{apikey:PUB,'Content-Type':'application/json',...(opts.token?{Authorization:'Bearer '+opts.token}:{}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const err=new Error(data.msg||data.error_description||data.message||data.error||('Erro HTTP '+r.status));err.status=r.status;throw err}return data}
async function accessToken(){if(!session?.access_token)throw Error('Entre novamente na CONTROL');if(Number(session.expires_at||0)>Date.now()/1000+90)return session.access_token;if(!session.refresh_token)throw Error('Sessão expirada. Entre novamente.');if(!refreshing)refreshing=(async()=>{const d=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});storeSession(d);return d.access_token})().finally(()=>{refreshing=null});return refreshing}
async function validateAccess(){const token=await accessToken();const user=await request('/auth/v1/user',{method:'GET',token});if(!user.id||!user.email_confirmed_at)throw Error('Confirme seu e-mail antes de acessar a CENTRAL');const rows=await request('/rest/v1/alivi_central_admins?select=user_id,role,active&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{method:'GET',token});if(!Array.isArray(rows)||rows.length!==1||rows[0].active!==true||!['owner','admin'].includes(rows[0].role))throw Error('Esta conta não tem autorização ativa para a ALIVI CONTROL.');identity=user;permission=rows[0];return true}
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
 try{const rows=await tableRows('companies',force);renderCompanyRows();textStatus('companies-status',`${rows.length} empresa(s) vinculada(s) carregada(s), até 200 por consulta.`)}
 catch(e){textStatus('companies-status','Falha na consulta: '+e.message);$('companies-count').textContent='—';$('companies-active').textContent='—';escTable('companies-table-body',4,'Não foi possível carregar as empresas.')}
 finally{btn.disabled=false}
}
const subState={draft:'Rascunho',trial:'Teste',active:'Ativa',past_due:'Atrasada',paused:'Pausada',canceled:'Cancelada'};
async function loadCommercial(force=false){
 const btn=$('commercial-refresh');btn.disabled=true;
 textStatus('plans-status','Consultando planos no Supabase...');
 textStatus('subs-status','Consultando assinaturas...');
 try{
  const [plans,subs]=await Promise.all([tableRows('plans',force),tableRows('subscriptions',force)]);
  // Nomes de empresas apenas quando a conta tem visibilidade RLS sobre elas.
  let companies=[];try{companies=await tableRows('companies',force)}catch(e){console.warn('Visibilidade de empresas:',e.message)}
  const companyNames=new Map(companies.map(c=>[c.id,c.name]));
  const planNames=new Map(plans.map(p=>[p.id,p.name]));
  const tb=$('plans-table-body');tb.replaceChildren();
  if(!plans.length)escTable('plans-table-body',5,'Nenhum plano cadastrado.');
  else for(const p of plans)tb.appendChild(addCells(document.createElement('tr'),[p.name,p.code,moneyCents(p.monthly_price_cents),moneyCents(p.annual_price_cents),p.active?'Ativo':'Inativo']));
  textStatus('plans-status',`${plans.length} plano(s) na consulta (até 200).`);
  const sb=$('subs-table-body');sb.replaceChildren();
  if(!subs.length)escTable('subs-table-body',5,'Nenhuma assinatura cadastrada.');
  else for(const s of subs)sb.appendChild(addCells(document.createElement('tr'),[companyNames.get(s.company_id)||'Empresa não visível',planNames.get(s.plan_id)||'Plano não listado',s.billing_cycle==='annual'?'Anual':'Mensal',subState[s.status]||s.status,moneyCents(s.price_snapshot_cents)]));
  textStatus('subs-status',`${subs.length} assinatura(s) na consulta (até 200).`);
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
 const res=await Promise.allSettled(keys.map(k=>tableRows(k,force)));
 if(!identity){btn.disabled=false;return}
 const ids=['overview-companies','overview-plans','overview-subs','overview-usage'];
 res.forEach((r,i)=>$(ids[i]).textContent=r.status==='fulfilled'?nfmt.format(r.value.length):'—');
 $('overview-cost').textContent=res[3].status==='fulfilled'?moneyBrl(res[3].value.reduce((sum,r)=>sum+Number(r.estimated_cost_brl||0),0)):'—';
 const err=res.find(r=>r.status==='rejected');
 textStatus('overview-status',err?'Consulta parcial. Algum módulo retornou erro; confira a permissão e atualize.':'Resumo obtido do Supabase (até 200 registros por módulo; sem faturamento inventado).');
 btn.disabled=false;
}
$('companies-refresh').addEventListener('click',()=>loadCompanies(true));
$('companies-search').addEventListener('input',()=>{if(Array.isArray(cache.companies))renderCompanyRows()});
$('commercial-refresh').addEventListener('click',()=>loadCommercial(true));
$('usage-refresh').addEventListener('click',()=>loadUsage(true));
$('overview-refresh').addEventListener('click',()=>loadOverview(true));
$('company-form').addEventListener('submit',async e=>{
 e.preventDefault();
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

