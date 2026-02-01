/**
 * After all artifacts are built: patch the unpacked Windows exe again so
 * dist/win-unpacked has Novera Hub branding (Task Manager / shortcuts).
 * This ensures the portable exe is correct when run without installing.
 */
const path = require('path');
const fs = require('fs');
const { patchExeMetadata } = require('./patchExeMetadata.js');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const productName = (pkg.build && pkg.build.productName) || pkg.productName || 'NoveraHub Launcher';
const version = pkg.version || '1.0.0';
const outDir = path.join(root, 'dist');
const exePath = path.join(outDir, 'win-unpacked', productName + '.exe');

async function defaultExport(_buildResult) {
  if (process.platform !== 'win32') return [];

  if (!fs.existsSync(exePath)) {
    console.warn('Launcher afterAllArtifactBuild: exe not found', exePath);
    return [];
  }

  try {
    await patchExeMetadata(exePath, {
      rootDir: root,
      version,
      productFilename: productName,
    });
    console.log('Launcher afterAllArtifactBuild: patched unpacked exe', exePath);
  } catch (err) {
    console.warn('Launcher afterAllArtifactBuild:', err.message);
  }

  return [];
}

module.exports = defaultExport;
