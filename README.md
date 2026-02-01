# Novera Hub Launcher

**Novera Hub Launcher** is a standalone desktop app that lets you open **Novera Hub** in one click. You sign in with the same credentials as the main Novera Hub app, then use **Launch** to open the Hub in a new window. Your session is kept so you stay logged in until you log out or it expires.

## What is Novera Hub?

**Novera Hub** is the main web application. The launcher is a separate, small desktop app that talks to Novera Hub (e.g. at noverahub.com or your own instance) and opens it for you.

## What the launcher does

1. **Log in** — Use your Novera Hub username and time-based password. On success, the launcher stores your session so you stay logged in across restarts (e.g. until you log out or the session expires, typically 30 days).

2. **Launch Novera Hub** — Opens a new window with the main Novera Hub interface. If you’re already logged in, you go straight to the app; otherwise the Hub shows the login page.

3. **Notices, Events, News** — The launcher can show content (notices, events, news) provided by the Hub. Admins manage this in **Admin → Launcher manager**. Use **Menu → Refresh content** to reload without restarting the launcher.

## About this repo

This repository contains only the **launcher** (the desktop app). The main Novera Hub application lives in a separate repository.
