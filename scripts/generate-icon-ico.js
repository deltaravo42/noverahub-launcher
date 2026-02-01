/**
 * Generate assets/icon.ico from assets/icon.png with multiple sizes (16, 32, 48, 256)
 * so Task Manager and shortcuts show a sharp icon. Run before build or after changing icon.png.
 * Requires: npm install to-ico --save-dev
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const iconPng = path.join(root, 'assets', 'icon.png');
const iconIco = path.join(root, 'assets', 'icon.ico');

async function main() {
  if (!fs.existsSync(iconPng)) {
    console.warn('Launcher: assets/icon.png not found, skipping icon.ico generation.');
    return;
  }

  try {
    const toIcoMod = await import('to-ico');
    const toIco = toIcoMod.default ?? toIcoMod;
    const pngBuffer = fs.readFileSync(iconPng);

    const icoBuffer = await toIco([pngBuffer], {
      resize: true,
      sizes: [16, 32, 48, 256],
    });

    fs.writeFileSync(iconIco, icoBuffer);
    console.log('Launcher: wrote assets/icon.ico (multi-size 16, 32, 48, 256)');
  } catch (err) {
    console.warn('Launcher generate-icon-ico:', err.message);
  }
}

main();
