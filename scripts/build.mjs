import { cp, mkdir, rm } from 'node:fs/promises';

const DIST_DIR = 'dist';

await rm(DIST_DIR, {
  recursive: true,
  force: true,
});

await mkdir(DIST_DIR, {
  recursive: true,
});

await cp('src', `${DIST_DIR}/src`, {
  recursive: true,
});

await cp('manifest.json', `${DIST_DIR}/manifest.json`);

console.log('[BUILD] Extension created in dist/');
