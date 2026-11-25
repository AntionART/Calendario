const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'Favicon.png');
const SQUARED = path.join(ROOT, 'build', '.icon-source-square.png');
const DEST = path.join(ROOT, 'build', 'icon.ico');

function makeSquare(srcPath, destPath) {
  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const size = Math.max(src.width, src.height);
  const square = new PNG({ width: size, height: size });
  // fondo transparente
  square.data.fill(0);
  const offsetX = Math.floor((size - src.width) / 2);
  const offsetY = Math.floor((size - src.height) / 2);
  PNG.bitblt(src, square, 0, 0, src.width, src.height, offsetX, offsetY);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, PNG.sync.write(square));
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('No se encontro public/Favicon.png');
    process.exit(1);
  }
  makeSquare(SRC, SQUARED);
  const buffer = await pngToIco(SQUARED);
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, buffer);
  fs.unlinkSync(SQUARED);
  console.log('Icono generado en', DEST);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
