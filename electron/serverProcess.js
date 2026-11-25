const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { app } = require('electron');
const logger = require('./logger');
const { getConfig } = require('../shared/configStore');

function getLocalIPs() {
  const result = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) result.push(iface.address);
    }
  }
  return result;
}

let child = null;
let startTime = null;
let boundPort = null;
let controlToken = null;
let externalManaged = false;
let externalCheckTimer = null;
const listeners = new Set();

function onStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitStatus() {
  const status = getStatus();
  for (const fn of listeners) fn(status);
}

function resolveNodeExe() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'runtime', 'node.exe');
  }
  const vendored = path.join(__dirname, '..', 'vendor', 'node-runtime', 'node.exe');
  if (fs.existsSync(vendored)) return vendored;
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function resolveAppServerDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'app-server');
  return path.join(__dirname, '..');
}

function isChildRunning() {
  return !!child && child.exitCode === null && !child.killed;
}

function checkHttpPort(port) {
  return new Promise(resolve => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/sedes',
      method: 'GET',
      timeout: 1200
    }, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function getStatus() {
  const running = isChildRunning() || externalManaged;
  return {
    running,
    port: boundPort,
    externalManaged,
    uptimeMs: running && startTime ? Date.now() - startTime : 0
  };
}

async function probeExternalServer() {
  const cfg = getConfig();
  const targetPort = Number(cfg.port || 8765);
  const ok = await checkHttpPort(targetPort);
  if (ok && !isChildRunning()) {
    if (!externalManaged) {
      externalManaged = true;
      boundPort = targetPort;
      if (!startTime) startTime = Date.now();
      emitStatus();
    }
  } else if (!ok && externalManaged && !isChildRunning()) {
    externalManaged = false;
    boundPort = null;
    startTime = null;
    emitStatus();
  }
}

function startExternalPolling() {
  if (externalCheckTimer) return;
  probeExternalServer();
  externalCheckTimer = setInterval(probeExternalServer, 3000);
}

async function start() {
  const cfg = getConfig();
  const targetPort = Number(cfg.port || 8765);

  const alreadyUp = await checkHttpPort(targetPort);
  if (alreadyUp) {
    externalManaged = true;
    boundPort = targetPort;
    if (!startTime) startTime = Date.now();
    emitStatus();
    return getStatus();
  }

  if (isChildRunning()) return getStatus();

  const nodeExe = resolveNodeExe();
  const appServerDir = resolveAppServerDir();
  const serverEntry = path.join(appServerDir, 'server.js');
  controlToken = crypto.randomBytes(16).toString('hex');

  logger.appendServerLine(`[iniciando] nodeExe=${nodeExe} entry=${serverEntry} cwd=${appServerDir}`);

  child = spawn(nodeExe, [serverEntry], {
    cwd: appServerDir,
    env: {
      ...process.env,
      PORT: String(targetPort),
      CONTROL_TOKEN: controlToken
    },
    windowsHide: true
  });

  externalManaged = false;
  startTime = Date.now();
  boundPort = targetPort;

  const handleOutput = (data, isError) => {
    const text = data.toString();
    for (const rawLine of text.split(/\r?\n/)) {
      const l = rawLine.trim();
      if (!l) continue;
      logger.appendServerLine((isError ? '[ERR] ' : '') + l);
      const match = l.match(/SERVER_READY port=(\d+)/);
      if (match) {
        boundPort = Number(match[1]);
        emitStatus();
      }
    }
  };

  child.stdout.on('data', d => handleOutput(d, false));
  child.stderr.on('data', d => handleOutput(d, true));

  child.on('error', (err) => {
    logger.appendServerLine(`[ERROR al iniciar el proceso] ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    logger.appendServerLine(`[proceso terminado] code=${code} signal=${signal}`);
    child = null;
    if (!externalManaged) {
      startTime = null;
      boundPort = null;
    }
    controlToken = null;
    emitStatus();
  });

  emitStatus();
  return getStatus();
}

function stop() {
  return new Promise(resolve => {
    if (externalManaged) {
      const cfg = getConfig();
      const targetPort = Number(cfg.port || 8765);
      const script = `Get-NetTCPConnection -LocalPort ${targetPort} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`;
      spawn('powershell', ['-NoProfile', '-Command', script], { windowsHide: true })
        .on('exit', () => {
          externalManaged = false;
          boundPort = null;
          startTime = null;
          emitStatus();
          resolve();
        });
      return;
    }

    if (!isChildRunning()) return resolve();
    const pid = child.pid;
    let escalateTimer = null;
    const onExit = () => {
      if (escalateTimer) clearTimeout(escalateTimer);
      resolve();
    };
    child.once('exit', onExit);
    child.kill();
    escalateTimer = setTimeout(() => {
      if (isChildRunning()) {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
      }
    }, 5000);
  });
}

async function restart() {
  await stop();
  await new Promise(r => setTimeout(r, 1200));
  return start();
}

startExternalPolling();

module.exports = {
  start,
  stop,
  restart,
  getStatus,
  onStatusChange,
  getControlToken: () => controlToken,
  getPort: () => boundPort,
  isRunning: () => isChildRunning() || externalManaged,
  resolveNodeExe,
  resolveAppServerDir,
  getLocalIPs
};
