import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');
function run(program, args) {
  const result = spawnSync(program, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
try { import.meta.resolve('express'); } catch {
  run(process.execPath, [process.env.npm_execpath, 'install', '--omit=dev', '--no-package-lock']);
}
const bank = resolve(process.env.PVPT_TOTAL_DEMO_DB || '.pvpt/total-demo.sqlite');
if (!existsSync(bank)) {
  const candidates = process.env.PYTHON ? [[process.env.PYTHON]] : [['python3'], ['py', '-3'], ['python']];
  const python = candidates.find(([cmd, ...args]) =>
    spawnSync(cmd, [...args, '-c', 'import sys;sys.exit(sys.version_info < (3,10))']).status === 0);
  if (!python) throw new Error('Python 3.10+ is required to build the scenario bank.');
  run(python[0], [...python.slice(1), 'scenario-lab/build_bank.py', '--db', bank]);
}
process.env.PVPT_HOST ||= '127.0.0.1';
console.log('PVPT: http://' + process.env.PVPT_HOST + ':' + (process.env.PORT || 3000) + '/demo/total-system/');
await import('../server.js');
