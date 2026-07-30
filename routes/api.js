const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/eventos', (req, res) => {
  try {
    const { sede, buscar, fecha_inicio, fecha_fin } = req.query;
    let q = `
      SELECT e.id, e.titulo, e.fecha_inicio, e.fecha_fin, e.sede_id,
             e.descripcion, e.color, e.creado_en, s.nombre AS sede_nombre, s.color AS sede_color
      FROM eventos e
      LEFT JOIN sedes s ON e.sede_id = s.id
      WHERE 1=1
    `;
    const p = [];

    if (sede && sede !== '0') {
      q += ' AND (e.sede_id = ? OR e.sede_id = 4)';
      p.push(Number(sede));
    }
    if (buscar) {
      q += ' AND (e.titulo LIKE ? OR e.descripcion LIKE ? OR s.nombre LIKE ?)';
      p.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (fecha_inicio) { q += ' AND e.fecha_fin >= ?';    p.push(fecha_inicio); }
    if (fecha_fin)    { q += ' AND e.fecha_inicio <= ?'; p.push(fecha_fin); }

    q += ' ORDER BY e.fecha_inicio ASC';
    const eventos = db.prepare(q).all(...p);

    const adjQ = db.prepare('SELECT id, nombre_original, nombre_archivo, tamano, tipo FROM adjuntos WHERE evento_id = ?');
    for (const ev of eventos) ev.adjuntos = adjQ.all(ev.id);

    res.json({ success: true, data: eventos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/eventos/:id', (req, res) => {
  try {
    const ev = db.prepare(`
      SELECT e.*, s.nombre AS sede_nombre, s.color AS sede_color
      FROM eventos e LEFT JOIN sedes s ON e.sede_id = s.id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!ev) return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    ev.adjuntos = db.prepare('SELECT * FROM adjuntos WHERE evento_id = ?').all(ev.id);
    res.json({ success: true, data: ev });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sedes', (req, res) => {
  try {
    res.json({ success: true, data: db.prepare('SELECT * FROM sedes WHERE activo = 1').all() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/config', (req, res) => {
  try {
    const rows = db.prepare("SELECT clave, valor FROM configuracion WHERE clave IN ('empresa_nombre','color_primario','color_secundario')").all();
    const cfg = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
