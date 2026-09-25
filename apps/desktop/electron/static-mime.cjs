'use strict';

const { mimeFor } = require('../shared/lesson-preview.cjs');

// Next's static export fetches each route's data as index.txt and treats it as route data only
// when it is served as text/plain. Anything else turns every in-app link into a full page reload.
function staticMimeFor(p) {
  return /\.txt$/i.test(String(p || '')) ? 'text/plain; charset=utf-8' : mimeFor(p);
}

module.exports = { staticMimeFor };
