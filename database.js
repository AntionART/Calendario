const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'calendario.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sedes (
    id   INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    color  TEXT DEFAULT '#F97316',
    activo INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS eventos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo       TEXT    NOT NULL,
    fecha_inicio TEXT    NOT NULL,
    fecha_fin    TEXT    NOT NULL,
    sede_id      INTEGER,
    descripcion  TEXT    DEFAULT '',
    color        TEXT    DEFAULT '#F97316',
    creado_en    TEXT    DEFAULT (datetime('now','localtime')),
    actualizado_en TEXT,
    FOREIGN KEY (sede_id) REFERENCES sedes(id)
  );

  CREATE TABLE IF NOT EXISTS adjuntos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id       INTEGER NOT NULL,
    nombre_original TEXT    NOT NULL,
    nombre_archivo  TEXT    NOT NULL,
    tamano          INTEGER DEFAULT 0,
    tipo            TEXT    DEFAULT '',
    subido_en       TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_eventos_fechas ON eventos(fecha_inicio, fecha_fin);
  CREATE INDEX IF NOT EXISTS idx_eventos_sede   ON eventos(sede_id);
  CREATE INDEX IF NOT EXISTS idx_adjuntos_evento ON adjuntos(evento_id);
`);

const sedesCount = db.prepare('SELECT COUNT(*) as c FROM sedes').get();
if (sedesCount.c === 0) {
  const ins = db.prepare('INSERT INTO sedes (id, nombre, color) VALUES (?, ?, ?)');
  ins.run(1, 'Cúcuta',         '#1D6FA4');
  ins.run(2, 'Pamplona',       '#0D9276');
  ins.run(3, 'Ocaña',          '#7C3AED');
  ins.run(4, 'Todas las sedes','#F97316');
}

const cfgCount = db.prepare('SELECT COUNT(*) as c FROM configuracion').get();
if (cfgCount.c === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
  ins.run('password_hash',   bcrypt.hashSync('neurocoop2024', 12));
  ins.run('empresa_nombre',  'NEUROCOOP');
  ins.run('color_primario',  '#F97316');
  ins.run('color_secundario','#EA580C');
}

module.exports = db;
