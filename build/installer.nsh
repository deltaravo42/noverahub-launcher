; Custom NSIS macros for NoveraHub Launcher installer and uninstaller.
; See https://www.electron.build/configuration/nsis#custom-nsis-script
; Note: A "Choose desktop shortcut" page would require electron-builder to support
; inserting custom pages; for now the installer creates both desktop and Start Menu shortcuts.
; Users can remove the desktop shortcut after install if they prefer.

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to NoveraHub Launcher"
  !define MUI_WELCOMEPAGE_TEXT "This will install NoveraHub Launcher on your computer.$\r$\n$\r$\nSign in once in the launcher, then launch Novera Hub in one click.$\r$\n$\r$\nA desktop shortcut and a Start Menu shortcut will be created. You can remove either after install if you prefer.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall NoveraHub Launcher"
  !define MUI_WELCOMEPAGE_TEXT "This will remove NoveraHub Launcher from your computer.$\r$\n$\r$\nClick Uninstall to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
