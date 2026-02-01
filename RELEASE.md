# Releasing Novera Hub Launcher

Use this checklist so the **installed app** (e.g. 1.0.2 at `C:\...\NoveraHub Launcher`) can see and offer new versions via **Menu → Check for updates**.

## What’s in the build (so the launcher can update)

When you run `npm run dist`, the launcher is **connected to your GitHub repo** by including:

- **GITHUB_REPO** — e.g. `deltaravo42/noverahub-launcher`. This is read from **.env.local** (repo root) at build time and written into **build-config.json**, which is packaged into the app. Every installed launcher then knows which repo to check for new releases.
- **HUB_URL** — same way, so the launcher knows where to log in and load content.

**No GitHub token is (or should be) in the build.** For a **public** repo, no token is needed: GitHub’s API lets anyone list public releases. For a **private** repo, each user puts their own token in `launcher-config.json` on their PC (see README); the build stays the same for everyone.

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

- In **package.json** set `"version": "1.0.x"`.
- From repo root:
  ```bash
  npm run dist
  ```
- Installer output: **dist/NoveraHub Launcher Setup 1.0.x.exe**.

## 3. Tag and push (Git)

From repo root:

```bash
git add -A
git commit -m "Release launcher v1.0.x"
git tag v1.0.x
git push origin main
git push origin v1.0.x
```

(Replace `1.0.x` with the real version, e.g. `1.0.3`.)

## 4. Create GitHub Release

1. Open **https://github.com/deltaravo42/noverahub-launcher/releases** (this repo).
2. Click **Draft a new release**.
3. **Choose a tag:** pick the tag you pushed (e.g. `v1.0.3`).
4. **Release title:** e.g. `Novera Hub Launcher v1.0.3`.
5. **Description:** paste your release notes (new features, fixes).
6. **Attach:** upload **NoveraHub Launcher Setup 1.0.3.exe** from `dist/`.
7. Click **Publish release**.

## 5. Updating the installed app

- **Option A:** In the installed launcher: **Menu → Check for updates**. If a release with a **newer** version tag exists on GitHub, it will show “Update available” and a link to the release page; download and run the new installer.
- **Option B:** Download the new installer from the GitHub release and run it (overwrites the old install).

---

**Summary:** The launcher does **not** auto-update in the background. It only checks GitHub when the user clicks “Check for updates” and then opens the release page so they can download the new installer. For that to work, the **built** app must have `GITHUB_REPO` set (via `.env.local` before `npm run dist`), and you must publish a **GitHub Release** on **this repo** with a **version tag** (e.g. `v1.0.3`) and the attached Setup exe.
