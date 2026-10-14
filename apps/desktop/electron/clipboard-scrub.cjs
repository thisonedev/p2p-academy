'use strict';

// Copies text, then clears the clipboard after scrubAfterMs if it still holds that text.
// Awaits the clipboard read and write, which return Promises since Electron 44.
async function copyWithScrub(clipboard, text, scrubAfterMs) {
  await clipboard.writeText(text);
  if (scrubAfterMs > 0) {
    const timer = setTimeout(async () => {
      try {
        if ((await clipboard.readText()) === text) clipboard.clear();
      } catch {
        // An unreadable clipboard may still hold the text, so clear it.
        clipboard.clear();
      }
    }, scrubAfterMs);
    // A pending scrub is not a reason to keep the app alive.
    if (typeof timer.unref === 'function') timer.unref();
  }
  return true;
}

module.exports = { copyWithScrub };
