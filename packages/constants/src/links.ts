// Links shown to people. Display only: the installer and the updater keep their
// own fixed sources, so nothing here decides where code is downloaded from.
export const SITE_URL = 'https://p2pacademy.cc';
export const INSTALL_SH_URL = `${SITE_URL}/install.sh`;
export const INSTALL_PS1_URL = `${SITE_URL}/install.ps1`;

export const INSTALL_COMMANDS = {
  unix: `curl -fsSL ${INSTALL_SH_URL} | sh`,
  windows: `irm ${INSTALL_PS1_URL} | iex`,
} as const;

export const REPO_URL = 'https://github.com/thisonedev/p2p-academy';
export const REPO_GIT_URL = `${REPO_URL}.git`;
export const X_URL = 'https://x.com/thisp2pacademy';
export const CONTACT_URL = 'https://thisonedev.github.io/';
