'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'server', 'src'),
  path.join(ROOT, 'server', 'tests'),
  path.join(ROOT, 'scripts'),
];

function collectJsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const files = TARGETS.flatMap(collectJsFiles);
  for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  console.log(`Syntax check OK: ${files.length} files parsed with zero errors.`);
}

main();
