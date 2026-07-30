const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const requireAuth = (req, res, next) => {
  if (req.session && req.session.adminAuth) return next();
  res.status(401).json({ success: false, error: 'No autorizado' });
};

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename:    (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no permitido'));
  }
});

router.get('/check-auth', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.adminAuth) });
});

router.post('/login', (req, res) => {
  try {
    const { password } = req.body;
    const row = db.prepare("SELECT valor FROM configuracion WHERE clave = 'password_hash'").get();
    if (!row || !bcrypt.compareSync(password, row.valor))
      return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
    req.session.adminAuth = true;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/eventos', requireAuth, (req, res) => {
  try {
    const { buscar, sede } = req.query;
    let q = `
      SELECT e.*, s.nombre AS sede_nombre, s.color AS sede_color
      FROM eventos e LEFT JOIN sedes s ON e.sede_id = s.id WHERE 1=1
    `;
    const p = [];
    if (buscar) { q += ' AND (e.titulo LIKE ? OR e.descripcion LIKE ?)'; p.push(`%${buscar}%`, `%${buscar}%`); }
    if (sede && sede !== '0') { q += ' AND e.sede_id = ?'; p.push(Number(sede)); }
    q += ' ORDER BY e.fecha_inicio DESC';
    const eventos = db.prepare(q).all(...p);
    const adjQ = db.prepare('SELECT * FROM adjuntos WHERE evento_id = ?');
    for (const ev of eventos) ev.adjuntos = adjQ.all(ev.id);
    res.json({ success: true, data: eventos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/eventos/:id', requireAuth, (req, res) => {
  try {
    const ev = db.prepare(`
      SELECT e.*, s.nombre AS sede_nombre
      FROM eventos e LEFT JOIN sedes s ON e.sede_id = s.id WHERE e.id = ?
    `).get(req.params.id);
    if (!ev) return res.status(404).json({ success: false, error: 'No encontrado' });
    ev.adjuntos = db.prepare('SELECT * FROM adjuntos WHERE evento_id = ?').all(ev.id);
    res.json({ success: true, data: ev });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/eventos', requireAuth, upload.array('adjuntos', 10), (req, res) => {
  try {
    const { titulo, fecha_inicio, fecha_fin, sede_id, descripcion, color } = req.body;
    if (!titulo || !fecha_inicio || !fecha_fin)
      return res.status(400).json({ success: false, error: 'Título y fechas son requeridos' });

    const result = db.prepare(`
      INSERT INTO eventos (titulo, fecha_inicio, fecha_fin, sede_id, descripcion, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(titulo.trim(), fecha_inicio, fecha_fin, sede_id ? Number(sede_id) : null, descripcion || '', color || '#F97316');

    const eventoId = result.lastInsertRowid;
    if (req.files && req.files.length > 0) saveAdjuntos(eventoId, req.files);

    res.json({ success: true, id: eventoId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/eventos/:id', requireAuth, upload.array('adjuntos', 10), (req, res) => {
  try {
    const { titulo, fecha_inicio, fecha_fin, sede_id, descripcion, color } = req.body;
    db.prepare(`
      UPDATE eventos SET titulo=?, fecha_inicio=?, fecha_fin=?, sede_id=?,
      descripcion=?, color=?, actualizado_en=datetime('now','localtime') WHERE id=?
    `).run(titulo.trim(), fecha_inicio, fecha_fin, sede_id ? Number(sede_id) : null,
           descripcion || '', color || '#F97316', req.params.id);

    if (req.files && req.files.length > 0) saveAdjuntos(Number(req.params.id), req.files);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/eventos/:id', requireAuth, (req, res) => {
  try {
    const adjs = db.prepare('SELECT nombre_archivo FROM adjuntos WHERE evento_id = ?').all(req.params.id);
    for (const a of adjs) deleteFile(a.nombre_archivo);
    db.prepare('DELETE FROM adjuntos WHERE evento_id = ?').run(req.params.id);
    db.prepare('DELETE FROM eventos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/eventos/:id/duplicar', requireAuth, (req, res) => {
  try {
    const ev = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
    if (!ev) return res.status(404).json({ success: false, error: 'No encontrado' });
    const result = db.prepare(`
      INSERT INTO eventos (titulo, fecha_inicio, fecha_fin, sede_id, descripcion, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`${ev.titulo} (Copia)`, ev.fecha_inicio, ev.fecha_fin, ev.sede_id, ev.descripcion, ev.color);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/adjuntos/:id', requireAuth, (req, res) => {
  try {
    const adj = db.prepare('SELECT * FROM adjuntos WHERE id = ?').get(req.params.id);
    if (!adj) return res.status(404).json({ success: false, error: 'No encontrado' });
    deleteFile(adj.nombre_archivo);
    db.prepare('DELETE FROM adjuntos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/config', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT clave, valor FROM configuracion').all();
    const cfg = {};
    for (const r of rows) { if (r.clave !== 'password_hash') cfg[r.clave] = r.valor; }
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/config', requireAuth, (req, res) => {
  try {
    const { empresa_nombre, color_primario, color_secundario, nueva_password } = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
    if (empresa_nombre)   upsert.run('empresa_nombre',   empresa_nombre);
    if (color_primario)   upsert.run('color_primario',   color_primario);
    if (color_secundario) upsert.run('color_secundario', color_secundario);
    if (nueva_password && nueva_password.trim().length >= 6)
      upsert.run('password_hash', bcrypt.hashSync(nueva_password.trim(), 12));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/config/logo', requireAuth, upload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Sin archivo' });
    const dest = path.join(__dirname, '..', 'public', 'Logos.png');
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function saveAdjuntos(eventoId, files) {
  const ins = db.prepare(`
    INSERT INTO adjuntos (evento_id, nombre_original, nombre_archivo, tamano, tipo)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const f of files) ins.run(eventoId, f.originalname, f.filename, f.size, f.mimetype);
}

function deleteFile(filename) {
  const fp = path.join(__dirname, '..', 'uploads', filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

module.exports = router;
