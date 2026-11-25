const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTACT_INFO = 'Contacte al desarrollador para gestionar la licencia.';

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAFaUlh6PDhn/a/387B8heJzBKcI7fjpRbUYjgWr2uQYU=
-----END PUBLIC KEY-----`;

const LICENSE_PATH = process.env.LICENSE_PATH || path.join(__dirname, 'license.lic');

function getMachineGuid() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 3000
    });
    const match = out.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9-]+)/i);
    return match ? match[1].trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function checkLicense() {
  let raw;
  try {
    raw = fs.readFileSync(LICENSE_PATH, 'utf8');
  } catch {
    return { valid: false, reason: 'Archivo de licencia no encontrado (license.lic).' };
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
  let verified = false;
  try {
    verified = crypto.verify(null, Buffer.from(payloadStr), PUBLIC_KEY_PEM, Buffer.from(signature, 'base64'));
  } catch {
    verified = false;
  }

  if (!verified) {
    return { valid: false, reason: 'Firma criptográfica de licencia inválida.' };
  }

  if (payload.software !== 'Calendario NEUROCOOP') {
    return { valid: false, reason: 'La licencia no corresponde a este software.' };
  }

  if (payload.machine_id) {
    const currentGuid = getMachineGuid();
    if (currentGuid && payload.machine_id.toLowerCase() !== currentGuid) {
      return {
        valid: false,
        reason: 'Licencia no autorizada para este hardware del servidor.',
        payload
      };
    }
  }

  if (payload.fecha_expiracion && payload.fecha_expiracion !== 'VITALICIA') {
    const exp = new Date(payload.fecha_expiracion + 'T23:59:59');
    if (!isNaN(exp) && exp < new Date()) {
      return { valid: false, reason: 'La licencia ha expirado.', payload };
    }
  }

  return { valid: true, payload };
}

function blockedPage(reason) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calendario NEUROCOOP - Licencia Requerida</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .box { text-align:center; padding:40px 32px; max-width:460px; background:#1e293b; border-radius:12px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.5); border:1px solid #334155; }
  .badge { display:inline-block; padding:4px 12px; background:#ef4444; color:#fff; border-radius:9999px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px; }
  h1 { font-size:22px; margin:0 0 12px; color:#f8fafc; font-weight:700; }
  p { color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 16px; }
  .contact { font-size:13px; color:#64748b; border-top:1px solid #334155; padding-top:16px; margin-top:20px; }
</style>
</head>
<body>
  <div class="box">
    <div class="badge">Acceso Restringido</div>
    <h1>Calendario Corporativo</h1>
    <p>${reason}</p>
    <div class="contact">${CONTACT_INFO}</div>
  </div>
</body>
</html>`;
}

module.exports = { checkLicense, blockedPage, getMachineGuid };
