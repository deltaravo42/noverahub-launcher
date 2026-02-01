/**
 * Generates NSIS installer images from assets/icon.png:
 * - build/installerSidebar.bmp (164×314) – branded sidebar (dark bg + centered logo)
 * - build/installerHeader.bmp (150×57) – branded header
 * Run before build (npm run dist).
 */

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const iconPath = path.join(root, 'assets', 'icon.png');

const SIDEBAR_W = 164;
const SIDEBAR_H = 314;
const HEADER_W = 150;
const HEADER_H = 57;
const SIDEBAR_LOGO_SIZE = 96;
const HEADER_LOGO_H = 36;
const BRAND_BG = 0x1e293bff;
const BRAND_BG_HEADER = 0x0f172aff;

async function main() {
  if (!fs.existsSync(iconPath)) {
    console.warn('Launcher: assets/icon.png not found, skipping installer image generation.');
    return;
  }

  fs.mkdirSync(buildDir, { recursive: true });

  try {
    const { Jimp } = require('jimp');
    const icon = await Jimp.read(iconPath);

    const logoSize = Math.min(SIDEBAR_LOGO_SIZE, icon.bitmap.width, icon.bitmap.height);
    const logo = icon.clone().resize({ w: logoSize, h: logoSize });
    const sidebarBg = new Jimp({ width: SIDEBAR_W, height: SIDEBAR_H, color: BRAND_BG });
    const logoX = Math.floor((SIDEBAR_W - logoSize) / 2);
    const logoY = Math.floor((SIDEBAR_H - logoSize) / 2);
    sidebarBg.composite(logo, logoX, logoY);
    const sidebarPath = path.join(buildDir, 'installerSidebar.bmp');
    await sidebarBg.write(sidebarPath);
    console.log('Launcher: wrote', path.relative(root, sidebarPath));

    const headerLogoW = Math.round((HEADER_LOGO_H / icon.bitmap.height) * icon.bitmap.width);
    const headerLogo = icon.clone().resize({ w: headerLogoW, h: HEADER_LOGO_H });
    const headerBg = new Jimp({ width: HEADER_W, height: HEADER_H, color: BRAND_BG_HEADER });
    const headerLogoX = Math.floor((HEADER_W - headerLogoW) / 2);
    const headerLogoY = Math.floor((HEADER_H - HEADER_LOGO_H) / 2);
    headerBg.composite(headerLogo, headerLogoX, headerLogoY);
    const headerPath = path.join(buildDir, 'installerHeader.bmp');
    await headerBg.write(headerPath);
    console.log('Launcher: wrote', path.relative(root, headerPath));
  } catch (err) {
    console.error('Launcher: failed to generate installer images:', err.message);
    process.exit(1);
  }
}

main();
