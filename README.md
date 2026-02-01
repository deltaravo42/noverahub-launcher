# Novera Hub Launcher

**Novera Hub Launcher** is a standalone desktop app that lets you open **Novera Hub** in one click. You sign in with the same credentials as the main Novera Hub app, then use **Launch** to open the Hub in a new window. Your session is kept so you stay logged in until you log out or it expires.

## What is Novera Hub?

**Novera Hub** is the main web application. The launcher is a separate, small desktop app that talks to Novera Hub (e.g. at noverahub.com or your own instance) and opens it for you.

## What the launcher does

1. **Log in** — Use your Novera Hub username and time-based password. On success, the launcher stores your session so you stay logged in across restarts (e.g. until you log out or the session expires, typically 30 days).

2. **Launch Novera Hub** — Opens a new window with the main Novera Hub interface. If you’re already logged in, you go straight to the app; otherwise the Hub shows the login page.

3. **Notices, Events, News** — The launcher can show content (notices, events, news) provided by the Hub. Admins manage this in **Admin → Launcher manager**. Use **Menu → Refresh content** to reload without restarting the launcher.

## Updates from GitHub

The launcher is **connected to GitHub**. When you publish a new release on [deltaravo42/noverahub-launcher](https://github.com/deltaravo42/noverahub-launcher), users get it from inside the app:

- **Menu → Check for updates** — Checks GitHub for a newer version. If one exists, a dialog appears with the new version number.
- **Download & install** — Downloads the Windows Setup exe from the release and runs it (update without opening the browser).
- **Open release page** — Opens the GitHub release page in the browser so users can download manually.

The launcher also checks for updates in the background when it starts; if a new version is available, a toast appears: *Update available — open the menu to download & install.*

**For maintainers:** Publish releases on GitHub with a version tag (e.g. `v1.1.1`) and attach **NoveraHub Launcher Setup X.X.X.exe** from your build `dist/` folder. The launcher compares the release tag to the installed version and shows "Update available" when a newer release exists.

## How the launcher is connected

The launcher uses only two settings:

- **HUB_URL** — Where your Novera Hub is deployed (e.g. `https://noverahub.com`). The launcher connects here for login, launch, and content (notices/events/news). Your **Hub** (the web app) uses Turso, Pusher, R2, NEXTAUTH, etc. — the launcher does not talk to those directly. It talks to the Hub, and the Hub uses your database and services.
- **GITHUB_REPO** — The launcher repo for **Check for updates** (e.g. `deltaravo42/noverahub-launcher`).

So the launcher is already connected to your backend and database **through HUB_URL**: set `HUB_URL` to your Hub’s URL, and users who use the launcher are using your Turso, Pusher, R2, and the rest of your stack via the Hub.

## About this repo

This repository contains only the **launcher** (the desktop app). The main Novera Hub application lives in a separate repository.
