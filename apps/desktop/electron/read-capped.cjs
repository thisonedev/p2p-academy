'use strict';

const fs = require('node:fs');

// Reads a regular file of at most maxBytes, or returns null. It checks the size and reads
// through one open handle, and reads only the size it checked.
async function readFileCapped(file, maxBytes) {
  let handle;
  try {
    handle = await fs.promises.open(file, 'r');
  } catch {
    return null;
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const buf = Buffer.alloc(stat.size);
    const { bytesRead } = await handle.read(buf, 0, stat.size, 0);
    return buf.subarray(0, bytesRead);
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}

module.exports = { readFileCapped };
