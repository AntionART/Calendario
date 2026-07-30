'use strict';

const MONTHS       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS         = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SEDE_COLORS  = { 1:'#1D6FA4', 2:'#0D9276', 3:'#7C3AED', 4:'#F97316' };
const MAX_SLOTS    = 3;
const SLOT_H       = 23;
const SLOT_GAP     = 2;
const DAY_HDR_H    = 30;
const CELL_W       = 100 / 7;

const state = {
  view: 'month',
  date: new Date(),
  events: [],
  sede: '0',
  search: '',
  miniDate: new Date()
};

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function pd(dt) {
  if (!dt) return new Date(NaN);
  return new Date(String(dt).replace(' ','T'));
}
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDateTime(dt) {
  const d = pd(dt);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CO', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtShortDate(d) {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function weekStart(date) {
  const d = new Date(date);
  const wd = d.getDay();
  d.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1));
  d.setHours(0,0,0,0);
  return d;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function evColor(ev)   { return ev.color || SEDE_COLORS[ev.sede_id] || '#F97316'; }

async function fetchEvents() {
  const p = new URLSearchParams();
  if (state.sede && state.sede !== '0') p.set('sede', state.sede);
  if (state.search.trim()) p.set('buscar', state.search.trim());
  try {
    showLoader(true);
    const res  = await fetch('/api/eventos?' + p);
    const data = await res.json();
    if (data.success) state.events = data.data;
  } catch(e) {
    console.error('Error cargando eventos:', e);
  } finally {
    showLoader(false);
  }
}

async function fetchEventById(id) {
  const res  = await fetch('/api/eventos/' + id);
  const data = await res.json();
  return data.success ? data.data : null;
}

function assignSlots(weekDays, events) {
  const ws = new Date(weekDays[0]); ws.setHours(0,0,0,0);
  const we = new Date(weekDays[6]); we.setHours(23,59,59,999);

  const relevant = events.filter(ev => {
    const s = pd(ev.fecha_inicio), e = pd(ev.fecha_fin);
    return s <= we && e >= ws;
  });

  relevant.sort((a,b) => {
    const da = pd(a.fecha_fin)-pd(a.fecha_inicio);
    const db = pd(b.fecha_fin)-pd(b.fecha_inicio);
    return da !== db ? db-da : pd(a.fecha_inicio)-pd(b.fecha_inicio);
  });

  const grid = Array.from({length:7}, () => Array(MAX_SLOTS).fill(null));
  const placed = [], overflow = Array(7).fill(0);

  for (const ev of relevant) {
    const es = new Date(pd(ev.fecha_inicio)); es.setHours(0,0,0,0);
    const ee = new Date(pd(ev.fecha_fin));    ee.setHours(0,0,0,0);
    const sc = Math.max(0, Math.round((es-ws)/86400000));
    const ec = Math.min(6, Math.round((ee-ws)/86400000));
    if (sc > 6 || ec < 0) continue;

    let slot = -1;
    for (let s=0; s<MAX_SLOTS; s++) {
      let ok = true;
      for (let c=sc; c<=ec; c++) { if (grid[c][s]) { ok=false; break; } }
      if (ok) { slot=s; break; }
    }

    if (slot >= 0) {
      for (let c=sc; c<=ec; c++) grid[c][slot] = ev.id;
      placed.push({ ev, slot, sc, ec });
    } else {
      for (let c=sc; c<=ec; c++) overflow[c]++;
    }
  }
  return { placed, overflow };
}

function renderMonth() {
  const year = state.date.getFullYear(), month = state.date.getMonth();
  const ws   = weekStart(new Date(year, month, 1));
  let html   = '<div class="month-view">';

  html += '<div class="month-day-names">';
  DAYS.forEach((d,i) => html += `<div class="month-day-name${i>=5?' weekend':''}">${d}</div>`);
  html += '</div><div class="month-body">';

  let cur = new Date(ws);
  for (let w=0; w<6; w++) {
    const weekDays = Array.from({length:7}, (_,i) => addDays(cur, i));
    if (w===5 && !weekDays.some(d => d.getMonth()===month)) break;
    cur = addDays(cur, 7);

    const { placed, overflow } = assignSlots(weekDays, state.events);
    const maxSlot = placed.reduce((m,p) => Math.max(m,p.slot), -1);
    const hasOF   = overflow.some(c => c>0);
    const rowH    = Math.max(104, DAY_HDR_H + (maxSlot+1)*(SLOT_H+SLOT_GAP) + (hasOF?22:6));

    html += `<div class="week-row" style="min-height:${rowH}px">`;
    html += '<div class="day-cells">';
    weekDays.forEach((day,i) => {
      const today = sameDay(day, new Date());
      const inMon = day.getMonth() === month;
      const wkend = i >= 5;
      html += `<div class="day-cell${today?' today':''}${!inMon?' other-month':''}${wkend?' weekend':''}"
        data-date="${fmtDate(day)}" onclick="cal.openDay('${fmtDate(day)}')">
        <span class="day-num">${day.getDate()}</span>
      </div>`;
    });
    html += '</div>';

    html += '<div class="events-layer">';
    for (const { ev, slot, sc, ec } of placed) {
      const top   = DAY_HDR_H + slot * (SLOT_H + SLOT_GAP);
      const color = evColor(ev);
      for (let c = sc; c <= ec; c++) {
        const left  = c * CELL_W;
        const width = CELL_W - 0.4;
        html += `<div class="cal-event"
          style="left:${left}%;width:${width}%;top:${top}px;background:${color}22;border-left:3px solid ${color};color:${color};cursor:pointer"
          data-id="${ev.id}" onclick="event.stopPropagation();cal.openModal(${ev.id})">
          <span class="ev-dot" style="background:${color}"></span>
          <span>${esc(ev.titulo)}</span>
        </div>`;
      }
    }
    weekDays.forEach((day,i) => {
      if (overflow[i] > 0) {
        const left = i * CELL_W;
        const top  = DAY_HDR_H + MAX_SLOTS*(SLOT_H+SLOT_GAP);
        html += `<div class="ev-overflow" style="left:${left}%;top:${top}px"
          onclick="event.stopPropagation();cal.openDay('${fmtDate(day)}')">+${overflow[i]} más</div>`;
      }
    });
    html += '</div></div>';
  }
  html += '</div></div>';
  return html;
}

function renderMini() {
  const d     = state.miniDate;
  const year  = d.getFullYear(), month = d.getMonth();
  const eventDays = new Set(
    state.events
      .map(ev => {
        const dt = pd(ev.fecha_inicio);
        return fmtDate(dt).slice(0,7) === `${year}-${String(month+1).padStart(2,'0')}` ? dt.getDate() : null;
      })
      .filter(Boolean)
  );

  let html = `<div class="mini-cal-header">
    <button onclick="cal.miniPrev()"><i class="fa-solid fa-chevron-left"></i></button>
    <span>${MONTHS_SHORT[month]} ${year}</span>
    <button onclick="cal.miniNext()"><i class="fa-solid fa-chevron-right"></i></button>
  </div><div class="mini-cal-grid">`;
  DAYS.forEach(n => html += `<div class="mini-day-hdr">${n[0]}</div>`);

  const first = new Date(year, month, 1);
  const ws2   = weekStart(first);
  const today = new Date();
  for (let i=0; i<42; i++) {
    const day    = addDays(ws2, i);
    const inMon  = day.getMonth() === month;
    const td     = sameDay(day, today);
    const selDt  = sameDay(day, state.date);
    const hasEv  = inMon && eventDays.has(day.getDate());
    html += `<div class="mini-day${td?' today':''}${selDt&&!td?' selected':''}${!inMon?' other-month':''}${hasEv?' has-events':''}"
      onclick="cal.miniClick('${fmtDate(day)}')">${day.getDate()}</div>`;
    if (i>=34 && day.getMonth()!==month && addDays(ws2,i+1).getMonth()!==month) break;
  }
  html += '</div>';
  document.getElementById('mini-cal').innerHTML = html;
}

function updateDateLabel() {
  const d = state.date;
  document.getElementById('date-label').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function render() {
  updateDateLabel();
  renderMini();
  document.getElementById('cal-view').innerHTML = renderMonth();
}

async function refresh() {
  await fetchEvents();
  render();
}

async function openModal(id) {
  const ev = await fetchEventById(id);
  if (!ev) return;

  const color = evColor(ev);
  document.getElementById('modal-sede-badge').innerHTML =
    `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span> ${ev.sede_nombre||'Sin sede'}`;
  document.getElementById('modal-sede-badge').style.cssText =
    `background:${color}18;color:${color};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px`;
  document.getElementById('modal-titulo').textContent = ev.titulo;
  document.getElementById('modal-inicio').textContent = fmtDateTime(ev.fecha_inicio);
  document.getElementById('modal-fin').textContent    = fmtDateTime(ev.fecha_fin);
  document.getElementById('modal-desc').innerHTML     = ev.descripcion || '<em style="color:#9CA3AF">Sin descripción</em>';

  document.getElementById('event-modal').style.display = '';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('event-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function fmtTime(dt) {
  const d = pd(dt);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CO', { hour:'2-digit', minute:'2-digit' });
}

function eventsForDay(dateStr) {
  const day = new Date(dateStr + 'T00:00:00');
  const ds  = new Date(day); ds.setHours(0,0,0,0);
  const de  = new Date(day); de.setHours(23,59,59,999);
  return state.events
    .filter(ev => pd(ev.fecha_inicio) <= de && pd(ev.fecha_fin) >= ds)
    .sort((a,b) => pd(a.fecha_inicio) - pd(b.fecha_inicio));
}

function openDay(dateStr) {
  const day  = new Date(dateStr + 'T00:00:00');
  const list = eventsForDay(dateStr);

  document.getElementById('day-modal-title').textContent = day.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('day-modal-list').innerHTML = list.length
    ? list.map(ev => {
        const color = evColor(ev);
        return `<div class="agenda-event" onclick="cal.closeDayModal();cal.openModal(${ev.id})">
          <div class="ae-time">${fmtTime(ev.fecha_inicio)}</div>
          <div class="ae-bar" style="background:${color}"></div>
          <div class="ae-info">
            <div class="ae-title">${esc(ev.titulo)}</div>
            <div class="ae-sede">${esc(ev.sede_nombre || 'Sin sede')}</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="agenda-empty">Sin eventos este día</div>';

  document.getElementById('day-modal').style.display = '';
  document.body.style.overflow = 'hidden';
}

function closeDayModal() {
  document.getElementById('day-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function toggleSearch() {
  const el = document.getElementById('h-search');
  const open = el.classList.toggle('open');
  if (open) document.getElementById('search-input').focus();
}

function showLoader(v) { document.getElementById('loader').style.display = v ? 'flex' : 'none'; }

function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-container').prepend(el);
  setTimeout(() => el.remove(), 3000);
}

function navigate(delta) {
  const d = new Date(state.date);
  d.setMonth(d.getMonth() + delta);
  state.date     = d;
  state.miniDate = new Date(d);
  refresh();
}

function toggleSidebar() {
  const sb   = document.getElementById('sidebar');
  const ov   = document.getElementById('sidebar-overlay');
  const open = sb.classList.toggle('open');
  ov.classList.toggle('show', open);
}

window.cal = {
  setView() {},
  prev()    { navigate(-1); },
  next()    { navigate(+1); },
  goToday() {
    state.date     = new Date();
    state.miniDate = new Date();
    refresh();
  },
  dayClick() {},
  miniClick(dateStr) {
    state.date     = new Date(dateStr + 'T00:00:00');
    state.miniDate = new Date(state.date);
    render();
  },
  miniPrev() {
    state.miniDate.setMonth(state.miniDate.getMonth()-1);
    renderMini();
  },
  miniNext() {
    state.miniDate.setMonth(state.miniDate.getMonth()+1);
    renderMini();
  },
  openModal,
  closeModal,
  openDay,
  closeDayModal
};
window.closeModal = closeModal;
window.closeDayModal = closeDayModal;
window.toggleSearch = toggleSearch;

(async function init() {
  document.querySelectorAll('#sede-filters .sede-filter-item').forEach(el => {
    el.addEventListener('click', async () => {
      document.querySelectorAll('#sede-filters .sede-filter-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.sede = el.dataset.sede;
      await refresh();
    });
  });

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      state.search = e.target.value;
      await refresh();
    }, 350);
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft')  cal.prev();
    if (e.key === 'ArrowRight') cal.next();
    if (e.key === 'Escape')     { closeModal(); closeDayModal(); }
    if (e.key === 't' || e.key === 'T') cal.goToday();
  });

  await refresh();
})();
