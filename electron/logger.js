const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const os = require('os');

const LOG_PATH = path.join(os.homedir(), 'AppData', 'Local', 'CalendarioNeurocoop', 'logs', 'server.log');

log.transports.file.resolvePathFn = () => LOG_PATH;
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] {text}';
log.transports.console.level = false;

function appendServerLine(line) {
  log.info(line);
}

function getLastLines(n = 200) {
  try {
    const content = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

module.exports = { appendServerLine, getLastLines, logPath: LOG_PATH };
