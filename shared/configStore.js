const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), 'AppData', 'Local', 'CalendarioNeurocoop');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  sessionSecret: null,
  port: 8765,
  backupFolder: path.join(CONFIG_DIR, 'backups'),
  backupSchedule: { enabled: false, intervalHours: 24, keepCount: 14 },
  tunnel: { enabled: false },
  autoLaunch: false
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(cfg) {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function getOrCreateSessionSecret() {
  const cfg = readConfig();
  if (cfg.sessionSecret) return cfg.sessionSecret;
  cfg.sessionSecret = crypto.randomBytes(32).toString('hex');
  writeConfig(cfg);
  return cfg.sessionSecret;
}

function getConfig() {
  return readConfig();
}

function updateConfig(patch) {
  const cfg = { ...readConfig(), ...patch };
  writeConfig(cfg);
  return cfg;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_PATH,
  getOrCreateSessionSecret,
  getConfig,
  updateConfig
};
