const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const db = require('./database');
const { CONFIG_DIR } = require('./shared/configStore');

const HORA_SUBIDA = 1;
const MAX_ARCHIVO = 95 * 1024 * 1024;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const TABLAS = ['sedes', 'eventos', 'adjuntos', 'configuracion'];

const APP_ROOT = __dirname;
const repoLocal = () => process.env.RESPALDO_GITHUB_REPO_LOCAL || path.join(CONFIG_DIR, 'respaldo-github');
const preparado = () => fs.existsSync(path.join(repoLocal(), '.git'));
const apagado = () => process.env.RESPALDO_GITHUB === 'off';
const activo = () => !apagado() && preparado();

let enCurso = false;
let ultimo = null;

function git(...args) {
  return new Promise((ok, mal) => execFile('git', args, {
    cwd: repoLocal(), windowsHide: true, maxBuffer: 64 << 20, timeout: 30 * 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  }, (e, salida, err) => e ? mal(new Error((err || e.message).trim().split('\n').pop())) : ok(salida.trim())));
}

async function listarArchivos(dir, base = dir, out = []) {
  let entradas;
  try { entradas = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await listarArchivos(p, base, out);
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

async function copiar(origen, destino) {
  const st = await fsp.stat(origen);
  if (st.size > MAX_ARCHIVO) {
    console.warn(`[GitHub] No se sube ${origen}: pesa ${(st.size / 1048576).toFixed(0)} MB y GitHub admite hasta 100 MB por archivo.`);
    return false;
  }
  await fsp.mkdir(path.dirname(destino), { recursive: true });
  await fsp.copyFile(origen, destino);
  return true;
}

async function iguales(a, b) {
  try {
    const [x, y] = await Promise.all([fsp.stat(a), fsp.stat(b)]);
    if (x.size !== y.size) return false;
    return (await fsp.readFile(a)).equals(await fsp.readFile(b));
  } catch { return false; }
}

const dos = n => String(n).padStart(2, '0');
const fechaLocal = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

function semanaIso(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - inicio) / 86400000 + 1) / 7);
}

function carpetaDia(d) {
  return `${d.getFullYear()}/${dos(d.getMonth() + 1)}-${MESES[d.getMonth()]}/semana-${dos(semanaIso(d))}/${fechaLocal(d)}-${DIAS[d.getDay()]}`;
}

async function hijos(d) {
  try { return (await fsp.readdir(d, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; }
}

async function diasEnRepo() {
  const repo = repoLocal(), dias = new Map();
  for (const anio of (await hijos(repo)).filter(n => /^\d{4}$/.test(n))) {
    for (const mes of await hijos(path.join(repo, anio))) {
      for (const semana of (await hijos(path.join(repo, anio, mes))).filter(n => n.startsWith('semana-'))) {
        for (const dia of await hijos(path.join(repo, anio, mes, semana))) {
          const f = /^(\d{4}-\d{2}-\d{2})/.exec(dia);
          if (f && fs.existsSync(path.join(repo, anio, mes, semana, dia, 'MANIFIESTO.json'))) dias.set(f[1], `${anio}/${mes}/${semana}/${dia}`);
        }
      }
    }
  }
  return dias;
}

async function enviarRezagados() {
  await git('fetch', '-q', 'origin', 'main').catch(() => {});
  const n = parseInt(await git('rev-list', '--count', 'origin/main..HEAD').catch(() => '0'), 10) || 0;
  if (n) {
    await git('push', '-q', 'origin', 'main');
    console.log(`[GitHub] Enviados ${n} commit(s) que habian quedado sin subir.`);
  }
}

const LEEME = `CALENDARIO NEUROCOOP - Respaldo del dia

base-datos/calendario.db   Base de datos completa (SQLite), copia consistente hecha con VACUUM INTO.
MANIFIESTO.json            Fecha, tamano, huella SHA-256 y filas por tabla.
../../../../archivos/      Adjuntos de eventos y logo tal como estaban en el commit "Respaldo AAAA-MM-DD".

Para restaurar:
1. Cerrar el Calendario NEUROCOOP (bandeja > Salir).
2. Copiar base-datos/calendario.db a resources/app-server/db/calendario.db de la instalacion,
   borrando antes calendario.db-wal y calendario.db-shm si existen.
3. Copiar archivos/uploads/* a resources/app-server/uploads/ y archivos/Logos.png a resources/app-server/public/.
4. Abrir de nuevo el Calendario.
`;

async function subirHoy(ahora = new Date()) {
  const repo = repoLocal();
  const fecha = fechaLocal(ahora);
  const rel = carpetaDia(ahora);
  const carpeta = path.join(repo, ...rel.split('/'));
  const destinoDb = path.join(carpeta, 'base-datos', 'calendario.db');

  await fsp.mkdir(path.dirname(destinoDb), { recursive: true });
  await fsp.rm(destinoDb, { force: true });
  db.exec(`VACUUM INTO '${destinoDb.replace(/'/g, "''")}'`);
  const bytesDb = (await fsp.stat(destinoDb)).size;
  const sha256 = crypto.createHash('sha256').update(await fsp.readFile(destinoDb)).digest('hex');
  const filas = {};
  for (const t of TABLAS) filas[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;

  const origenes = [{ dir: path.join(APP_ROOT, 'uploads'), prefijo: 'uploads/' }];
  const delDia = new Map();
  for (const o of origenes) for (const f of await listarArchivos(o.dir)) delDia.set(o.prefijo + f, path.join(o.dir, ...f.split('/')));
  const logo = path.join(APP_ROOT, 'public', 'Logos.png');
  if (fs.existsSync(logo)) delDia.set('Logos.png', logo);

  const repoArch = path.join(repo, 'archivos');
  const omitidos = [];
  let nuevos = 0, cambiados = 0, quitados = 0;
  for (const [rf, origen] of delDia) {
    const b = path.join(repoArch, ...rf.split('/'));
    if (!fs.existsSync(b)) { if (await copiar(origen, b)) nuevos++; else omitidos.push(rf); }
    else if (!(await iguales(origen, b))) { if (await copiar(origen, b)) cambiados++; else omitidos.push(rf); }
    await new Promise(setImmediate);
  }
  for (const f of await listarArchivos(repoArch)) {
    if (!delDia.has(f)) { await fsp.unlink(path.join(repoArch, ...f.split('/'))); quitados++; }
  }

  const manifiesto = {
    fecha, generadoEn: ahora.toISOString(),
    base: { archivo: 'base-datos/calendario.db', bytes: bytesDb, sha256 },
    filas, archivos: delDia.size, omitidos
  };
  await fsp.writeFile(path.join(carpeta, 'MANIFIESTO.json'), JSON.stringify(manifiesto, null, 2), 'utf8');
  await fsp.writeFile(path.join(carpeta, 'LEEME.txt'), LEEME, 'utf8');
  await fsp.writeFile(path.join(carpeta, 'RESUMEN.txt'),
    `Respaldo del ${fecha}\nBase de datos: calendario.db ${(bytesDb / 1024).toFixed(0)} KB\n` +
    `Eventos: ${filas.eventos} - Adjuntos: ${filas.adjuntos}\n` +
    `Archivos: ${delDia.size} (${nuevos} nuevos, ${cambiados} cambiados, ${quitados} quitados)\n` +
    `Subido: ${ahora.toLocaleString('es-CO')}\n` +
    (omitidos.length ? `NO SUBIDOS (mas de 100 MB, limite de GitHub): ${omitidos.join(', ')}\n` : ''), 'utf8');

  await git('add', '-A');
  await git('commit', '-q', '-m', `Respaldo ${fecha}`);
  await git('push', '-q', 'origin', 'main');
  return { fecha, eventos: filas.eventos, archivos: delDia.size, nuevos, cambiados, quitados, omitidos, kbBase: Math.round(bytesDb / 1024) };
}

async function subirPendientes(motivo = 'automatico') {
  if (!activo()) return { ok: false, motivo: apagado() ? 'apagado' : `No esta preparado el clon del repositorio en ${repoLocal()}.` };
  if (enCurso) return { ok: false, motivo: 'Ya hay una subida en curso.' };
  enCurso = true;
  const subidos = [];
  try {
    await enviarRezagados();
    await git('pull', '-q', '--ff-only', 'origin', 'main').catch(() => {});
    const dias = await diasEnRepo();
    if (!dias.has(fechaLocal(new Date()))) {
      const x = await subirHoy();
      subidos.push(x);
      console.log(`[GitHub] Respaldo ${x.fecha} subido: base ${x.kbBase} KB, ${x.eventos} eventos, ${x.archivos} archivos (${x.nuevos} nuevos, ${x.cambiados} cambiados).`);
    }
    ultimo = { ts: Date.now(), ok: true, error: null, motivo, subidos };
    return { ok: true, subidos };
  } catch (e) {
    console.error('[GitHub] No se pudo subir el respaldo:', e.message);
    ultimo = { ts: Date.now(), ok: false, error: e.message, motivo, subidos };
    return { ok: false, motivo: e.message, subidos };
  } finally { enCurso = false; }
}

function iniciar() {
  if (apagado()) return;
  if (!preparado()) { console.warn(`[GitHub] Copia en GitHub apagada: no hay clon del repositorio en ${repoLocal()}.`); return; }
  const ciclo = () => {
    if (new Date().getHours() < HORA_SUBIDA || enCurso) return;
    if (ultimo && !ultimo.ok && Date.now() - ultimo.ts < 3600000) return;
    if (ultimo && ultimo.ok && Date.now() - ultimo.ts < 10 * 60000) return;
    subirPendientes().catch(e => console.error('[GitHub]', e.message));
  };
  setTimeout(ciclo, 5 * 60000);
  setInterval(ciclo, 10 * 60000);
  console.log(`[GitHub] Copia en GitHub desde la 1:00 a. m. (clon en ${repoLocal()}).`);
}

function esRedInterna(ip) {
  const v = String(ip || '').replace(/^::ffff:/, '');
  return v === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v);
}

async function estado(req, res) {
  let remoto = null, dias = [], pendiente = false;
  if (preparado()) {
    remoto = (await git('remote', 'get-url', 'origin').catch(() => '')).replace(/\/\/[^@/]+@/, '//').replace(/\.git$/, '');
    const r = await diasEnRepo();
    for (const [fecha, rel] of [...r].sort().reverse()) {
      let t = '';
      try { t = await fsp.readFile(path.join(repoLocal(), ...rel.split('/'), 'RESUMEN.txt'), 'utf8'); } catch {}
      dias.push({
        fecha,
        eventos: +((/Eventos: (\d+)/.exec(t) || [])[1] || 0),
        archivos: +((/Archivos: (\d+)/.exec(t) || [])[1] || 0),
        subido: (/Subido: (.+)/.exec(t) || [])[1] || '',
        noSubidos: (/NO SUBIDOS[^:]*: (.+)/.exec(t) || [])[1] || ''
      });
    }
    pendiente = !r.has(fechaLocal(new Date())) && new Date().getHours() >= HORA_SUBIDA;
    pendiente = pendiente || (parseInt(await git('rev-list', '--count', 'origin/main..HEAD').catch(() => '0'), 10) || 0) > 0;
  }
  res.json({ success: true, data: { activo: activo(), preparado: preparado(), apagado: apagado(), enCurso, remoto, repoLocal: repoLocal(), horaSubida: HORA_SUBIDA, ultimo, pendiente, dias } });
}

async function subir(req, res) {
  if (!activo()) return res.status(409).json({ success: false, error: 'La copia en GitHub esta apagada o el repositorio no esta preparado.' });
  if (enCurso) return res.status(409).json({ success: false, error: 'Ya hay una subida en curso; espere a que termine.' });
  const r = await subirPendientes('manual');
  if (!r.ok) return res.status(500).json({ success: false, error: 'No se pudo subir: ' + r.motivo });
  res.json({ success: true, data: { subidos: r.subidos } });
}

async function descargar(req, res) {
  if (!esRedInterna(req.ip)) return res.status(403).json({ success: false, error: 'Los respaldos solo se descargan desde la red interna.' });
  if (!preparado()) return res.status(409).json({ success: false, error: 'El repositorio de respaldos no esta preparado.' });
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || '') ? req.query.fecha : null;
  const rel = fecha && (await diasEnRepo()).get(fecha);
  if (!rel) return res.status(404).json({ success: false, error: 'Ese respaldo no esta en GitHub.' });
  const commit = await git('log', '-1', '--format=%H', '--fixed-strings', `--grep=Respaldo ${fecha}`).catch(() => '');
  if (!commit) return res.status(404).json({ success: false, error: 'No se encontro la subida de ese dia en el historial.' });
  const rutas = [rel];
  if (await git('cat-file', '-e', `${commit}:archivos`).then(() => true, () => false)) rutas.push('archivos');
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="Calendario-respaldo-${fecha}.zip"`,
    'Cache-Control': 'no-store'
  });
  const p = spawn('git', ['archive', '--format=zip', commit, ...rutas], { cwd: repoLocal(), windowsHide: true });
  p.stdout.pipe(res);
  p.stderr.on('data', d => console.error('[GitHub] git archive:', String(d).trim()));
  req.on('close', () => { if (p.exitCode === null) p.kill(); });
}

module.exports = { iniciar, subirPendientes, estado, subir, descargar, activo };
