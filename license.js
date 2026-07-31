const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONTACT_INFO = 'Contacte al desarrollador para renovar la licencia.';

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAFaUlh6PDhn/a/387B8heJzBKcI7fjpRbUYjgWr2uQYU=
-----END PUBLIC KEY-----`;

const LICENSE_PATH = path.join(__dirname, 'license.lic');

function checkLicense() {
  let raw;
  try {
    raw = fs.readFileSync(LICENSE_PATH, 'utf8');
  } catch {
    return { valid: false, reason: 'Archivo de licencia no encontrado.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, reason: 'Archivo de licencia corrupto.' };
  }

  const { payload, signature } = parsed;
  if (!payload || !signature) {
    return { valid: false, reason: 'Archivo de licencia con formato inválido.' };
  }

  const payloadStr = JSON.stringify(payload);
  let verified;
  try {
    verified = crypto.verify(null, Buffer.from(payloadStr), PUBLIC_KEY_PEM, Buffer.from(signature, 'base64'));
  } catch {
    verified = false;
  }
  if (!verified) {
    return { valid: false, reason: 'Firma de licencia inválida.' };
  }

  const exp = new Date(payload.fecha_expiracion + 'T23:59:59');
  if (isNaN(exp) || exp < new Date()) {
    return { valid: false, reason: 'Licencia expirada.', payload };
  }

  return { valid: true, payload };
}

function blockedPage(reason) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Calendario NEUROCOOP</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .box { text-align:center; padding:32px; max-width:420px; }
  h1 { font-size:20px; margin-bottom:8px; }
  p { color:#94a3b8; font-size:14px; line-height:1.5; }
</style>
</head>
<body>
  <div class="box">
    <h1>Acceso no disponible</h1>
    <p>${reason}</p>
    <p>${CONTACT_INFO}</p>
  </div>
</body>
</html>`;
}

module.exports = { checkLicense, blockedPage };
