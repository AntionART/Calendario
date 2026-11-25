const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');

let child = null;

function findNgrokExe() {
  const candidates = [
    path.join('C:', 'ngrok', 'ngrok.exe'),
    path.join(os.homedir(), 'ngrok', 'ngrok.exe')
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function isRunning() {
  return !!child && child.exitCode === null;
}

function friendlyError(output) {
  if (/already online|ERR_NGROK_334/i.test(output)) {
    return 'Ya hay otra ventana/proceso de ngrok usando este tunel. Cierrela primero y volve a intentar.';
  }
  if (/ERR_NGROK_/i.test(output)) {
    const match = output.match(/ERR_NGROK_\d+/i);
    return `ngrok devolvio un error (${match ? match[0] : 'desconocido'}). Revise Logs para el detalle completo.`;
  }
  return null;
}

function start(configName = 'calendario') {
  return new Promise((resolve, reject) => {
    if (isRunning()) return resolve(getStatus());
    const exe = findNgrokExe();
    if (!exe) return reject(new Error('No se encontro ngrok.exe (se esperaba en C:\\ngrok\\ngrok.exe)'));

    child = spawn(exe, ['start', configName], { windowsHide: true });
    let output = '';

    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    child.on('error', err => {
      logger.appendServerLine('[tunel] error al iniciar ngrok: ' + err.message);
      child = null;
      reject(err);
    });

    const settleTimer = setTimeout(() => {
      // Sigue vivo pasado el margen de arranque: lo damos por exitoso.
      resolve({ running: true, url: null });
    }, 3000);

    child.on('exit', (code) => {
      clearTimeout(settleTimer);
      if (child) {
        logger.appendServerLine(`[tunel] ngrok termino inesperadamente (code=${code}): ${output.trim()}`);
      }
      child = null;
      const msg = friendlyError(output) || `ngrok se cerro inesperadamente (code=${code}).`;
      reject(new Error(msg));
    });
  });
}

function stop() {
  if (child) {
    child.kill();
    child = null;
  }
}

function fetchPublicUrl() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:4040/api/tunnels', res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const t = (parsed.tunnels || []).find(x => x.public_url && x.public_url.startsWith('https'));
          resolve(t ? t.public_url : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
  });
}

async function getStatus() {
  const running = isRunning();
  const url = running ? await fetchPublicUrl() : null;
  return { running, url };
}

module.exports = { start, stop, getStatus, findNgrokExe };
