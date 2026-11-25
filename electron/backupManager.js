const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const serverProcess = require('./serverProcess');
const logger = require('./logger');
const { getConfig } = require('../shared/configStore');

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureFolder(folder) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function resolveBackupFolder(customFolder) {
  const cfg = getConfig();
  return ensureFolder(customFolder || cfg.backupFolder);
}

function dbPath() {
  return path.join(serverProcess.resolveAppServerDir(), 'db', 'calendario.db');
}

function backupViaHttp(destPath) {
  return new Promise((resolve, reject) => {
    const port = serverProcess.getPort();
    const token = serverProcess.getControlToken();
    if (!port || !token) return reject(new Error('El servidor no esta listo todavia'));

    const body = JSON.stringify({ destPath });
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/control/backup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Control-Token': token
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) resolve(destPath);
          else reject(new Error(parsed.error || 'Error de backup'));
        } catch {
          reject(new Error(`Respuesta inesperada del servidor (status ${res.statusCode}). Verifique que la app este actualizada.`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function backupViaCli(destPath) {
  return new Promise((resolve, reject) => {
    const nodeExe = serverProcess.resolveNodeExe();
    const appServerDir = serverProcess.resolveAppServerDir();
    const cliScript = path.join(appServerDir, 'scripts', 'backup-cli.js');
    const child = spawn(nodeExe, [cliScript, '--db', dbPath(), '--out', destPath], { windowsHide: true });
    let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve(destPath);
      else reject(new Error(err || 'backup-cli fallo'));
    });
  });
}

async function backupToPath(destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (serverProcess.isRunning()) {
    await backupViaHttp(destPath);
  } else {
    await backupViaCli(destPath);
  }
  logger.appendServerLine('[backup] creado: ' + destPath);
  return destPath;
}

async function createBackup(customFolder) {
  const folder = resolveBackupFolder(customFolder);
  const destPath = path.join(folder, `calendario-${timestamp()}.db`);
  return backupToPath(destPath);
}

function listBackups(customFolder) {
  const folder = customFolder || getConfig().backupFolder;
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter(f => /^calendario-\d{8}-\d{6}\.db$/.test(f))
    .map(f => {
      const full = path.join(folder, f);
      const stat = fs.statSync(full);
      return { file: f, path: full, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

async function restoreBackup(backupPath) {
  if (!fs.existsSync(backupPath)) throw new Error('El archivo de backup no existe');
  await serverProcess.stop();
  const target = dbPath();
  const wal = target + '-wal';
  const shm = target + '-shm';
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
  fs.copyFileSync(backupPath, target);
  logger.appendServerLine('[backup] restaurado desde: ' + backupPath);
  return serverProcess.start();
}

function cleanupOldBackups() {
  const cfg = getConfig();
  const keep = cfg.backupSchedule && cfg.backupSchedule.keepCount;
  if (!keep) return;
  const backups = listBackups();
  const excess = backups.slice(keep);
  for (const b of excess) {
    try { fs.unlinkSync(b.path); } catch { /* ignore */ }
  }
}

let scheduleTimer = null;

function applySchedule() {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
  const cfg = getConfig();
  if (!cfg.backupSchedule || !cfg.backupSchedule.enabled) return;
  const intervalMs = Math.max(1, cfg.backupSchedule.intervalHours) * 60 * 60 * 1000;
  scheduleTimer = setInterval(async () => {
    try {
      await createBackup();
      cleanupOldBackups();
    } catch (e) {
      logger.appendServerLine('[backup automatico] error: ' + e.message);
    }
  }, intervalMs);
}

module.exports = { createBackup, backupToPath, listBackups, restoreBackup, cleanupOldBackups, applySchedule, timestamp };
