const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'dist-app', 'app-server');
const VERIFY_TMP = path.join(ROOT, 'dist-app', '.verify-tmp');
const TEST_PORT = 18765;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      return await get(url);
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('El servidor de staging no respondio a tiempo.');
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

function rmDirWithRetries(dir, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
    }
  }
  return !fs.existsSync(dir);
}

async function main() {
  if (!fs.existsSync(path.join(STAGE, 'server.js'))) {
    console.error('No se encontro server.js en dist-app/app-server. Ejecute "npm run obfuscate" y "npm run stage" primero.');
    process.exit(1);
  }

  fs.rmSync(VERIFY_TMP, { recursive: true, force: true });
  fs.cpSync(STAGE, VERIFY_TMP, { recursive: true });

  const child = spawn(process.execPath, [path.join(VERIFY_TMP, 'server.js')], {
    cwd: VERIFY_TMP,
    env: { ...process.env, PORT: String(TEST_PORT) },
    windowsHide: true
  });

  child.stderr.on('data', d => console.error('[stage-server]', d.toString().trim()));

  let failed = false;
  try {
    const sedes = await waitForServer(`http://127.0.0.1:${TEST_PORT}/api/sedes`);
    const gestion = await waitForServer(`http://127.0.0.1:${TEST_PORT}/gestion`);

    if (sedes.status !== 200) throw new Error(`/api/sedes devolvio ${sedes.status}, se esperaba 200`);
    if (gestion.status !== 200) throw new Error(`/gestion devolvio ${gestion.status}, se esperaba 200`);
    console.log('Verificacion OK: /api/sedes y /gestion responden 200 sobre el codigo ofuscado.');
  } catch (err) {
    failed = true;
    console.error('VERIFICACION FALLIDA:', err.message);
  } finally {
    child.kill();
    await waitForExit(child);
    const cleaned = rmDirWithRetries(VERIFY_TMP);
    if (!cleaned) {
      console.warn(`Aviso: no se pudo borrar completamente ${VERIFY_TMP} (no afecta el paquete final, solo queda basura temporal).`);
    }
  }

  for (const forbidden of ['db', 'uploads']) {
    const p = path.join(STAGE, forbidden);
    if (fs.existsSync(p)) {
      failed = true;
      console.error(`VERIFICACION FALLIDA: "${forbidden}" existe dentro de dist-app/app-server y no deberia empaquetarse. Borrelo y vuelva a correr "npm run stage".`);
    }
  }

  if (failed) process.exit(1);
}

main();
