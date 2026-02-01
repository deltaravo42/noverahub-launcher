/**
 * Apply Novera Hub branding to the dev executable so "npm start" shows
 * "Novera Hub Launcher" and our icon in Task Manager.
 * Windows only; no-op on other platforms.
 * Run after npm install (postinstall) or manually: npm run brand-noverahub-dev
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const devExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.join(root, 'assets', 'icon.ico');
const iconFallback = path.join(root, 'assets', 'noverahub.ico');

if (process.platform !== 'win32') {
  process.exit(0);
}

if (!fs.existsSync(devExe)) {
  console.warn('Launcher brand-noverahub-dev: dev executable not found (run npm install first)');
  process.exit(0);
}

const ico = fs.existsSync(iconPath) ? iconPath : fs.existsSync(iconFallback) ? iconFallback : null;

(async () => {
  try {
    const rceditMod = await import('rcedit');
    const rcedit = rceditMod.rcedit ?? rceditMod.default;
    if (typeof rcedit !== 'function') {
      console.warn('Launcher brand-noverahub-dev: rcedit not found');
      return;
    }

    const options = {
      'version-string': {
        ProductName: 'Novera Hub Launcher',
        FileDescription: 'Novera Hub Launcher',
        CompanyName: 'Novera Hub',
        LegalCopyright: 'Copyright (c) Novera Hub',
        InternalName: 'Novera Hub Launcher',
        OriginalFilename: 'NoveraHub Launcher.exe',
      },
      'file-version': '1.0.0.0',
      'product-version': '1.0.0.0',
    };
    if (ico) options.icon = path.resolve(ico);

    await rcedit(devExe, options);
    console.log('Launcher: Novera Hub branding applied to dev build (Task Manager will show Novera Hub Launcher)');
  } catch (err) {
    console.warn('Launcher brand-noverahub-dev:', err.message);
  }
})().then(
  () => process.exit(0),
  () => process.exit(0)
);
