/**
 * install.js — Install all dependencies (backend + frontend)
 * Run this once after cloning: node install.js
 */

const { execSync } = require('child_process');
const path = require('path');

const root     = __dirname;
const backend  = path.join(root, 'backend');
const frontend = path.join(root, 'frontend', 'frontend');

function run(cmd, cwd) {
  console.log(`\n▶  ${cmd}  (${path.relative(root, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

console.log('Installing all dependencies...\n');
run('npm install', backend);
run('npm install --legacy-peer-deps', frontend);
console.log('\n✅  All dependencies installed.\n');
