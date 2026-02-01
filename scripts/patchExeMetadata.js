/**
 * Shared helper: set Novera Hub name and icon on a Windows exe so Task Manager
 * and shortcuts show our branding. Used by afterPack and afterAllArtifactBuild.
 */
const path = require('path');
const fs = require('fs');

async function patchExeMetadata(exePath, options) {
  const root = options.rootDir || path.resolve(__dirname, '..');
  exePath = path.resolve(exePath);

  if (!fs.existsSync(exePath)) {
    console.warn('Launcher patchExeMetadata: exe not found', exePath);
    return false;
  }

  let iconPath = path.join(root, 'assets', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(root, 'assets', 'noverahub.ico');
  }
  if (!fs.existsSync(iconPath)) iconPath = null; else iconPath = path.resolve(iconPath);

  const version = options.version || '1.0.0';
  const parts = version.split('.').map((n) => parseInt(n, 10) || 0).slice(0, 4);
  while (parts.length < 4) parts.push(0);
  const versionFourPart = parts.join('.');
  const productFilename = options.productFilename || 'NoveraHub Launcher';

  const rceditMod = await import('rcedit');
  const rcedit = rceditMod.rcedit ?? rceditMod.default;
  if (typeof rcedit !== 'function') throw new Error('rcedit export not found');

  const rceditOptions = {
    'version-string': {
      ProductName: 'Novera Hub Launcher',
      FileDescription: 'Novera Hub Launcher',
      CompanyName: 'Novera Studios Ltd',
      LegalCopyright: 'Copyright (c) Novera Studios Ltd',
      InternalName: 'Novera Hub Launcher',
      OriginalFilename: (options.productFilename || 'NoveraHub Launcher') + '.exe',
    },
    'file-version': versionFourPart,
    'product-version': versionFourPart,
  };
  if (iconPath) rceditOptions.icon = iconPath;

  await rcedit(exePath, rceditOptions);
  return true;
}

module.exports = { patchExeMetadata };
