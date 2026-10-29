// ===== CONFIGURE AQUI (Supabase > Project Settings > API) =====
// Use SOMENTE a chave "anon / public". NUNCA coloque a "service_role" aqui.
const SB_URL = 'https://jxnmorhnmwmbppdorbyt.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bm1vcmhubXdtYnBwZG9yYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNzE3OTMsImV4cCI6MjEwODg0Nzc5M30.wRjZX9JPsFg0n59cimLAn-BlF0oSzqLZi3IVa_aiJGA';
// ==============================================================

const sb = supabase.createClient(SB_URL, SB_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me = null, lojas = [], perm = new Set(), cur = {rel: [], exc: []}, eanOk = false, del = null, ed = null;
const isAdm = () => me && ['admin','lider'].includes(me.papel);
const can = id => isAdm() || perm.has(id);
const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const hoje = () => iso(new Date());
const addM = n => { const d = new Date(); d.setHours(0,0,0,0); const dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n);
  d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth()+1, 0).getDate())); return iso(d); };
const fmt = s => s.split('-').reverse().join('/');
const lojaNome = id => (lojas.find(l => l.id === id) || {}).nome || '?';
const cls = v => v < hoje() ? 'k' : v <= addM(1) ? 'r' : v <= addM(2) ? 'o' : v <= addM(3) ? 'y' : '';
const msgErro = e => (e && e.message || 'Erro inesperado').replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ])/, '');

function toast(t, bad) {
  const m = $('#toast'); m.textContent = t; m.className = bad ? 'bad' : ''; m.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => m.hidden = true, 3500);
}

// ---------- login ----------
$('#go').onclick = async () => {
  $('#lerr').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
  $('#pw').value = '';
  if (error) {
    console.error('Erro de login:', error);
    const m = error.message || '';
    $('#lerr').textContent = /invalid login/i.test(m) ? 'E-mail ou senha inválidos.'
      : /not confirmed/i.test(m) ? 'E-mail não confirmado. No Supabase, marque "Auto Confirm" no usuário.'
      : /fetch|network/i.test(m) ? 'Não conectou ao Supabase. Confira o SB_URL (termina em .supabase.co) e a chave.'
      : 'Erro: ' + m;
  } else boot();
};
$('#pw').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); };
$('#out').onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('#login').hidden = false; $('#app').hidden = true; return; }
  const { data: p } = await sb.from('perfis').select('*').eq('id', session.user.id).maybeSingle();
  if (!p) { await sb.auth.signOut(); $('#lerr').textContent = 'Usuário sem perfil. Fale com o administrador.'; return; }
  me = { ...p, email: session.user.email };
  const r = await sb.from('lojas').select('*').order('nome'); lojas = r.data || [];
  $('#login').hidden = true; $('#app').hidden = false;
  $('#who').textContent = me.nome;
  $('#role').textContent = { admin:'Admin', lider:'Líder', estoquista:'Estoquista', atendente:'Atendente' }[me.papel] + (me.papel === 'admin' ? ' · todas as lojas' : me.papel === 'lider' ? ' · gerencia todas · anota em ' + lojaNome(me.loja_id) : ' · ' + lojaNome(me.loja_id));
  const opts = lojas.filter(l => l.ativa || isAdm()).map(l => `<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  $('#lj').innerHTML = opts; $('#lj-box').hidden = me.papel !== 'admin';
  ['rel','exc'].forEach(p => { $('#f-' + p).innerHTML = filtros(p); $(`#${p}-lj`).innerHTML = '<option value="">Todas</option>' + opts; $(`#${p}-lj`).parentElement.hidden = !isAdm(); });
  $('#adm-bar').hidden = me.papel !== 'admin'; // exportar/importar: só Admin
  ['rel','exc'].forEach(p => $('#f-' + p).querySelectorAll('select,input').forEach(el => el.onchange = () => load(p)));
  ['rel','exc'].forEach(p => $(`#${p}-q`).oninput = () => { clearTimeout(load.t); load.t = setTimeout(() => load(p), 300); });
  go('anotar');
}

const filtros = p => `<div class="fl">
 <div><label>Loja</label><select id="${p}-lj"></select></div>
 <div><label>Validade de</label><input type="date" id="${p}-de"></div>
 <div><label>Validade até</label><input type="date" id="${p}-ate"></div>
 <div><label>Vencem em até</label><select id="${p}-m"><option value="">Todos</option>${[1,2,3,4,6,12].map(n => `<option value="${n}">${n} ${n > 1 ? 'meses' : 'mês'}</option>`).join('')}</select></div>
 <div><label>Ordem da data</label><select id="${p}-o"><option value="asc">Mais próximos primeiro</option><option value="desc">Mais distantes primeiro</option></select></div>
 <div><label>Buscar</label><input id="${p}-q" placeholder="EAN ou nome"></div></div>`;

// ---------- abas ----------
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.t));
async function go(t) {
  ['anotar','rel','exc'].forEach(x => $('#t-' + x).hidden = x !== t);
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'rel') { await loadPerm(); load('rel'); }
  if (t === 'exc') load('exc');
  if (t === 'anotar') $('#ean').focus();
}

// ---------- anotar ----------
async function chk() {
  const e = $('#ean').value.trim(), box = $('#chk'); eanOk = false;
  if (!/^\d{8,14}$/.test(e)) { box.hidden = true; upd(); return; }
  const { data } = await sb.from('produtos').select('descricao').eq('ean', e).maybeSingle();
  if ($('#ean').value.trim() !== e) return;
  box.hidden = false;
  if (data) {
    box.className = 'chk';
    box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-square-fill" viewBox="0 0 16 16">
  <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm10.03 4.97a.75.75 0 0 1 .011 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.75.75 0 0 1 1.08-.022z"/>
</svg> Cadastrado: <b>${esc(data.descricao)}</b><br>É este produto?<br><button class="btn" id="sim">Sim</button><button class="btn s" id="nao">Não</button>`;
    $('#sim').onclick = () => { eanOk = true; box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-square-fill" viewBox="0 0 16 16">
  <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm10.03 4.97a.75.75 0 0 1 .011 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.75.75 0 0 1 1.08-.022z"/>
</svg> <b>${esc(data.descricao)}</b>`; upd(); $('#qtd').focus(); };
    $('#nao').onclick = () => { $('#ean').value = ''; box.hidden = true; upd(); $('#ean').focus(); };
  } else { box.className = 'chk w'; box.textContent = '⚠️ EAN sem cadastro. Será anotado sem descrição.'; eanOk = true; }
  upd();
}
function upd() { $('#send').disabled = !(eanOk && +$('#qtd').value >= 1 && dtISO()); }
$('#ean').oninput = () => { $('#ean').value = $('#ean').value.replace(/\D/g, '').slice(0, 14); eanOk = false; $('#chk').hidden = true; upd(); clearTimeout(chk.t); chk.t = setTimeout(chk, 250); };
$('#ean').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); chk().then(() => $('#qtd').focus()); } }; // leitor USB termina com Enter
$('#qtd').oninput = upd;
// data digitada: só números, as barras entram sozinhas (dd/mm/aaaa)
function dtISO() {
  const m = $('#dt').value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null;
  const [, d, mo, y] = m, x = new Date(+y, +mo - 1, +d);
  return x.getFullYear() == y && x.getMonth() == mo - 1 && x.getDate() == d && y >= 2000 && y <= 2100 ? `${y}-${mo}-${d}` : null;
}
$('#dt').oninput = e => {
  const del = (e.inputType || '').startsWith('delete'), v = $('#dt').value.replace(/\D/g, '').slice(0, 8);
  let o = v.slice(0, 2);
  if (v.length > 2) o += '/' + v.slice(2, 4); else if (v.length === 2 && !del) o += '/';
  if (v.length > 4) o += '/' + v.slice(4); else if (v.length === 4 && !del) o += '/';
  $('#dt').value = o;
  $('#aerr').textContent = o.length === 10 && !dtISO() ? 'Data inválida.' : '';
  upd();
};
// ícone de calendário: abre o seletor nativo do celular/PC
$('#cal').onclick = () => { const p = $('#dtp'); try { p.showPicker(); } catch { p.focus(); p.click(); } };
$('#dtp').onchange = () => { const v = $('#dtp').value; if (v) { $('#dt').value = v.split('-').reverse().join('/'); $('#aerr').textContent = ''; upd(); } };
$('#send').onclick = async () => {
  $('#aerr').textContent = ''; $('#send').disabled = true;
  const { error } = await sb.rpc('anotar_item', { p_loja: me.papel === 'admin' ? +$('#lj').value : me.loja_id, p_ean: $('#ean').value.trim(), p_qtd: +$('#qtd').value, p_validade: dtISO() });
  if (error) { $('#aerr').textContent = msgErro(error); upd(); return; }
  toast('Salvo!'); $('#ean').value = ''; $('#qtd').value = ''; $('#chk').hidden = true; eanOk = false; upd(); $('#ean').focus();
};

// ---------- câmera ----------
let strm, rd, tm;
function stopCam() { clearInterval(tm); if (strm) strm.getTracks().forEach(t => t.stop()); if (rd) rd.reset(); strm = rd = null; }
$('#sd').onclose = stopCam;
$('#sc').onclick = () => $('#sd').close();
$('#cam').onclick = async () => {
  $('#sd').showModal(); const v = $('#vid'); let ok = false;
  const done = c => { if (ok) return; ok = true; $('#sd').close(); $('#ean').value = c.replace(/\D/g, ''); chk(); };
  try {
    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e'] });
      strm = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      v.srcObject = strm; await v.play();
      tm = setInterval(async () => { try { const r = await det.detect(v); if (r[0]) done(r[0].rawValue); } catch {} }, 250);
    } else {
      await new Promise((res, rej) => { if (window.ZXing) return res(); const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      rd = new ZXing.BrowserMultiFormatReader(); rd.decodeFromVideoDevice(null, 'vid', r => { if (r) done(r.getText()); });
    }
  } catch { $('#sd').close(); toast('Não foi possível abrir a câmera (use HTTPS e permita o acesso).', 1); }
};

// ---------- listas ----------
async function loadPerm() {
  perm = new Set(); if (isAdm()) return;
  const { data } = await sb.from('itens').select('id').eq('atualizado_por', me.id).order('atualizado_em', { ascending: false }).limit(3);
  (data || []).forEach(r => perm.add(r.id));
}
async function all(mk) {
  let out = [], f = 0;
  for (;;) { const { data, error } = await mk().range(f, f + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) return out; f += 1000; }
}
async function load(p) {
  const L = $(`#${p}-l`), g = id => $(`#${p}-${id}`).value; L.textContent = 'Carregando…';
  try {
    let rows = await all(() => {
      let q = sb.from(p === 'rel' ? 'itens_v' : 'excluidos_v').select('*').order('validade').order('id');
      if (g('lj')) q = q.eq('loja_id', +g('lj'));
      if (g('de')) q = q.gte('validade', g('de'));
      if (g('ate')) q = q.lte('validade', g('ate'));
      if (g('m')) q = q.lte('validade', addM(+g('m')));
      return q;
    });
    const s = g('q').trim().toLowerCase();
    if (s) rows = rows.filter(r => r.ean.includes(s) || (r.descricao || '').toLowerCase().includes(s));
    const h = hoje(), ok = rows.filter(r => r.validade >= h), venc = rows.filter(r => r.validade < h);
    if (g('o') === 'desc') ok.reverse();
    rows = ok.concat(venc); // vencidos sempre embaixo
    cur[p] = rows;
    L.innerHTML = rows.length ? rows.map(r => row(p, r)).join('') : '<div class="card">Nenhum item encontrado.</div>';
  } catch (e) { L.innerHTML = `<div class="card err">${esc(msgErro(e))}</div>`; }
}
function row(p, r) {
  const c = p === 'rel' ? cls(r.validade) : 'g';
  const d = Math.round((new Date(r.validade + 'T00:00') - new Date(hoje() + 'T00:00')) / 864e5);
  const quando = d < 0 ? `vencido há ${-d} d` : d === 0 ? 'vence hoje' : `faltam ${d} d`;
  let ac = '';
  if (p === 'rel' && can(r.id)) ac = (isAdm() ? `<button data-e="${r.id}" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-fill" viewBox="0 0 16 16">
  <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"/>
</svg></button>` : '') + `<button data-d="${r.id}" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16">
  <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/>
</svg></button>`;
  if (p === 'exc' && isAdm()) ac = `<button data-r="${r.id}" title="Restaurar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-return-left" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5"/>
</svg></button>`;
  return `<div class="it ${c}"><div><b>${c === 'k' ? '🚨 ' : ''}${esc(r.descricao || 'Sem descrição')}</b>
   <small>EAN ${esc(r.ean)} · ${esc(lojaNome(r.loja_id))} · Qtd <b>${r.quantidade}</b></small>
   <small>${fmt(r.validade)} · ${quando}</small>
   ${p === 'exc' ? `<small>Motivo: ${esc(r.motivo + (r.motivo_texto ? ' – ' + r.motivo_texto : ''))} · por ${esc(r.por)}</small>` : ''}</div><div class="ac">${ac}</div></div>`;
}
['rel','exc'].forEach(p => $(`#${p}-l`).onclick = async ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.d) openDel(cur.rel.find(r => r.id === b.dataset.d));
  if (b.dataset.e) openEdit(cur.rel.find(r => r.id === b.dataset.e));
  if (b.dataset.r && confirm('Restaurar este item para o relatório?')) {
    const { error } = await sb.rpc('restaurar_item', { p_id: b.dataset.r });
    error ? toast(msgErro(error), 1) : (toast('Restaurado'), load('exc'));
  }
});

// ---------- excluir ----------
function openDel(r) {
  if (!r) return; const max = isAdm() ? r.quantidade : Math.min(r.quantidade, r.ultima_qtd);
  del = { id: r.id, max }; $('#dinfo').textContent = `${r.descricao || 'Sem descrição'} · EAN ${r.ean} · em estoque: ${r.quantidade}`;
  $('#dq').value = max; $('#dq').max = max; $('#dm').selectedIndex = 0; $('#dt2').value = ''; $('#dp').value = ''; $('#derr').textContent = '';
  $('#dtb').hidden = true; $('#dpb').hidden = isAdm(); $('#dd').showModal();
}
$('#dm').onchange = () => $('#dtb').hidden = $('#dm').value !== 'Outro';
$('#dc').onclick = () => $('#dd').close();
$('#dok').onclick = async () => {
  const m = $('#dm').value, t = $('#dt2').value.trim(), q = +$('#dq').value, er = x => ($('#derr').textContent = x);
  if (m === 'Outro' && t.length < 3) return er('Descreva o motivo.');
  if (!(q >= 1 && q <= del.max)) return er('Quantidade inválida (máx. ' + del.max + ').');
  $('#dok').disabled = true;
  try {
    if (!isAdm()) {
      if (!$('#dp').value) return er('Informe sua senha.');
      const { error } = await sb.auth.signInWithPassword({ email: me.email, password: $('#dp').value });
      if (error) return er('Senha incorreta.');
    }
    const { error } = await sb.rpc('excluir_item', { p_id: del.id, p_qtd: q, p_motivo: m, p_texto: m === 'Outro' ? t : null });
    if (error) return er(msgErro(error));
    $('#dd').close(); toast('Item excluído'); await loadPerm(); load('rel');
  } finally { $('#dok').disabled = false; $('#dp').value = ''; }
};

// ---------- editar (admin/líder) ----------
function openEdit(r) {
  if (!r) return; ed = r.id; $('#einfo').textContent = `${r.descricao || 'Sem descrição'} · EAN ${r.ean}`;
  $('#eq').value = r.quantidade; $('#ev').value = r.validade; $('#eerr').textContent = ''; $('#ed').showModal();
}
$('#ec').onclick = () => $('#ed').close();
$('#eok').onclick = async () => {
  const { error } = await sb.rpc('editar_item', { p_id: ed, p_qtd: +$('#eq').value, p_validade: $('#ev').value });
  if (error) return $('#eerr').textContent = msgErro(error);
  $('#ed').close(); toast('Atualizado'); load('rel');
};

// ---------- exportar / importar ----------
function dl(b, n) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function pkl(arr) { // pickle protocolo 2: list[str], abre direto com pickle.load() no Python
  const e = new TextEncoder(), p = [new Uint8Array([0x80, 2, 0x5d, 0x28])];
  for (const s of arr) { const b = e.encode(s), h = new Uint8Array(5); h[0] = 0x58; new DataView(h.buffer).setUint32(1, b.length, true); p.push(h, b); }
  p.push(new Uint8Array([0x65, 0x2e])); return new Blob(p, { type: 'application/octet-stream' });
}
const semDesc = () => [...new Set(cur.rel.filter(r => !r.descricao).map(r => r.ean))];
$('#xp').onclick = () => { const e = semDesc(); e.length ? dl(pkl(e), 'eans_sem_descricao.pkl') : toast('Todos os itens da lista já têm descrição'); };
$('#xc').onclick = () => { const e = semDesc(); e.length ? dl(new Blob(['ean\n' + e.join('\n')], { type: 'text/csv' }), 'eans_sem_descricao.csv') : toast('Todos os itens da lista já têm descrição'); };
$('#ib').onclick = () => $('#imp').click();
function csv(t) {
  const r = []; let row = [], c = '', q = false; t = t.replace(/^\uFEFF/, '');
  const l1 = t.split(/\r?\n/)[0], sep = l1.split(';').length > l1.split(',').length ? ';' : ','; // aceita ; ou ,
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i+1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i+1] === '\n') i++; row.push(c); r.push(row); row = []; c = ''; }
    else c += ch; }
  if (c || row.length) { row.push(c); r.push(row); }
  return r.filter(x => x.some(y => y.trim()));
}
$('#imp').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (f.size > 5e6) return toast('Arquivo grande demais (máx. 5 MB)', 1);
  const rows = csv(await f.text()); if (rows.length < 2) return toast('CSV vazio', 1);
  const h = rows[0].map(x => x.trim().toLowerCase());
  let ie = h.findIndex(x => /^(ean|c[oó]digo)/.test(x)), id = h.findIndex(x => /^desc/.test(x));
  if (ie < 0 || id < 0) { ie = 0; id = 1; }
  const m = new Map(); let bad = 0;
  for (const r of rows.slice(1)) { const e = (r[ie] || '').replace(/\D/g, ''), d = (r[id] || '').trim();
    if (/^\d{8,14}$/.test(e) && d) m.set(e, d.slice(0, 200)); else bad++; }
  const list = [...m].map(([ean, descricao]) => ({ ean, descricao }));
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await sb.rpc('importar_produtos', { p: list.slice(i, i + 500) });
    if (error) return toast(msgErro(error), 1);
  }
  toast(`${list.length} descrições importadas, ${bad} linhas ignoradas`); load('rel');
};

boot();