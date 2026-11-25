const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

const CONTROL_TOKEN = process.env.CONTROL_TOKEN || null;

function requireControlToken(req, res, next) {
  const isLoopback = req.socket.remoteAddress === '127.0.0.1' ||
                      req.socket.remoteAddress === '::1' ||
                      req.socket.remoteAddress === '::ffff:127.0.0.1';
  if (!isLoopback) return res.status(403).json({ success: false, error: 'Solo local' });
  if (!CONTROL_TOKEN || req.get('X-Control-Token') !== CONTROL_TOKEN) {
    return res.status(401).json({ success: false, error: 'Token invalido' });
  }
  next();
}

router.post('/backup', requireControlToken, (req, res) => {
  try {
    const { destPath } = req.body;
    if (!destPath || typeof destPath !== 'string') {
      return res.status(400).json({ success: false, error: 'destPath requerido' });
    }
    if (path.extname(destPath).toLowerCase() !== '.db') {
      return res.status(400).json({ success: false, error: 'destPath debe terminar en .db' });
    }
    const safe = destPath.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${safe}'`);
    res.json({ success: true, path: destPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
