# Releasing Novera Hub Launcher

Use this checklist so the **installed app** (e.g. 1.0.2 at `C:\...\NoveraHub Launcher`) can see and offer new versions via **Menu → Check for updates**.

## What’s in the build (so the launcher can update)

When you run `npm run dist`, the launcher is **connected to your GitHub repo** by including:

- **GITHUB_REPO** — e.g. `deltaravo42/noverahub-launcher`. This is read from **.env.local** (repo root) at build time and written into **build-config.json**, which is packaged into the app. Every installed launcher then knows which repo to check for new releases.
- **HUB_URL** — same way, so the launcher knows where to log in and load content.

**No GitHub token is (or should be) in the build.** For a **public** repo, no token is needed: GitHub’s API lets anyone list public releases. The launcher uses the public API only — no token, no launcher-config.json. Public repo works out of the box.

So: put `GITHUB_REPO=deltaravo42/noverahub-launcher` in **.env.local**, run `npm run dist`, and the resulting installer is already “connected” — users get updates via **Menu → Check for updates** as long as you publish releases on this repo.

---

## 1. Connect the launcher to this repo (one-time)

- In **.env.local** (repo root) set:
  ```env
  GITHUB_REPO=deltaravo42/noverahub-launcher
  ```
  (Use your actual `owner/repo` for this launcher repo — no `https://` or `.git`.)

- Rebuild so the **installer** includes this: `npm run dist` from repo root.  
  The packaged app reads `GITHUB_REPO` from `build-config.json` (written at build time from `.env.local`).

**Note:** If the app currently installed on your PC (e.g. 1.0.2) was built **without** `GITHUB_REPO`, “Check for updates” will say “No GitHub repo configured.” In that case, install the new build (e.g. **NoveraHub Launcher Setup 1.0.3.exe**) once; from then on, that install will use GitHub to find future updates.

## 2. Bump version and build

- In **package.json** set `"version": "1.1.x"` (e.g. 1.1.0).
- From repo root:
  ```bash
  npm run dist
  ```
- Installer output: **dist/NoveraHub Launcher Setup 1.1.x.exe**.

## 3. Tag and push (Git)

From repo root:

```bash
git add -A
git commit -m "Release launcher v1.0.x"
git tag v1.0.x
git push origin main
git push origin v1.0.x
```

(Replace `1.1.x` with the real version, e.g. `1.1.0`.)

## 4. Create GitHub Release

1. Open **https://github.com/deltaravo42/noverahub-launcher/releases** (this repo).
2. Click **Draft a new release**.
3. **Choose a tag:** pick the tag you pushed (e.g. `v1.1.0`).
4. **Release title:** e.g. `Novera Hub Launcher v1.1.0`.
5. **Description:** paste your release notes (new features, fixes).
6. **Attach:** upload **NoveraHub Launcher Setup 1.1.0.exe** from `dist/`.
7. Click **Publish release**.

## 5. Updating the installed app

- **Option A:** In the installed launcher: **Menu → Check for updates**. If a newer version exists, the dialog offers **Download & install** (downloads and runs the installer from inside the launcher) or **Open release page** in the browser.
- **Option B:** Download the new installer from the GitHub release and run it (overwrites the old install).

---

**Summary:** The launcher checks GitHub when the user clicks **Check for updates** (public API, no token). When an update is available, users can **Download & install** from inside the app or open the release page. The **built** app must have `GITHUB_REPO` set (via `.env.local` before `npm run dist`), and you must publish a **GitHub Release** with a **version tag** (e.g. `v1.1.0`) and the attached Setup exe.
