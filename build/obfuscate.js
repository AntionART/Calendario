const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'dist-app', 'app-server');

const SERVER_TARGETS = [
  'server.js',
  'license.js',
  'database.js',
  'respaldoGithub.js',
  'routes/api.js',
  'routes/adminApi.js',
  'routes/controlApi.js',
  'shared/configStore.js',
  'scripts/backup-cli.js'
];

const BROWSER_TARGETS = [
  'public/js/calendar.js',
  'public/js/admin.js'
];

const BASE_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.6,
  renameGlobals: false,
  selfDefending: false,
  identifierNamesGenerator: 'hexadecimal'
};

function obfuscateFile(relPath, target) {
  const srcPath = path.join(ROOT, relPath);
  const destPath = path.join(STAGE, relPath);
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, { ...BASE_OPTIONS, target });
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, result.getObfuscatedCode(), 'utf8');
  console.log('Ofuscado:', relPath);
}

fs.rmSync(path.join(ROOT, 'dist-app'), { recursive: true, force: true });

for (const target of SERVER_TARGETS) obfuscateFile(target, 'node');
for (const target of BROWSER_TARGETS) obfuscateFile(target, 'browser');

console.log(`Ofuscacion completa: ${SERVER_TARGETS.length + BROWSER_TARGETS.length} archivos.`);
