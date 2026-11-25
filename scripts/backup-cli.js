const Database = require('better-sqlite3');
const path = require('path');

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}

const dbPath = getArg('--db');
const outPath = getArg('--out');

if (!dbPath || !outPath) {
  console.error('Uso: node backup-cli.js --db <ruta.db> --out <destino.db>');
  process.exit(1);
}

if (path.extname(outPath).toLowerCase() !== '.db') {
  console.error('El destino debe terminar en .db');
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: true });
  const safe = outPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${safe}'`);
  db.close();
  console.log('BACKUP_OK');
} catch (err) {
  console.error('BACKUP_ERROR: ' + err.message);
  process.exit(1);
}
