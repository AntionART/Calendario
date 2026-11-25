const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'dist-app', 'app-server');

function copyPublicAssets() {
  const srcPublic = path.join(ROOT, 'public');
  const destPublic = path.join(STAGE, 'public');
  const jsDir = path.join(srcPublic, 'js');
  fs.cpSync(srcPublic, destPublic, {
    recursive: true,
    // public/js/*.js ya fue generado (ofuscado) por build/obfuscate.js
    filter: (src) => !src.startsWith(jsDir)
  });
  console.log('Assets publicos copiados (excepto js/, ya ofuscado).');
}

function getProdModulePaths() {
  let output;
  try {
    output = execSync('npm ls --all --omit=dev --parseable', { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    output = err.stdout ? err.stdout.toString() : '';
  }
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(p => p.includes('node_modules'));
}

function copyProdNodeModules() {
  const modulePaths = getProdModulePaths();
  if (!modulePaths.length) {
    throw new Error('No se pudieron resolver las dependencias de produccion con "npm ls". Revise que node_modules este instalado.');
  }
  for (const modulePath of modulePaths) {
    const rel = path.relative(ROOT, modulePath);
    const dest = path.join(STAGE, rel);
    fs.cpSync(modulePath, dest, { recursive: true });
  }
  console.log(`node_modules de produccion copiado: ${modulePaths.length} paquetes.`);
}

if (!fs.existsSync(path.join(STAGE, 'server.js'))) {
  console.error('No se encontro dist-app/app-server/server.js. Ejecute "npm run obfuscate" antes de "stage".');
  process.exit(1);
}

copyPublicAssets();
copyProdNodeModules();

if (fs.existsSync(path.join(ROOT, 'license.lic'))) {
  fs.copyFileSync(path.join(ROOT, 'license.lic'), path.join(STAGE, 'license.lic'));
  console.log('license.lic copiada al staging.');
}

console.log('Staging completo en', STAGE);
console.log('IMPORTANTE: db/ y uploads/ NO se incluyen en el paquete (se preservan/instalan aparte).');
