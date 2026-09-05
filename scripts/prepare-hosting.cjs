// Copy only reviewed public assets; no bundler or third-party dependencies.
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const outputDir = path.join(projectDir, 'dist');

// Add new runtime assets here explicitly. Never copy entire asset directories:
// they may contain private screenshots, backups, or development files.
const publicFiles = [
  'index.html',
  'styles.css',
  'dock.css',
  'auth.css',
  'app.js',
  'auth.js',
  'cloudSync.js',
  'stateSyncCore.js',
  'backupCore.js',
  'journalFilterCore.js',
  'firebaseConfig.js',
  'audioEngine.js',
  'dataEngine.js',
  'dock.js',
  'gallery.js',
  'longGameLogic.js',
  'manifest.json',
  'sw.js',
  'assets/tng_duitnow_qr.png'
];

// Validate before replacing the previous output. Reject symlinks, including
// parent directories, so a listed asset cannot silently point outside the repo.
for (const file of publicFiles) {
  let current = projectDir;
  for (const part of file.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Public asset must not use symlinks: ${file}`);
    }
  }
  if (!fs.statSync(current).isFile()) {
    throw new Error(`Public asset is not a file: ${file}`);
  }
}

if (fs.existsSync(outputDir) && fs.lstatSync(outputDir).isSymbolicLink()) {
  throw new Error('dist must be a generated directory, not a symlink.');
}
fs.rmSync(outputDir, { recursive: true, force: true });
for (const file of publicFiles) {
  const destination = path.join(outputDir, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(projectDir, file), destination);
}

console.log(`Prepared ${publicFiles.length} public files in dist/.`);
