const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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

function isRunning() {
  return !!child && child.exitCode === null && !child.killed;
}

function getStatus() {
  return {
    running: isRunning(),
    port: boundPort,
    uptimeMs: isRunning() && startTime ? Date.now() - startTime : 0
  };
}

function start() {
  if (isRunning()) return getStatus();

  const nodeExe = resolveNodeExe();
  const appServerDir = resolveAppServerDir();
  const serverEntry = path.join(appServerDir, 'server.js');
  const cfg = getConfig();
  controlToken = crypto.randomBytes(16).toString('hex');

  logger.appendServerLine(`[iniciando] nodeExe=${nodeExe} entry=${serverEntry} cwd=${appServerDir} existeNodeExe=${fs.existsSync(nodeExe)} existeEntry=${fs.existsSync(serverEntry)}`);

  child = spawn(nodeExe, [serverEntry], {
    cwd: appServerDir,
    env: {
      ...process.env,
      PORT: String(cfg.port || 8765),
      CONTROL_TOKEN: controlToken
    },
    windowsHide: true
  });

  startTime = Date.now();
  boundPort = null;

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
    logger.appendServerLine(`[ERROR al iniciar el proceso] ${err.message} (nodeExe=${nodeExe}, entry=${serverEntry})`);
  });

  child.on('exit', (code, signal) => {
    logger.appendServerLine(`[proceso terminado] code=${code} signal=${signal}`);
    child = null;
    startTime = null;
    boundPort = null;
    controlToken = null;
    emitStatus();
  });

  emitStatus();
  return getStatus();
}

function stop() {
  return new Promise(resolve => {
    if (!isRunning()) return resolve();
    const pid = child.pid;
    let escalateTimer = null;
    const onExit = () => {
      if (escalateTimer) clearTimeout(escalateTimer);
      resolve();
    };
    child.once('exit', onExit);
    child.kill();
    escalateTimer = setTimeout(() => {
      if (isRunning()) {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
      }
    }, 5000);
  });
}

async function restart() {
  await stop();
  return start();
}

function getControlToken() { return controlToken; }
function getPort() { return boundPort; }

module.exports = {
  start,
  stop,
  restart,
  getStatus,
  onStatusChange,
  getControlToken,
  getPort,
  isRunning,
  resolveNodeExe,
  resolveAppServerDir,
  getLocalIPs
};
