const express = require('express');
const session = require('express-session');
const helmet  = require('helmet');
const crypto  = require('crypto');
const os      = require('os');
const path    = require('path');
const fs      = require('fs');

const app = express();

const PREFERRED_PORT = Number(process.env.PORT) || 8765;
const ADMIN_PATH     = '/gestion';
const USE_TUNNEL     = process.argv.includes('--internet');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

app.use('/api',       require('./routes/api'));
app.use('/api/admin', require('./routes/adminApi'));

app.get(ADMIN_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function getLocalIPs() {
  const result = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) result.push(iface.address);
    }
  }
  return result;
}

function line(text, width = 46) {
  const pad = width - text.length - 4;
  return `  ║  ${text}${' '.repeat(Math.max(0, pad))}║`;
}

function tryListen(port, maxTries = 20) {
  return new Promise((resolve, reject) => {
    if (maxTries <= 0) return reject(new Error('Sin puertos disponibles'));
    const srv = app.listen(port, '0.0.0.0');
    srv.once('listening', () => resolve({ srv, port }));
    srv.once('error', err => {
      srv.close();
      if (err.code === 'EADDRINUSE') {
        tryListen(port + 1, maxTries - 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

(async () => {
  const { port: PORT } = await tryListen(PREFERRED_PORT);
  const localIPs = getLocalIPs();
  const H = '═';
  const TL = '╔', TR = '╗', BL = '╚', BR = '╝';
  const ML = '╠', MR = '╣';
  const W = 46;
  const top = `  ${TL}${H.repeat(W)}${TR}`;
  const mid = `  ${ML}${H.repeat(W)}${MR}`;
  const bot = `  ${BL}${H.repeat(W)}${BR}`;

  console.log('\n' + top);
  console.log(line('CALENDARIO NEUROCOOP'));
  console.log(mid);
  console.log(line('ACCESO LOCAL (este equipo):'));
  console.log(line('  http://localhost:' + PORT + '/'));
  console.log(line('  Admin: http://localhost:' + PORT + ADMIN_PATH));

  if (localIPs.length) {
    console.log(mid);
    console.log(line('RED INTERNA (misma red / VPN):'));
    for (const ip of localIPs) {
      console.log(line('  http://' + ip + ':' + PORT + '/'));
      console.log(line('  Admin: http://' + ip + ':' + PORT + ADMIN_PATH));
    }
  }

  if (USE_TUNNEL) {
    console.log(mid);
    console.log(line('Iniciando tunel internet...'));
    try {
      const { default: lt } = await import('localtunnel');
      const tunnel = await lt({ port: PORT });
      console.log(line('INTERNET (cualquier ciudad):'));
      console.log(line('  ' + tunnel.url));
      console.log(line('  Admin: ' + tunnel.url + ADMIN_PATH));
      tunnel.on('close', () => console.log('\n  Tunel cerrado.'));
    } catch (e) {
      console.log(line('Error tunel: ' + e.message));
    }
  } else {
    console.log(mid);
    console.log(line('INTERNET (URL fija permanente):'));
    console.log(line('  Usuarios: https://unsoldierlike-izayah-'));
    console.log(line('            tetchily.ngrok-free.dev'));
    console.log(line('  Admin:    https://unsoldierlike-izayah-'));
    console.log(line('          tetchily.ngrok-free.dev/gestion'));
  }

  console.log(mid);
  console.log(line('Contrasena admin: neurocoop2024'));
  console.log(line('Firewall: ejecute ABRIR-FIREWALL.bat'));
  console.log(bot + '\n');
})();
