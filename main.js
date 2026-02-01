const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Load env same as main app: .env.local first (repo root or launcher), then .env
const envLocalRoot = path.join(__dirname, '..', '.env.local');
const envLocalHere = path.join(__dirname, '.env.local');
const envHere = path.join(__dirname, '.env');
if (fs.existsSync(envLocalRoot)) {
  require('dotenv').config({ path: envLocalRoot });
} else if (fs.existsSync(envLocalHere)) {
  require('dotenv').config({ path: envLocalHere });
} else if (fs.existsSync(envHere)) {
  require('dotenv').config({ path: envHere });
}

const { app, BrowserWindow, shell, ipcMain, session, Menu, nativeImage } = require('electron');

// So Windows shows "Novera Hub Launcher" (and our icon) in taskbar, Task Manager, and notifications
app.setAppUserModelId('com.noverahub.launcher');
if (process.platform === 'win32') {
  app.name = 'Novera Hub Launcher';
}

let HUB_URL = (process.env.HUB_URL || 'https://noverahub.com').replace(/\/$/, '');
let GITHUB_REPO = (process.env.GITHUB_REPO || '').trim();
try {
  const buildConfigPath = path.join(__dirname, 'build-config.json');
  if (fs.existsSync(buildConfigPath)) {
    const buildConfig = JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'));
    if (buildConfig.HUB_URL != null && String(buildConfig.HUB_URL).trim()) HUB_URL = String(buildConfig.HUB_URL).trim().replace(/\/$/, '');
    if (buildConfig.GITHUB_REPO != null) GITHUB_REPO = String(buildConfig.GITHUB_REPO).trim();
  }
} catch (_) {}

// Chrome User-Agent for Hub requests so the Hub (or WAF) treats launcher like the website
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Persistent session so login survives app restart. */
const PERSISTENT_PARTITION = 'persist:noverahub';
function getSession() {
  return session.fromPartition(PERSISTENT_PARTITION);
}

/** Path to Novera Hub app icon. Windows: .ico, else .png. */
function getAppIconPath() {
  const assetsDir = path.join(__dirname, 'assets');
  if (process.platform === 'win32') {
    const ico = path.join(assetsDir, 'icon.ico');
    const fallback = path.join(assetsDir, 'noverahub.ico');
    if (fs.existsSync(ico)) return ico;
    if (fs.existsSync(fallback)) return fallback;
    return path.join(assetsDir, 'icon.png');
  }
  return path.join(assetsDir, 'icon.png');
}

let mainWindow = null;

/** Compare semver strings; returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareVersions(a, b) {
  const pa = (a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = (b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/** Parse Max-Age or Expires from Set-Cookie header; return seconds since UNIX epoch or null. */
function parseCookieExpiration(header) {
  const parts = header.split(';').slice(1);
  for (const p of parts) {
    const [key, ...v] = p.trim().split('=');
    const keyLower = (key || '').toLowerCase();
    const val = v.join('=').trim();
    if (keyLower === 'max-age' && val !== '') {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n) && n > 0) return Math.floor(Date.now() / 1000) + n;
    }
    if (keyLower === 'expires' && val) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
    }
  }
  return null;
}

/** Apply Set-Cookie header(s) from Node IncomingMessage to launcher session. */
function applySetCookieFromNodeResponse(res, baseUrl) {
  const ses = getSession();
  const raw = res.headers['set-cookie'];
  const list = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]);
  const base = new URL(baseUrl);
  const url = base.origin;
  const isSecure = base.protocol === 'https:';
  const SESSION_DAYS = 30;
  const defaultExpiration = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const promises = [];
  for (const header of list) {
    const part = header.split(';')[0].trim();
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    const expirationDate = parseCookieExpiration(header) ?? defaultExpiration;
    promises.push(
      ses.cookies.set({
        url,
        name,
        value,
        path: '/',
        secure: isSecure,
        httpOnly: true,
        expirationDate,
      }).catch((err) => console.warn('Launcher: set cookie failed', name, err))
    );
  }
  return Promise.all(promises);
}

/** Fetch profile by loading /api/profile in a window that shares defaultSession (cookie is sent). */
function fetchProfileViaSession() {
  return new Promise((resolve) => {
    let settled = false;
    const hubUrl = HUB_URL;
    const profileUrl = hubUrl + '/api/profile';

    function makeWindow() {
      return new BrowserWindow({
        show: false,
        icon: getAppIconPath(),
        webPreferences: {
          partition: PERSISTENT_PARTITION,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
    }

    function done(win, profile) {
      if (settled) return;
      settled = true;
      if (win && !win.isDestroyed()) win.destroy();
      resolve(profile);
    }

    const win = makeWindow();
    win.loadURL(profileUrl).catch(() => done(win, null));

    win.webContents.once('did-finish-load', () => {
      win.webContents
        .executeJavaScript(
          '(function(){ var b = document.body; if (!b) return null; var t = (b.innerText || b.textContent || "").trim(); var pre = document.querySelector("pre"); if (!t && pre) t = (pre.innerText || pre.textContent || "").trim(); return t || null; })()'
        )
        .then((text) => {
          if (text) {
            try {
              const data = JSON.parse(text);
              if (data && typeof data.error === 'undefined' && (data.username || data.display_name != null)) {
                return done(win, data);
              }
            } catch (_) {}
          }
          fallbackFetchInPage(win, done);
        })
        .catch(() => fallbackFetchInPage(win, done));
    });

    function fallbackFetchInPage(prevWin, doneFn) {
      if (prevWin && !prevWin.isDestroyed()) prevWin.destroy();
      const win2 = makeWindow();
      win2.loadURL(hubUrl + '/').catch(() => doneFn(win2, null));
      win2.webContents.once('did-finish-load', () => {
        const script = `(function(){
          var u = ${JSON.stringify(hubUrl)};
          return fetch(u + '/api/profile', { credentials: 'include' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function() { return null; });
        })()`;
        win2.webContents
          .executeJavaScript(script)
          .then((profile) => doneFn(win2, profile))
          .catch(() => doneFn(win2, null));
      });
      win2.on('closed', () => doneFn(win2, null));
      setTimeout(() => { if (!win2.isDestroyed()) doneFn(win2, null); }, 10000);
    }

    win.on('closed', () => done(win, null));
    setTimeout(() => { if (!win.isDestroyed()) done(win, null); }, 10000);
  });
}

/** Make a GET request with Cookie header and return JSON body. */
function nodeGetWithCookie(url, cookieHeader) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader || '',
      },
    };
    if (isHttps && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      opts.rejectUnauthorized = false;
    }
    const req = (isHttps ? https : http).request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

/** Same as website: fetch from a window on Hub origin so the browser sets the cookie. */
function loginViaBrowserSameAsWebsite(username, password) {
  return new Promise((resolve) => {
    const hubUrl = HUB_URL;
    const win = new BrowserWindow({
      show: false,
      icon: getAppIconPath(),
      webPreferences: {
        partition: PERSISTENT_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });
    const u = (username || '').trim();
    const p = password || '';
    const script = `
      (function() {
        var base = ${JSON.stringify(hubUrl)};
        var username = ${JSON.stringify(u)};
        var password = ${JSON.stringify(p)};
        return fetch(base + '/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Client': 'novera-launcher' },
          body: JSON.stringify({ username: username, password: password })
        })
          .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }).catch(function() { return { status: r.status, data: {} }; }); })
          .then(function(out) {
            if (out.status !== 200 || !out.data.redirect) {
              var err = (out.data && out.data.error) || (out.status === 401 ? 'Invalid username or password.' : out.status === 503 ? 'Database unavailable.' : 'Login failed.');
              throw new Error(err);
            }
            return fetch(base + '/api/profile', { credentials: 'include' })
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(profile) { return { ok: true, profile: profile }; });
          })
          .catch(function(e) { return { ok: false, error: e.message || 'Login failed.' }; });
      })()
    `;
    let settled = false;
    function done(result) {
      if (settled) return;
      settled = true;
      if (win && !win.isDestroyed()) win.destroy();
      resolve(result);
    }
    win.loadURL(hubUrl + '/login').catch(() => done({ ok: false, error: 'Cannot load ' + hubUrl + '. Check your connection.' }));
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.executeJavaScript(script)
          .then((result) => {
            if (result && typeof result.then === 'function') return result;
            return result ? Promise.resolve(result) : Promise.resolve({ ok: false, error: 'Login failed.' });
          })
          .then(done)
          .catch((e) => done({ ok: false, error: e.message || 'Login failed.' }));
      }, 400);
    });
    win.on('closed', () => { if (!settled) done({ ok: false, error: 'Login window closed.' }); });
    setTimeout(() => { if (!settled) done({ ok: false, error: 'Login timed out.' }); }, 30000);
  });
}

/** Fallback: Node https/http when browser-window login fails (e.g. network). */
function loginViaNode(username, password) {
  return new Promise((resolve) => {
    const u = new URL(HUB_URL + '/api/auth/login');
    const isHttps = u.protocol === 'https:';
    const body = JSON.stringify({ username: (username || '').trim(), password: password || '' });
    const origin = HUB_URL.replace(/\/$/, '');
    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
        Accept: 'application/json',
        'User-Agent': CHROME_USER_AGENT,
        'X-Client': 'novera-launcher',
        Origin: origin,
        Referer: origin + '/login',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    if (isHttps && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      opts.rejectUnauthorized = false;
    }
    const req = (isHttps ? https : http).request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const json = (() => { try { return JSON.parse(data); } catch { return {}; } })();
        const rawCookie = res.headers['set-cookie'];
        const list = rawCookie == null ? [] : (Array.isArray(rawCookie) ? rawCookie : [rawCookie]);
        let cookieHeader = '';
        for (const header of list) {
          const part = header.split(';')[0].trim();
          const eq = part.indexOf('=');
          if (eq > 0) {
            const name = part.slice(0, eq).trim();
            const value = part.slice(eq + 1).trim();
            if (name && value) cookieHeader += (cookieHeader ? '; ' : '') + name + '=' + value;
          }
        }
        if (res.statusCode === 200 && (json.ok === true || json.redirect)) {
          applySetCookieFromNodeResponse(res, HUB_URL)
            .then(() => nodeGetWithCookie(HUB_URL + '/api/profile', cookieHeader))
            .then((profile) => {
              if (profile && typeof profile.error !== 'undefined') profile = undefined;
              resolve({ ok: true, redirect: json.redirect || '/app', profile: profile || undefined });
            })
            .catch(() => resolve({ ok: true, redirect: json.redirect || '/app', profile: undefined }));
        } else {
          const msg =
            (json && json.error) ||
            (res.statusCode === 401 ? 'Invalid username or password.' : '') ||
            (res.statusCode === 403 ? 'Account is not active.' : '') ||
            (res.statusCode === 503 ? 'Database unavailable.' : '') ||
            (res.statusCode >= 400 ? 'Login failed.' : '') ||
            'Login failed. Please try again.';
          resolve({ ok: false, error: msg });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: 'Cannot reach ' + HUB_URL + '. Check your connection. (' + (err.code || err.message) + ')' });
    });
    req.setTimeout(20000, () => { req.destroy(); resolve({ ok: false, error: 'Request timed out.' }); });
    req.write(body);
    req.end();
  });
}

ipcMain.handle('auth-login', async (_event, { username, password }) => {
  if (!username || !password) return { ok: false, error: 'Please enter username and password.' };
  // Try browser path first (same as website). If it fails for any reason, try Node path (direct HTTPS with Chrome UA).
  let result = await loginViaBrowserSameAsWebsite(username, password);
  if (!result.ok) {
    result = await loginViaNode(username, password);
  }
  if (result.ok) {
    await new Promise((r) => setTimeout(r, 150));
    await persistSessionCookie();
  }
  return result;
});

const SESSION_COOKIE_NAME = 'novera_session';
const SESSION_DAYS = 30;

/** Re-set the session cookie with explicit expiration so it persists across app restarts. */
async function persistSessionCookie() {
  const base = new URL(HUB_URL);
  const ses = getSession();
  const list = await ses.cookies.get({ url: base.origin });
  const cookie = list.find((c) => c.name === SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) return;
  const expirationDate = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  await ses.cookies.set({
    url: base.origin,
    name: SESSION_COOKIE_NAME,
    value: cookie.value,
    path: '/',
    secure: base.protocol === 'https:',
    httpOnly: true,
    expirationDate,
  }).catch((err) => console.warn('Launcher: persist session cookie failed', err));
  try {
    await ses.flushStorageData();
  } catch (_) {}
}

ipcMain.handle('auth-logout', async () => {
  const base = new URL(HUB_URL);
  const ses = getSession();
  try {
    const list = await ses.cookies.get({ url: base.origin });
    const cookie = list.find((c) => c.name === SESSION_COOKIE_NAME);
    const headers = cookie ? { Cookie: `${SESSION_COOKIE_NAME}=${cookie.value}` } : {};
    await fetch(HUB_URL + '/api/auth/logout', { method: 'POST', headers });
  } catch (_) {}
  try {
    await ses.cookies.remove(base.origin, SESSION_COOKIE_NAME);
  } catch (_) {}
});

function createWindow() {
  const iconPath = getAppIconPath();
  const iconImage = nativeImage.createFromPath(iconPath);
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#f1f5f9',
    show: false,
    fullscreenable: true,
    title: 'Novera Hub Launcher',
    webPreferences: {
      partition: PERSISTENT_PARTITION,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    icon: iconPath,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!iconImage.isEmpty()) mainWindow.setIcon(iconImage);
    mainWindow.setTitle('Novera Hub Launcher');
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('launch-hub', () => shell.openExternal(HUB_URL));

ipcMain.handle('get-config', () => ({
  hubUrl: HUB_URL,
  version: app.getVersion(),
  githubRepo: GITHUB_REPO,
}));

/** Load optional GitHub token from userData (for private repo). Never embedded in build. */
function getGitHubToken() {
  const pathsToTry = [
    path.join(app.getPath('userData'), 'launcher-config.json'),
  ];
  if (process.platform === 'win32' && process.env.APPDATA) {
    pathsToTry.push(path.join(process.env.APPDATA, 'novera-hub-launcher', 'launcher-config.json'));
  }
  for (const configPath of pathsToTry) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      const token = config && (config.githubToken || config.GITHUB_TOKEN);
      if (typeof token === 'string' && token.trim()) return token.trim();
    } catch (_) {}
  }
  return null;
}

/** Do one GitHub API request for releases. Follows redirects. useToken = true to send Bearer token (we always use false for public repo). */
function fetchReleases(useToken) {
  const current = app.getVersion();
  const token = useToken ? getGitHubToken() : null;
  const headers = {
    'User-Agent': 'NoveraHubLauncher/' + current + ' (https://github.com/deltaravo42/noverahub-launcher)',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = 'Bearer ' + token;

  const requestUrl = 'https://api.github.com/repos/' + encodeURIComponent(GITHUB_REPO) + '/releases?per_page=30';
  const maxRedirects = 5;

  function doRequest(url, redirectCount, resolve, reject) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    };
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(opts, (res) => {
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location && redirectCount < maxRedirects) {
        let next = res.headers.location;
        if (next.startsWith('/')) next = parsed.origin + next;
        res.resume(); // consume body so the connection can be reused
        return doRequest(next, redirectCount + 1, resolve, reject);
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ statusCode: status, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timed out.')); });
    req.end();
  }

  return new Promise((resolve, reject) => {
    doRequest(requestUrl, 0, resolve, reject);
  });
}

/** Fallback: fetch releases from GitHub's Atom feed (github.com, not api.github.com) when API returns 404 (e.g. API blocked by network). */
function fetchReleasesFromFeed() {
  const pathSegments = GITHUB_REPO.split('/').map(encodeURIComponent);
  const feedPath = '/' + pathSegments.join('/') + '/releases.atom';
  return new Promise((resolve) => {
    const opts = {
      hostname: 'github.com',
      path: feedPath,
      method: 'GET',
      headers: { 'User-Agent': 'NoveraHubLauncher/' + app.getVersion() + ' (https://github.com/deltaravo42/noverahub-launcher)' },
    };
    const req = https.request(opts, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const entryBlock = body.match(/<entry>([\s\S]*?)<\/entry>/);
          if (!entryBlock) return resolve(null);
          const entry = entryBlock[1];
          const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
          const titleMatch = entry.match(/<title[^>]*>([^<]+)<\/title>/);
          const link = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : null;
          const title = titleMatch ? titleMatch[1].trim() : '';
          // Extract semver from title (e.g. "Novera Hub Launcher v1.0.4" or "Release v1.1.2" -> "1.0.4" / "1.1.2")
          const verMatch = title.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
          const ver = verMatch ? verMatch[1] : (title.replace(/^Release\s+/i, '').replace(/^v/i, '') || '').trim();
          if (link && ver) resolve({ releaseUrl: link, latestVersion: ver });
          else resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/** Check GitHub releases for a newer version. Uses API first; if 404, falls back to releases.atom feed (works when api.github.com is blocked). */
ipcMain.handle('check-for-updates', async () => {
  const current = app.getVersion();
  const out = (obj) => ({ ...obj, currentVersion: current });

  if (!GITHUB_REPO) return out({ hasUpdate: false, error: 'No GitHub repo configured. Set GITHUB_REPO in launcher .env.local and rebuild.' });

  // Always use public API (no token) so public repos like deltaravo42/noverahub-launcher work without any config
  let res = await fetchReleases(false).catch((err) => ({ statusCode: 0, body: '', err }));
  if (res.err) return out({ hasUpdate: false, error: 'Network error: ' + (res.err.message || 'Check internet.') });

  let statusCode = res.statusCode;
  let body = res.body || '';

  // When API returns 404 (e.g. api.github.com blocked by firewall/proxy), try releases Atom feed from github.com
  if (statusCode === 404) {
    const feedResult = await fetchReleasesFromFeed();
    if (feedResult) {
      const hasUpdate = compareVersions(feedResult.latestVersion, current) > 0;
      return out({ hasUpdate, latestVersion: feedResult.latestVersion, releaseUrl: feedResult.releaseUrl, downloadUrl: '', body: '' });
    }
    const repoUrl = 'https://github.com/' + (GITHUB_REPO || 'owner/repo');
    return out({ hasUpdate: false, error: 'Could not reach GitHub. Check your connection or try ' + repoUrl + '/releases later.' });
  }

  if (statusCode !== 200) {
    if (statusCode === 401) return out({ hasUpdate: false, error: 'GitHub returned 401. Check your connection and try again.' });
    if (statusCode === 403) return out({ hasUpdate: false, error: 'GitHub rate limit or access denied. Try again later.' });
    return out({ hasUpdate: false, error: 'GitHub returned ' + statusCode });
  }

  try {
    const list = JSON.parse(body);
    if (!Array.isArray(list) || list.length === 0) {
      return out({ hasUpdate: false, latestVersion: current, releaseUrl: '' });
    }
    let bestTag = '';
    let bestVersion = '';
    let bestRelease = null;
    for (const r of list) {
      const tag = (r.tag_name || '').trim();
      if (!tag) continue;
      const ver = tag.replace(/^v/i, '');
      if (!bestTag || compareVersions(ver, bestVersion) > 0) {
        bestTag = tag;
        bestVersion = ver;
        bestRelease = r;
      }
    }
    const releaseUrl = bestRelease?.html_url || (bestTag ? 'https://github.com/' + GITHUB_REPO + '/releases/tag/' + encodeURIComponent(bestTag) : '');
    const hasUpdate = bestVersion ? compareVersions(bestVersion, current) > 0 : false;
    // Windows installer direct download URL (from release assets) for in-app update
    let downloadUrl = '';
    const assets = bestRelease?.assets;
    if (Array.isArray(assets)) {
      const winSetup = assets.find((a) => (a.name && a.name.includes('Setup') && a.name.endsWith('.exe')));
      if (winSetup && winSetup.browser_download_url) downloadUrl = winSetup.browser_download_url;
    }
    return out({ hasUpdate, latestVersion: bestVersion || bestTag, releaseUrl, downloadUrl, body: bestRelease?.body || '' });
  } catch (e) {
    return out({ hasUpdate: false, error: 'Could not read release list.' });
  }
});

/** Download a file from url (follows redirects), save to destPath. Returns Promise<{ success, error? }>. */
function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const done = (err) => resolve(err ? { success: false, error: err.message } : { success: true });
    const followRedirect = (location) => {
      if (!location || typeof location !== 'string') return done(new Error('No redirect location'));
      const u = location.startsWith('http') ? new URL(location) : new URL(location, url);
      const mod = u.protocol === 'https:' ? https : http;
      const opts = { method: 'GET', headers: { 'User-Agent': 'NoveraHubLauncher/' + app.getVersion() } };
      const req = mod.request(u.href, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return followRedirect(res.headers.location);
        }
        if (res.statusCode !== 200) return done(new Error('Download failed: ' + res.statusCode));
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => { file.close(); done(null); });
        file.on('error', (err) => { fs.unlink(destPath, () => {}); done(err); });
      });
      req.on('error', done);
      req.setTimeout(60000, () => { req.destroy(); done(new Error('Download timed out')); });
      req.end();
    };
    followRedirect(url);
  });
}

ipcMain.handle('download-and-run-update', async (_event, url) => {
  if (!url || typeof url !== 'string') return { success: false, error: 'No URL provided.' };
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return { success: false, error: 'Invalid URL.' };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = host === 'github.com' || host.endsWith('.github.com') || host === 'githubusercontent.com' || host.endsWith('.githubusercontent.com');
  if (!allowed) return { success: false, error: 'Only GitHub release downloads are allowed.' };
  const fileName = 'NoveraHub-Launcher-Setup.exe';
  const destPath = path.join(app.getPath('temp'), fileName);
  try {
    const result = await downloadFile(url, destPath);
    if (!result.success) return result;
    shell.openPath(destPath).then((err) => {
      if (err) console.error('Launcher: openPath failed', err);
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e && e.message) || 'Download failed.' };
  }
});

ipcMain.handle('open-external', (_event, url) => {
  if (url && typeof url === 'string') shell.openExternal(url);
});

/** Get current profile using session cookie (for "already logged in" on launcher load). */
ipcMain.handle('get-profile', async () => {
  const base = new URL(HUB_URL);
  const ses = getSession();
  const list = await ses.cookies.get({ url: base.origin });
  const cookie = list.find((c) => c.name === SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) return null;
  try {
    const profile = await nodeGetWithCookie(HUB_URL + '/api/profile', SESSION_COOKIE_NAME + '=' + cookie.value);
    if (profile && typeof profile.error !== 'undefined') return null;
    return profile;
  } catch {
    return null;
  }
});

ipcMain.handle('open-hub-window', (_event, url) => {
  const target = url && url.startsWith('http') ? url : HUB_URL + (url || '/app');
  const hubOrigin = new URL(HUB_URL).origin;
  const hubIconPath = getAppIconPath();
  const hubIconImage = nativeImage.createFromPath(hubIconPath);
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Novera Hub',
    webPreferences: { partition: PERSISTENT_PARTITION, contextIsolation: true, nodeIntegration: false },
    icon: hubIconPath,
  });
  win.loadURL(target);
  win.once('ready-to-show', () => {
    if (!hubIconImage.isEmpty()) win.setIcon(hubIconImage);
    win.setTitle('Novera Hub');
    win.show();
  });

  function returnToLauncher() {
    getSession().cookies.remove(hubOrigin, SESSION_COOKIE_NAME).catch(() => {});
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents.send('launcher:logged-out');
    }
    if (win && !win.isDestroyed()) win.close();
  }

  win.webContents.on('did-navigate', (_event, navUrl) => {
    try {
      const u = new URL(navUrl);
      if (u.origin === hubOrigin && (u.pathname === '/login' || u.pathname === '/login/')) {
        returnToLauncher();
      }
    } catch (_) {}
  });
  win.webContents.on('did-finish-load', () => {
    try {
      const u = new URL(win.webContents.getURL());
      if (u.origin === hubOrigin && (u.pathname === '/login' || u.pathname === '/login/')) {
        returnToLauncher();
      }
    } catch (_) {}
  });
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  getSession().setUserAgent(CHROME_USER_AGENT);
  createWindow();
});
app.on('before-quit', () => {
  try {
    getSession().flushStorageData();
  } catch (_) {}
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (mainWindow === null) createWindow(); });
