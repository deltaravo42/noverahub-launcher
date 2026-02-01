(function () {
  'use strict';

  if (typeof window.launcher === 'undefined') {
    console.error('Launcher API not available.');
    return;
  }

  var launcher = window.launcher;
  var hubUrl = '';

  function run() {
    var btnLaunch = document.getElementById('btn-launch');
    var btnLogin = document.getElementById('btn-login');
    var btnMinimize = document.getElementById('btn-minimize');
    var btnMaximize = document.getElementById('btn-maximize');
    var btnClose = document.getElementById('btn-close');
    var loginOverlay = document.getElementById('login-overlay');
    var loginForm = document.getElementById('login-form');
    var loginUsername = document.getElementById('login-username');
    var loginPassword = document.getElementById('login-password');
    var loginSubmit = document.getElementById('login-submit');
    var loginBack = document.getElementById('login-back');
    var loginError = document.getElementById('login-error');
    var serverTimeDisplay = document.getElementById('server-time-display');
    var serverTimePart = document.getElementById('server-time-part');
    var loginPasswordHint = document.getElementById('login-password-hint');
    var versionEl = document.getElementById('version');
    var linkHub = document.getElementById('link-hub');

    var userAreaGuest = document.getElementById('user-area-guest');
    var userAreaLoggedIn = document.getElementById('user-area-logged-in');
    var topUserAvatar = document.getElementById('top-user-avatar');
    var topUserName = document.getElementById('top-user-name');
    var userMenuTrigger = document.getElementById('user-menu-trigger');
    var userMenuDropdown = document.getElementById('user-menu-dropdown');
    var userMenuLaunch = document.getElementById('user-menu-launch');
    var userMenuLogout = document.getElementById('user-menu-logout');
    var sidebarAvatar = document.getElementById('user-avatar');
    var sidebarUserLabel = document.getElementById('user-label');
    var sidebarStatus = document.getElementById('sidebar-status');
    var toastEl = document.getElementById('toast');
    var toastTimer = null;

    function setToast(msg, durationMs) {
      if (!toastEl) return;
      if (toastTimer) clearTimeout(toastTimer);
      toastEl.textContent = msg || '';
      toastEl.removeAttribute('hidden');
      toastTimer = setTimeout(function () {
        toastEl.setAttribute('hidden', '');
        toastTimer = null;
      }, durationMs != null ? durationMs : 3000);
    }

    var isLoggedIn = false;

    launcher.getConfig().then(function (config) {
      hubUrl = (config.hubUrl || 'https://noverahub.com').replace(/\/$/, '');
      var ver = 'v' + (config.version || '1.0.0');
      if (versionEl) versionEl.textContent = ver;
      if (document.getElementById('about-version')) document.getElementById('about-version').textContent = ver;
      if (hubUrl) {
        startServerTime();
        fetchLauncherContent();
        launcher.getProfile().then(function (profile) {
          if (profile) setUserUI(profile);
          else fetchProfile().then(setUserUI);
        });
      }
      if (config.githubRepo) {
        setTimeout(function () {
          launcher.checkForUpdates().then(function (result) {
            lastUpdateResult = result;
            if (result.hasUpdate) setToast('Update available — open the menu to download & install.');
          }).catch(function () {});
        }, 2500);
      }
    }).catch(function () {
      hubUrl = 'https://noverahub.com';
      if (versionEl) versionEl.textContent = 'v1.0.0';
      startServerTime();
      fetchLauncherContent();
      launcher.getProfile().then(function (profile) {
        if (profile) setUserUI(profile);
        else fetchProfile().then(setUserUI);
      });
    });

    var launcherContent = { notices: [], events: [], news: [] };

    function fetchLauncherContent() {
      if (!hubUrl) return Promise.resolve();
      return fetch(hubUrl + '/api/launcher/content', { credentials: 'include' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (!data) return;
          var listEl = document.getElementById('news-list');
          if (listEl) {
            var notices = data.notices || [];
            var events = data.events || [];
            var news = data.news || [];
            launcherContent.notices = notices;
            launcherContent.events = events;
            launcherContent.news = news;
            var html = '';
            notices.forEach(function (n, i) {
              html += '<div class="news-item" data-tab="notices" data-type="notices" data-index="' + i + '"><span class="news-item-title">' + escapeHtml(n.title) + '</span><span class="news-item-date">' + escapeHtml(n.date_label || '—') + '</span></div>';
            });
            events.forEach(function (e, i) {
              html += '<div class="news-item" data-tab="events" data-type="events" data-index="' + i + '"><span class="news-item-title">' + escapeHtml(e.title) + '</span><span class="news-item-date">' + escapeHtml(e.date_label || '—') + '</span></div>';
            });
            news.forEach(function (n, i) {
              html += '<div class="news-item" data-tab="news" data-type="news" data-index="' + i + '"><span class="news-item-title">' + escapeHtml(n.title) + '</span><span class="news-item-date">' + escapeHtml(n.date_label || '—') + '</span></div>';
            });
            if (!html) html = '<div class="news-item" data-tab="notices"><span class="news-item-title">No items yet</span><span class="news-item-date">—</span></div>';
            listEl.innerHTML = html;
            setActiveTab('notices');
          }
          var getStarted = (data.getStarted && data.getStarted.length > 0) ? data.getStarted[0] : null;
          var labelEl = document.getElementById('promo-label');
          var titleEl = document.getElementById('promo-title');
          var descEl = document.getElementById('promo-desc');
          if (getStarted) {
            if (labelEl) labelEl.textContent = getStarted.label || 'GET STARTED';
            if (titleEl) titleEl.textContent = getStarted.title || 'Open Novera Hub';
            if (descEl) descEl.textContent = getStarted.description || 'Log in here, then click Launch to open Novera Hub.';
          }
        })
        .catch(function () {
          launcherContent.notices = [];
          launcherContent.events = [];
          launcherContent.news = [];
          var listEl = document.getElementById('news-list');
          if (listEl && listEl.querySelector('.news-item-placeholder')) {
            listEl.innerHTML = '<div class="news-item" data-tab="notices"><span class="news-item-title">Welcome to Novera Hub Launcher</span><span class="news-item-date">—</span></div><div class="news-item" data-tab="notices"><span class="news-item-title">Log in in the launcher first, then click Launch to open the app</span><span class="news-item-date">—</span></div><div class="news-item" data-tab="events"><span class="news-item-title">Novera Hub — Cloud storage &amp; RovaChat</span><span class="news-item-date">—</span></div><div class="news-item" data-tab="news"><span class="news-item-title">Launcher</span><span class="news-item-date">' + (versionEl ? versionEl.textContent : 'v1.0.0') + '</span></div>';
            setActiveTab('notices');
          }
        });
    }

    var itemDetailOverlay = document.getElementById('item-detail-overlay');
    var itemDetailBadge = document.getElementById('item-detail-badge');
    var itemDetailDate = document.getElementById('item-detail-date');
    var itemDetailTitle = document.getElementById('item-detail-title');
    var itemDetailBody = document.getElementById('item-detail-body');
    var itemDetailClose = document.getElementById('item-detail-close');
    var itemDetailBackdrop = document.querySelector('.item-detail-backdrop');

    function showItemDetail(item, type) {
      if (!item || !itemDetailOverlay) return;
      var badgeLabel = type === 'notices' ? 'Notices' : type === 'events' ? 'Events' : 'News';
      if (itemDetailBadge) itemDetailBadge.textContent = badgeLabel;
      if (itemDetailDate) itemDetailDate.textContent = (item.date_label && item.date_label.trim()) ? item.date_label : '—';
      if (itemDetailTitle) itemDetailTitle.textContent = (item.title && item.title.trim()) ? item.title : 'Untitled';
      if (itemDetailBody) {
        var body = (item.body && item.body.trim()) ? item.body : '';
        itemDetailBody.textContent = body || 'No details.';
      }
      itemDetailOverlay.removeAttribute('hidden');
    }

    function hideItemDetail() {
      if (itemDetailOverlay) itemDetailOverlay.setAttribute('hidden', '');
    }

    if (itemDetailClose) itemDetailClose.addEventListener('click', function (e) { e.preventDefault(); hideItemDetail(); });
    if (itemDetailBackdrop) itemDetailBackdrop.addEventListener('click', hideItemDetail);

    var newsListEl = document.getElementById('news-list');
    if (newsListEl) {
      newsListEl.addEventListener('click', function (e) {
        var itemEl = e.target.closest('.news-item');
        if (!itemEl) return;
        var type = itemEl.getAttribute('data-type');
        var index = itemEl.getAttribute('data-index');
        if (type && index !== null && launcherContent[type]) {
          var idx = parseInt(index, 10);
          if (!Number.isNaN(idx) && launcherContent[type][idx]) showItemDetail(launcherContent[type][idx], type);
        }
      });
    }

    function escapeHtml(s) {
      if (s == null) return '';
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    launcher.onLoggedOut(function () { setUserUI(null); });

    function fetchProfile() {
      if (!hubUrl) return Promise.resolve(null);
      return fetch(hubUrl + '/api/profile', { credentials: 'include' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
    }

    function getInitials(name) {
      if (!name || !name.trim()) return '?';
      var parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.trim().substring(0, 2).toUpperCase();
    }

    function setUserUI(user) {
      isLoggedIn = !!user;
      if (user) {
        var displayName = user.display_name || user.username || 'User';
        var initials = getInitials(displayName);
        var avatarSrc = hubUrl ? (hubUrl + '/api/profile/avatar') : '';
        function avatarFallback(el) {
          if (el) { el.innerHTML = ''; el.textContent = initials; }
        }
        if (sidebarAvatar) {
          if (avatarSrc) {
            var sideImg = document.createElement('img');
            sideImg.src = avatarSrc;
            sideImg.alt = '';
            sideImg.onerror = function () { avatarFallback(sidebarAvatar); };
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(sideImg);
          } else {
            sidebarAvatar.textContent = initials;
          }
        }
        if (sidebarUserLabel) sidebarUserLabel.textContent = displayName;
        if (topUserAvatar) {
          if (avatarSrc) {
            var topImg = document.createElement('img');
            topImg.src = avatarSrc;
            topImg.alt = '';
            topImg.onerror = function () { avatarFallback(topUserAvatar); };
            topUserAvatar.innerHTML = '';
            topUserAvatar.appendChild(topImg);
          } else {
            topUserAvatar.textContent = initials;
          }
        }
        if (topUserName) topUserName.textContent = displayName;
        if (sidebarStatus) sidebarStatus.textContent = 'Signed in';
        if (userAreaGuest) userAreaGuest.setAttribute('hidden', '');
        if (userAreaLoggedIn) userAreaLoggedIn.removeAttribute('hidden');
      } else {
        if (sidebarAvatar) {
          sidebarAvatar.innerHTML = '';
          sidebarAvatar.textContent = 'NH';
        }
        if (sidebarUserLabel) sidebarUserLabel.textContent = 'Guest';
        if (sidebarStatus) sidebarStatus.textContent = 'Not signed in';
        if (topUserAvatar) {
          topUserAvatar.innerHTML = '';
          topUserAvatar.textContent = '—';
        }
        if (topUserName) topUserName.textContent = 'User';
        if (userAreaGuest) userAreaGuest.removeAttribute('hidden');
        if (userAreaLoggedIn) userAreaLoggedIn.setAttribute('hidden', '');
        if (userMenuDropdown) userMenuDropdown.setAttribute('hidden', '');
        if (userMenuTrigger) userMenuTrigger.setAttribute('aria-expanded', 'false');
      }
      setLaunchState(isLoggedIn);
    }

    function setLaunchState(loggedIn) {
      var launchLabel = btnLaunch ? btnLaunch.querySelector('span') : null;
      if (btnLaunch) {
        if (loggedIn) {
          btnLaunch.classList.remove('btn-launch--guest');
          btnLaunch.title = 'Open Novera Hub';
          if (launchLabel) launchLabel.textContent = 'Launch';
        } else {
          btnLaunch.classList.add('btn-launch--guest');
          btnLaunch.title = 'Log in first to launch Novera Hub';
          if (launchLabel) launchLabel.textContent = 'Log in to Launch';
        }
      }
      if (linkHub) {
        linkHub.title = loggedIn ? 'Open Novera Hub' : 'Log in first to open Novera Hub';
      }
      if (btnMenu) {
        btnMenu.title = loggedIn ? 'Menu' : 'Log in first';
      }
    }

    function closeUserMenu() {
      if (userMenuDropdown) userMenuDropdown.setAttribute('hidden', '');
      if (userMenuTrigger) userMenuTrigger.setAttribute('aria-expanded', 'false');
    }

    if (userMenuTrigger && userMenuDropdown) {
      userMenuTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = userMenuDropdown.getAttribute('hidden') === null;
        if (open) {
          userMenuDropdown.setAttribute('hidden', '');
          userMenuTrigger.setAttribute('aria-expanded', 'false');
        } else {
          userMenuDropdown.removeAttribute('hidden');
          userMenuTrigger.setAttribute('aria-expanded', 'true');
        }
      });
    }
    document.addEventListener('click', function () {
      closeUserMenu();
      closeMainMenu();
    });
    if (userMenuDropdown) {
      userMenuDropdown.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    if (userMenuLaunch) {
      userMenuLaunch.addEventListener('click', function (e) {
        e.preventDefault();
        closeUserMenu();
        launcher.openHubWindow('/app');
      });
    }
    if (userMenuLogout) {
      userMenuLogout.addEventListener('click', function (e) {
        e.preventDefault();
        closeUserMenu();
        launcher.logout().then(function () { setUserUI(null); }).catch(function () { setUserUI(null); });
      });
    }

    function showLogin(show) {
      if (!loginOverlay) return;
      if (show) {
        loginOverlay.removeAttribute('hidden');
        if (loginUsername) loginUsername.focus();
      } else {
        loginOverlay.setAttribute('hidden', '');
      }
    }

    function setError(msg) {
      if (!loginError) return;
      if (msg) {
        loginError.textContent = msg;
        loginError.removeAttribute('hidden');
      } else {
        loginError.textContent = '';
        loginError.setAttribute('hidden', '');
      }
    }

    function updatePasswordHint() {
      if (!serverTimePart || !loginPasswordHint) return;
      var part = serverTimePart.textContent;
      if (part === '—') return;
      var u = (loginUsername && loginUsername.value || '').trim().toLowerCase();
      if (u === 'nhadmin') {
        loginPasswordHint.textContent = 'Admin: NHA + 4-digit time, e.g. NHA' + part + ' (digits only)';
      } else if (u) {
        var first = u.charAt(0).toUpperCase();
        loginPasswordHint.textContent = 'First letter of username + time (e.g. ' + first + part + ')';
      } else {
        loginPasswordHint.textContent = 'First letter of username + time (e.g. J1230)';
      }
    }

    function startServerTime() {
      if (!hubUrl) return;
      function fetchTime() {
        if (!hubUrl) return;
        fetch(hubUrl + '/api/auth/time', { credentials: 'include' })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) {
            if (!data) return;
            if (serverTimeDisplay) serverTimeDisplay.textContent = data.display || '—';
            if (serverTimePart) serverTimePart.textContent = data.timePart || '—';
            updatePasswordHint();
          })
          .catch(function () {
            var now = new Date();
            var h = now.getHours();
            var m = now.getMinutes();
            var s = now.getSeconds();
            var pad = function (n) { return (n < 10 ? '0' : '') + n; };
            var timePart = pad(h) + pad(m);
            var display = pad(h) + ':' + pad(m) + ':' + pad(s);
            if (serverTimeDisplay) serverTimeDisplay.textContent = display;
            if (serverTimePart) serverTimePart.textContent = timePart;
            updatePasswordHint();
          });
      }
      fetchTime();
      setInterval(fetchTime, 1000);
    }

    if (btnLaunch) {
      btnLaunch.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isLoggedIn) {
          launcher.openHubWindow('/app');
        } else {
          showLogin(true);
        }
      });
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showLogin(true);
      });
    }

    if (btnMinimize) {
      btnMinimize.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); launcher.minimize(); });
    }
    if (btnMaximize) {
      btnMaximize.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); launcher.maximize(); });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); launcher.close(); });
    }

    var btnMenu = document.getElementById('btn-menu');
    var mainMenuDropdown = document.getElementById('main-menu-dropdown');
    var mainMenuLaunch = document.getElementById('main-menu-launch');
    var mainMenuRefreshContent = document.getElementById('main-menu-refresh-content');
    var mainMenuCheckUpdates = document.getElementById('main-menu-check-updates');
    var mainMenuAbout = document.getElementById('main-menu-about');

    function closeMainMenu() {
      if (mainMenuDropdown) mainMenuDropdown.setAttribute('hidden', '');
      if (btnMenu) btnMenu.setAttribute('aria-expanded', 'false');
    }

    if (btnMenu && mainMenuDropdown) {
      btnMenu.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = mainMenuDropdown.hasAttribute('hidden') === false;
        if (isOpen) {
          closeMainMenu();
        } else {
          mainMenuDropdown.removeAttribute('hidden');
          btnMenu.setAttribute('aria-expanded', 'true');
        }
      });
    }
    document.addEventListener('click', function () { closeMainMenu(); });
    if (mainMenuDropdown) {
      mainMenuDropdown.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    if (mainMenuLaunch) {
      mainMenuLaunch.addEventListener('click', function (e) {
        e.preventDefault();
        closeMainMenu();
        if (isLoggedIn) launcher.openHubWindow('/app');
        else showLogin(true);
      });
    }
    var aboutOverlay = document.getElementById('about-overlay');
    var aboutClose = document.getElementById('about-close');
    var aboutVersionEl = document.getElementById('about-version');
    var updateAvailableEl = document.getElementById('update-available');
    var updateMessageEl = document.getElementById('update-message');
    var updateDownloadInstallBtn = document.getElementById('update-download-install');
    var updateOpenPageBtn = document.getElementById('update-open-page');
    var updateDismissBtn = document.getElementById('update-dismiss');
    var pendingReleaseUrl = '';
    var pendingDownloadUrl = '';
    var aboutUpdateStatus = document.getElementById('about-update-status');
    var aboutCheckUpdatesBtn = document.getElementById('about-check-updates');
    var lastUpdateResult = null;

    function setAboutUpdateStatus(text) {
      if (aboutUpdateStatus) aboutUpdateStatus.textContent = text || '—';
    }

    function doCheckForUpdates(fromAbout) {
      setToast('Checking for updates…');
      if (fromAbout) setAboutUpdateStatus('Checking…');
      launcher.checkForUpdates()
        .then(function (result) {
          lastUpdateResult = result;
          if (result.hasUpdate) {
            var av = (result.latestVersion || '').match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
            var avStr = av ? ('v' + av[1]) : (result.latestVersion ? ('v' + String(result.latestVersion).replace(/^v/i, '')) : '');
            setToast('Update available: ' + avStr);
            setAboutUpdateStatus('Update available: ' + avStr + ' — click Download & install in the dialog.');
            showUpdateAvailable(result);
          } else if (result.error) {
            setToast(result.error, 6000);
            setAboutUpdateStatus(result.error);
          } else {
            var raw = result.latestVersion ? String(result.latestVersion) : '';
            var verMatch = raw.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
            var latest = verMatch ? ('v' + verMatch[1]) : (raw ? ('v' + raw.replace(/^v/i, '')) : (versionEl ? versionEl.textContent : 'v1.0.0'));
            setToast('You\'re on the latest version (' + latest + ').');
            setAboutUpdateStatus('You\'re on the latest version (' + latest + ').');
          }
        })
        .catch(function (err) {
          var msg = (err && err.message) ? err.message : 'Could not check for updates.';
          setToast(msg, 6000);
          setAboutUpdateStatus(msg);
          lastUpdateResult = { error: msg };
        });
    }

    function showAbout() {
      if (aboutVersionEl && versionEl) aboutVersionEl.textContent = versionEl.textContent;
      if (lastUpdateResult) {
        if (lastUpdateResult.hasUpdate) {
          var u = (lastUpdateResult.latestVersion || '').match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
          setAboutUpdateStatus('Update available: ' + (u ? 'v' + u[1] : (lastUpdateResult.latestVersion || '')));
        }
        else if (lastUpdateResult.error) setAboutUpdateStatus(lastUpdateResult.error);
        else {
          var r = lastUpdateResult.latestVersion || lastUpdateResult.currentVersion || '';
          var m = String(r).match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
          setAboutUpdateStatus('You\'re on the latest version (' + (m ? 'v' + m[1] : r || '—') + ').');
        }
      } else {
        setAboutUpdateStatus('Click "Check for updates" to see if a new version is available.');
      }
      if (aboutOverlay) aboutOverlay.removeAttribute('hidden');
    }
    function hideAbout() {
      if (aboutOverlay) aboutOverlay.setAttribute('hidden', '');
    }
    function showUpdateAvailable(result) {
      pendingReleaseUrl = result.releaseUrl || '';
      pendingDownloadUrl = result.downloadUrl || '';
      if (updateMessageEl) {
        var current = versionEl ? versionEl.textContent : 'v1.0.0';
        var newVer = (result.latestVersion || '').match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
        var newStr = newVer ? ('v' + newVer[1]) : (result.latestVersion || '');
        updateMessageEl.textContent = 'Version ' + newStr + ' is available. You have ' + current + '.';
      }
      if (updateAvailableEl) updateAvailableEl.removeAttribute('hidden');
    }
    function hideUpdateAvailable() {
      if (updateAvailableEl) updateAvailableEl.setAttribute('hidden', '');
      pendingReleaseUrl = '';
      pendingDownloadUrl = '';
    }

    if (aboutClose) aboutClose.addEventListener('click', function (e) { e.preventDefault(); hideAbout(); });
    if (aboutOverlay) {
      var aboutBackdrop = aboutOverlay.querySelector('.about-backdrop');
      if (aboutBackdrop) aboutBackdrop.addEventListener('click', hideAbout);
    }
    if (updateDismissBtn) updateDismissBtn.addEventListener('click', function (e) { e.preventDefault(); hideUpdateAvailable(); });
    if (updateAvailableEl) {
      var updateBackdrop = updateAvailableEl.querySelector('.update-backdrop');
      if (updateBackdrop) updateBackdrop.addEventListener('click', hideUpdateAvailable);
    }
    if (updateDownloadInstallBtn) {
      updateDownloadInstallBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (pendingDownloadUrl) {
          setToast('Downloading installer…');
          updateDownloadInstallBtn.disabled = true;
          launcher.downloadAndRunUpdate(pendingDownloadUrl)
            .then(function (res) {
              updateDownloadInstallBtn.disabled = false;
              if (res.success) {
                setToast('Opening installer. You can close the launcher and run it.', 5000);
                hideUpdateAvailable();
              } else {
                setToast(res.error || 'Download failed.', 6000);
              }
            })
            .catch(function (err) {
              updateDownloadInstallBtn.disabled = false;
              setToast((err && err.message) || 'Download failed.', 6000);
            });
        } else if (pendingReleaseUrl) {
          launcher.openExternal(pendingReleaseUrl);
          hideUpdateAvailable();
        }
      });
    }
    if (updateOpenPageBtn) {
      updateOpenPageBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (pendingReleaseUrl) launcher.openExternal(pendingReleaseUrl);
        hideUpdateAvailable();
      });
    }

    if (mainMenuRefreshContent) {
      mainMenuRefreshContent.addEventListener('click', function (e) {
        e.preventDefault();
        closeMainMenu();
        setToast('Refreshing…');
        (fetchLauncherContent() || Promise.resolve())
          .then(function () { setToast('Content refreshed'); })
          .catch(function () { setToast('Could not refresh content'); });
      });
    }
    if (mainMenuCheckUpdates) {
      mainMenuCheckUpdates.addEventListener('click', function (e) {
        e.preventDefault();
        closeMainMenu();
        doCheckForUpdates(false);
      });
    }
    if (aboutCheckUpdatesBtn) {
      aboutCheckUpdatesBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doCheckForUpdates(true);
      });
    }
    if (mainMenuAbout) {
      mainMenuAbout.addEventListener('click', function (e) {
        e.preventDefault();
        closeMainMenu();
        showAbout();
      });
    }

    var newsTabs = document.querySelectorAll('.news-tab');
    function setActiveTab(tabId) {
      newsTabs.forEach(function (tab) {
        if (tab.getAttribute('data-tab') === tabId) {
          tab.classList.add('news-tab-active');
        } else {
          tab.classList.remove('news-tab-active');
        }
      });
      var listEl = document.getElementById('news-list');
      var newsItems = listEl ? listEl.querySelectorAll('.news-item') : [];
      newsItems.forEach(function (item) {
        if (item.getAttribute('data-tab') === tabId) {
          item.classList.remove('news-item-hidden');
        } else {
          item.classList.add('news-item-hidden');
        }
      });
    }
    newsTabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.preventDefault();
        setActiveTab(tab.getAttribute('data-tab'));
      });
    });
    setActiveTab('notices');

    if (loginBack) {
      loginBack.addEventListener('click', function (e) {
        e.preventDefault();
        showLogin(false);
        setError('');
      });
    }

    if (loginUsername) {
      loginUsername.addEventListener('input', updatePasswordHint);
      loginUsername.addEventListener('change', updatePasswordHint);
    }

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var username = (loginUsername && loginUsername.value || '').trim();
        var password = loginPassword && loginPassword.value;
        setError('');
        if (!username || !password) {
          setError('Please enter username and password.');
          return;
        }
        loginSubmit.disabled = true;
        loginSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Signing in…</span>';
        launcher.login(username, password)
          .then(function (result) {
            loginSubmit.disabled = false;
            loginSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Sign in</span>';
            if (result && result.ok) {
              showLogin(false);
              loginForm.reset();
              setError('');
              var profile = result.profile;
              if (profile) {
                setUserUI(profile);
              } else {
                launcher.getProfile().then(function (p) { setUserUI(p || null); });
              }
              return;
            }
            var errMsg = (result && result.error) || 'Login failed. Please try again.';
            if (errMsg.toLowerCase().indexOf('database') !== -1 || errMsg.toLowerCase().indexOf('not connected') !== -1) {
              errMsg += ' The Novera Hub server cannot reach its database — check the Hub app\'s Turso/database configuration and that it is running.';
            }
            setError(errMsg);
          })
          .catch(function () {
            loginSubmit.disabled = false;
            loginSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Sign in</span>';
            setError('Network error. Please try again.');
          });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
