const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST_DIR = path.join(ROOT, 'vendor', 'node-runtime');
const DEST = path.join(DEST_DIR, 'node.exe');

const CANDIDATES = [
  process.execPath,
  'C:\\Program Files\\nodejs\\node.exe'
];

function findNode() {
  for (const c of CANDIDATES) {
    if (c && fs.existsSync(c) && path.basename(c).toLowerCase() === 'node.exe') return c;
  }
  throw new Error('No se encontro node.exe en este equipo. Ajuste build/fetch-node-runtime.js con la ruta correcta.');
}

const src = findNode();
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(src, DEST);
console.log(`node.exe (runtime portatil) copiado desde ${src} -> ${DEST}`);
console.log('Este runtime debe coincidir en version con el usado para compilar better-sqlite3 (actualmente Node v24.x, ABI 137).');
