/**
 * After pack hook:
 * 1. Remove third-party license files and add Novera Hub LICENSE.
 * 2. On Windows: set exe metadata and icon so Task Manager/shortcuts show
 *    Novera Hub Launcher name and logo. Requires: npm install rcedit --save-dev
 */
const path = require('path');
const fs = require('fs');

async function defaultExport(context) {
  const appOutDir = context.appOutDir;
  const root = context.packager.projectDir || path.resolve(__dirname, '..');

  // --- Replace license files with our own (all platforms) ---
  const thirdPartyLicenses = [
    path.join(appOutDir, 'LICENSE.electron.txt'),
    path.join(appOutDir, 'LICENSES.chromium.html'),
  ];
  for (const p of thirdPartyLicenses) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log('Launcher afterPack: removed', path.basename(p));
    }
  }
  const ourLicense = path.join(root, 'LICENSE');
  const destLicense = path.join(appOutDir, 'LICENSE.txt');
  if (fs.existsSync(ourLicense)) {
    fs.copyFileSync(ourLicense, destLicense);
    console.log('Launcher afterPack: copied LICENSE ->', destLicense);
  }

  // --- Windows only: exe metadata and icon (run first so installer gets branded exe) ---
  if (context.electronPlatformName !== 'win32') return;

  const appInfo = context.packager.appInfo;
  const productFilename = appInfo.productFilename;
  const exePath = path.resolve(path.join(appOutDir, productFilename + '.exe'));

  if (!fs.existsSync(exePath)) {
    console.warn('Launcher afterPack: exe not found', exePath);
    return;
  }

  try {
    const { patchExeMetadata } = require('./patchExeMetadata.js');
    await patchExeMetadata(exePath, {
      rootDir: root,
      version: appInfo.version || '1.0.0',
      productFilename,
    });
    console.log('Launcher afterPack: set exe metadata and icon for', exePath);
  } catch (err) {
    console.error('Launcher afterPack: failed to set exe metadata:', err.message);
    throw err;
  }
}

module.exports = defaultExport;
