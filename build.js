/**
 * build.js — Cross-platform production build script
 *
 * 1. Installs backend dependencies
 * 2. Installs frontend dependencies
 * 3. Builds the React app into frontend/frontend/build/
 *
 * After this runs, `node backend/server.js` serves BOTH
 * the API and the React SPA from a single port.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure warnings are not treated as errors in CI environments
process.env.CI = 'false';

const root     = __dirname;
const backend  = path.join(root, 'backend');
const frontend = path.join(root, 'frontend', 'frontend');

function run(cmd, cwd) {
  console.log(`\n▶  ${cmd}  (in ${path.relative(root, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

console.log('═══════════════════════════════════════════');
console.log('  Jira Dashboard — Production Build');
console.log('═══════════════════════════════════════════');

// 1. Backend deps
run('npm install', backend);

// 2. Frontend deps
run('npm install --legacy-peer-deps', frontend);

// 3. Build React
run('npm run build', frontend);

// 4. Confirm output
const buildDir = path.join(frontend, 'build');
if (fs.existsSync(buildDir)) {
  console.log('\n✅  Build complete!');
  console.log(`   React build  →  ${buildDir}`);
  console.log('   Start the server with:  npm start');
  console.log('   Then open:              http://localhost:5000\n');
} else {
  console.error('\n❌  Build failed — frontend/frontend/build not found');
  process.exit(1);
}
