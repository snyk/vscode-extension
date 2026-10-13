/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const mediaDir = path.join(repoRoot, 'media');

function deleteCssFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleteCssFiles(fullPath);
    } else if (entry.name.endsWith('.css')) {
      fs.unlinkSync(fullPath);
    }
  }
}

deleteCssFiles(mediaDir);

try {
  execSync('sass media --no-source-map --no-error-css --stop-on-error', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
} catch {
  deleteCssFiles(mediaDir);
  process.exit(1);
}
