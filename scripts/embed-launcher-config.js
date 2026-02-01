/**
 * Write build-config.json from .env.local so the packaged launcher has
 * GITHUB_REPO (and optionally HUB_URL) for Check for updates and API.
 * Run in pre-dist; the packed app reads this file from __dirname.
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const envLocalHere = path.join(root, '.env.local');
const envLocalRoot = path.join(root, '..', '.env.local');

if (fs.existsSync(envLocalHere)) {
  require('dotenv').config({ path: envLocalHere });
} else if (fs.existsSync(envLocalRoot)) {
  require('dotenv').config({ path: envLocalRoot });
}

const GITHUB_REPO = (process.env.GITHUB_REPO || '').trim();
const HUB_URL = (process.env.HUB_URL || '').replace(/\/$/, '');

const config = {
  GITHUB_REPO: GITHUB_REPO || '',
  HUB_URL: HUB_URL || 'https://noverahub.com',
};

const outPath = path.join(root, 'build-config.json');
fs.writeFileSync(outPath, JSON.stringify(config, null, 0), 'utf8');
console.log('Launcher: wrote build-config.json (GITHUB_REPO:', GITHUB_REPO ? GITHUB_REPO : '(empty)', ')');
