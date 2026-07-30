'use strict';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SEDE_COLORS  = { 1:'#1D6FA4', 2:'#0D9276', 3:'#7C3AED', 4:'#F97316' };
const SEDE_NAMES   = { 1:'Cúcuta', 2:'Pamplona', 3:'Ocaña', 4:'Todas las sedes' };

let quill     = null;
let allEvents = [];
let currentId = null;

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDT(dt) {
  if (!dt) return '';
  const d = new Date(String(dt).replace(' ','T'));
  if (isNaN(d)) return dt;
  return d.toLocaleString('es-CO',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function toDatetimeLocal(dt) {
  if (!dt) return '';
  const d = new Date(String(dt).replace(' ','T'));
  if (isNaN(d)) return '';
  return d.toISOString().slice(0,16);
}

function loader(show) {
  document.getElementById('adm-loader').classList.toggle('show', show);
}
function toast(msg, type='ok') {
  const c  = document.getElementById('adm-toasts');
  const el = document.createElement('div');
  el.className = 'adm-toast ' + type;
  el.innerHTML = `<i class="fa-solid ${type==='ok'?'fa-check':'fa-triangle-exclamation'}"></i> ${esc(msg)}`;
  c.prepend(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  return res.json();
}

async function checkAuth() {
  const r = await api('GET','/api/admin/check-auth');
  if (r.authenticated) showApp();
}

async function doLogin() {
  const pass = document.getElementById('login-pass').value;
  if (!pass) return;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

  const r = await api('POST','/api/admin/login',{password: pass});
  if (r.success) {
    showApp();
  } else {
    const errEl = document.getElementById('login-error');
    errEl.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
    errEl.style.display = '';
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> &nbsp;Acceder';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
  }
}
window.doLogin = doLogin;

function togglePass() {
  const inp  = document.getElementById('login-pass');
  const icon = document.getElementById('eye-icon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fa-regular fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fa-regular fa-eye';
  }
}
window.togglePass = togglePass;

function showApp() {
  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  initQuill();
  adm.go('eventos');
}

function initQuill() {
  quill = new Quill('#ev-desc-editor', {
    theme: 'snow',
    placeholder: 'Redacte la descripción del evento...',
    modules: {
      toolbar: [
        [{ header: [1,2,3,false] }],
        ['bold','italic','underline','strike'],
        [{ color:[] },{ background:[] }],
        [{ list:'ordered' },{ list:'bullet' }],
        [{ align:[] }],
        ['link'],
        ['clean']
      ]
    }
  });
}

window.setColor = function(hex, el) {
  document.getElementById('ev-color').value = hex;
  document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('sel'));
  if (el) el.classList.add('sel');
};
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ev-color')?.addEventListener('input', e => {
    document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('sel'));
  });
});

const PAGES = ['eventos','form','settings'];
const PAGE_TITLES = { eventos:'Gestión de Eventos', nuevo:'Nuevo Evento', form:'Editar Evento', settings:'Configuración' };

function showPage(name) {
  PAGES.forEach(p => document.getElementById('page-'+p).style.display = p===name?'':'none');
  document.getElementById('adm-page-title').textContent = PAGE_TITLES[name] || 'Administración';
  document.querySelectorAll('.adm-nav-item').forEach(it => {
    it.classList.toggle('active', it.dataset.page === name || (name==='form' && it.dataset.page==='nuevo'));
  });
}

function evRow(ev, simple=false) {
  const color = ev.color || SEDE_COLORS[ev.sede_id] || '#1D6FA4';
  const sede  = `<span class="sede-chip" style="background:${color}18;color:${color}">${esc(ev.sede_nombre||'N/A')}</span>`;
  if (simple) return `
    <tr>
      <td><span class="ev-titulo">${esc(ev.titulo)}</span></td>
      <td>${sede}</td>
      <td>${fmtDT(ev.fecha_inicio)}</td>
      <td>${fmtDT(ev.fecha_fin)}</td>
    </tr>`;
  return `
    <tr>
      <td><span class="ev-titulo">${esc(ev.titulo)}</span></td>
      <td>${sede}</td>
      <td>${fmtDT(ev.fecha_inicio)}</td>
      <td>${fmtDT(ev.fecha_fin)}</td>
      <td style="color:var(--text3);font-size:12px">${fmtDT(ev.creado_en)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="adm.editEvent(${ev.id})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="adm.duplicarEvento(${ev.id})" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
          <button class="btn btn-ghost btn-sm" style="color:#DC2626" onclick="adm.confirmarEliminar(${ev.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
}

async function loadEventos() {
  const buscar = document.getElementById('ev-search')?.value || '';
  const sede   = document.getElementById('ev-sede-filter')?.value || '0';
  const p      = new URLSearchParams();
  if (buscar) p.set('buscar', buscar);
  if (sede && sede !== '0') p.set('sede', sede);
  loader(true);
  const r = await api('GET','/api/admin/eventos?'+p);
  loader(false);
  if (!r.success) return;
  allEvents = r.data;
  const tbody = document.getElementById('events-tbody');
  tbody.innerHTML = allEvents.length
    ? allEvents.map(ev => evRow(ev, false)).join('')
    : '<tr><td colspan="6" class="table-empty"><i class="fa-regular fa-calendar-xmark"></i><br>No se encontraron eventos</td></tr>';
}

function resetForm() {
  currentId = null;
  document.getElementById('ev-id').value    = '';
  document.getElementById('ev-titulo').value  = '';
  document.getElementById('ev-inicio').value  = '';
  document.getElementById('ev-fin').value     = '';
  document.getElementById('ev-sede').value    = '';
  document.getElementById('ev-color').value   = '#1D6FA4';
  document.querySelectorAll('.color-preset').forEach((p,i) => p.classList.toggle('sel',i===0));
  if (quill) quill.setContents([]);
  document.getElementById('btn-duplicar').style.display = 'none';
  document.getElementById('btn-eliminar').style.display = 'none';
  document.getElementById('adm-page-title').textContent = 'Nuevo Evento';
}

async function loadEventForm(id) {
  resetForm();
  loader(true);
  const r = await api('GET','/api/admin/eventos/'+id);
  loader(false);
  if (!r.success) { toast('Error cargando evento','err'); return; }
  const ev = r.data;
  currentId = ev.id;

  document.getElementById('ev-id').value    = ev.id;
  document.getElementById('ev-titulo').value  = ev.titulo;
  document.getElementById('ev-inicio').value  = toDatetimeLocal(ev.fecha_inicio);
  document.getElementById('ev-fin').value     = toDatetimeLocal(ev.fecha_fin);
  document.getElementById('ev-sede').value    = ev.sede_id || '';
  document.getElementById('ev-color').value   = ev.color || '#1D6FA4';

  document.querySelectorAll('.color-preset').forEach(p => {
    p.classList.toggle('sel', p.dataset.color === ev.color);
  });

  if (quill) quill.clipboard.dangerouslyPasteHTML(ev.descripcion || '');

  document.getElementById('adm-page-title').textContent = 'Editar Evento';
  document.getElementById('btn-duplicar').style.display = '';
  document.getElementById('btn-eliminar').style.display = '';
  showPage('form');
}

async function saveEvent() {
  const titulo  = document.getElementById('ev-titulo').value.trim();
  const inicio  = document.getElementById('ev-inicio').value;
  const fin     = document.getElementById('ev-fin').value;
  const sede    = document.getElementById('ev-sede').value;
  const color   = document.getElementById('ev-color').value;
  const desc    = quill ? quill.root.innerHTML : '';

  if (!titulo) { toast('El título es requerido','err'); document.getElementById('ev-titulo').focus(); return; }
  if (!inicio)  { toast('La fecha de inicio es requerida','err'); return; }
  if (!fin)     { toast('La fecha de fin es requerida','err'); return; }
  if (new Date(fin) < new Date(inicio)) { toast('La fecha de fin no puede ser anterior al inicio','err'); return; }

  const fd = new FormData();
  fd.append('titulo',      titulo);
  fd.append('fecha_inicio', inicio);
  fd.append('fecha_fin',    fin);
  fd.append('sede_id',      sede);
  fd.append('color',        color);
  fd.append('descripcion',  desc);

  loader(true);
  let r;
  if (currentId) {
    r = await fetch('/api/admin/eventos/'+currentId, { method:'PUT', body: fd }).then(res=>res.json());
  } else {
    r = await fetch('/api/admin/eventos', { method:'POST', body: fd }).then(res=>res.json());
  }
  loader(false);

  if (r.success) {
    toast(currentId ? 'Evento actualizado correctamente' : 'Evento creado correctamente');
    adm.go('eventos');
  } else {
    toast('Error: ' + (r.error||'Error desconocido'), 'err');
  }
}

async function duplicarEvento(id) {
  loader(true);
  const r = await api('POST','/api/admin/eventos/'+id+'/duplicar');
  loader(false);
  if (r.success) { toast('Evento duplicado'); await loadEventos(); }
  else toast('Error al duplicar','err');
}

function confirmarEliminar(id) {
  const targetId = id || currentId;
  if (!targetId) return;
  const bg = document.createElement('div');
  bg.className = 'adm-modal-bg';
  bg.innerHTML = `
    <div class="adm-modal-box">
      <h3>Eliminar evento</h3>
      <p>¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.</p>
      <div class="adm-modal-btns">
        <button class="btn btn-danger" id="confirm-del">Sí, eliminar</button>
        <button class="btn btn-secondary" onclick="this.closest('.adm-modal-bg').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(bg);
  document.getElementById('confirm-del').addEventListener('click', async () => {
    bg.remove();
    loader(true);
    const r = await api('DELETE','/api/admin/eventos/'+targetId);
    loader(false);
    if (r.success) { toast('Evento eliminado'); adm.go('eventos'); }
    else toast('Error al eliminar','err');
  });
}

async function loadSettings() {
  const r = await api('GET','/api/admin/config');
  if (!r.success) return;
  const cfg = r.data;
  document.getElementById('cfg-nombre').value    = cfg.empresa_nombre  || '';
  document.getElementById('cfg-color1').value    = cfg.color_primario  || '#F97316';
  document.getElementById('cfg-color1-txt').value= cfg.color_primario  || '#F97316';
  document.getElementById('cfg-color2').value    = cfg.color_secundario|| '#EA580C';
  document.getElementById('cfg-color2-txt').value= cfg.color_secundario|| '#EA580C';
  document.getElementById('cfg-pass').value      = '';

  ['cfg-color1','cfg-color2'].forEach(id => {
    const picker = document.getElementById(id);
    const txt    = document.getElementById(id+'-txt');
    picker.addEventListener('input', () => txt.value = picker.value);
    txt.addEventListener('input',   () => { if (/^#[0-9A-F]{6}$/i.test(txt.value)) picker.value = txt.value; });
  });
  showPage('settings');
}

async function saveSettings() {
  const body = {
    empresa_nombre:   document.getElementById('cfg-nombre').value.trim(),
    color_primario:   document.getElementById('cfg-color1').value,
    color_secundario: document.getElementById('cfg-color2').value,
    nueva_password:   document.getElementById('cfg-pass').value
  };
  loader(true);
  const r = await api('PUT','/api/admin/config', body);
  loader(false);
  if (r.success) toast('Configuración guardada');
  else toast('Error guardando configuración','err');
}

async function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('logo', file);
  loader(true);
  const r = await fetch('/api/admin/config/logo',{method:'POST',body:fd}).then(res=>res.json());
  loader(false);
  if (r.success) {
    toast('Logo actualizado');
    const ts = Date.now();
    document.getElementById('cfg-logo-preview').src = '/Logos.png?t='+ts;
  } else {
    toast('Error al subir logo','err');
  }
  input.value = '';
}

window.adm = {
  go(page) {
    if (page === 'eventos')      { showPage('eventos'); loadEventos(); }
    else if (page === 'nuevo')   { resetForm(); showPage('form'); }
    else if (page === 'settings'){ loadSettings(); }
  },
  editEvent: loadEventForm,
  filterEvents: loadEventos,
  saveEvent,
  duplicar()           { if (currentId) duplicarEvento(currentId); },
  duplicarEvento,
  confirmarEliminar,
  saveSettings,
  uploadLogo,
  logout: async function() {
    await api('POST','/api/admin/logout');
    location.reload();
  }
};

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

checkAuth();
