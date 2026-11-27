#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check-only');

function parseDotEnv(filename) {
  if (!existsSync(filename)) return {};
  const parsed = {};
  for (const rawLine of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/^[A-Z0-9_]+$/.test(key)) parsed[key] = value;
  }
  return parsed;
}

function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`[PVPT:NODE_REQUIRED] Node.js >= 22.13 is required (found ${process.versions.node}).`);
    process.exit(1);
  }
}

function ensureDependencies() {
  const expressPkg = path.join(rootDir, 'node_modules', 'express', 'package.json');
  if (existsSync(expressPkg)) return;
  console.log('[PVPT] Installing Node.js dependencies (first run)...');
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmBin, ['install', '--no-audit', '--no-fund'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error('[PVPT:NPM_INSTALL_FAILED] Could not install dependencies from package.json.');
    process.exit(1);
  }
}

function validateScenarioBank(bankPath) {
  let db;
  try {
    db = new DatabaseSync(bankPath, { readOnly: true });
    const releaseRow = db.prepare("SELECT payload FROM scenario_bank_view WHERE view_id = 'release'").get();
    const summaryRow = db.prepare("SELECT payload FROM scenario_bank_view WHERE view_id = 'summary'").get();
    if (!releaseRow || !summaryRow) {
      return { ok: false, reason: 'missing_required_views' };
    }
    const release = JSON.parse(releaseRow.payload);
    const summary = JSON.parse(summaryRow.payload);
    if (release.data_class !== 'DEMO_SYNTHETIC' || summary.scenarios !== 43200) {
      return { ok: false, reason: 'unexpected_bank_metadata' };
    }
    return { ok: true, scenarios: summary.scenarios };
  } catch (error) {
    return { ok: false, reason: error?.message || 'unreadable_sqlite_file' };
  } finally {
    try { db?.close(); } catch { /* ignore close error */ }
  }
}

function ensureScenarioBank(bankPath, pythonBin) {
  if (existsSync(bankPath)) {
    const check = validateScenarioBank(bankPath);
    if (!check.ok) {
      console.error(`[PVPT:INVALID_SCENARIO_BANK] Scenario bank at ${bankPath} is invalid (${check.reason}). Remove the corrupted file and re-run to rebuild from repository evidence. No fallback data will be generated.`);
      process.exit(1);
    }
    console.log(`[PVPT] Reusing existing verified scenario bank (${check.scenarios} scenarios): ${bankPath}`);
    return;
  }

  const pyCheck = spawnSync(pythonBin, ['--version'], { encoding: 'utf8' });
  const versionText = (pyCheck.stdout || pyCheck.stderr || '').trim();
  const match = versionText.match(/Python\s+(\d+)\.(\d+)/);
  if (pyCheck.error || pyCheck.status !== 0 || !match || Number(match[1]) < 3 || (Number(match[1]) === 3 && Number(match[2]) < 10)) {
    console.error(`[PVPT:PYTHON_REQUIRED] Python 3.10+ is required to build the scenario bank on first run (checked "${pythonBin}": ${versionText || pyCheck.error?.message || 'not found'}).`);
    process.exit(1);
  }

  mkdirSync(path.dirname(bankPath), { recursive: true, mode: 0o700 });
  console.log(`[PVPT] Building scenario bank from repository evidence via ${pythonBin}...`);
  const buildScript = path.join(rootDir, 'scenario-lab', 'build_bank.py');
  const build = spawnSync(pythonBin, [buildScript, '--db', bankPath], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (build.error || build.status !== 0) {
    console.error('[PVPT:BANK_BUILD_FAILED] Failed to build scenario bank from scenario-lab/build_bank.py.');
    process.exit(1);
  }

  const verified = validateScenarioBank(bankPath);
  if (!verified.ok) {
    console.error(`[PVPT:INVALID_SCENARIO_BANK] Newly built scenario bank failed verification (${verified.reason}).`);
    process.exit(1);
  }
  console.log(`[PVPT] Built and verified scenario bank (${verified.scenarios} scenarios): ${bankPath}`);
}

checkNodeVersion();

const fileEnv = parseDotEnv(path.join(rootDir, '.env'));
const mergedEnv = { ...fileEnv, ...process.env };
if (mergedEnv.DATABASE_URL) {
  console.warn('[PVPT] Ignoring legacy DATABASE_URL; runtime uses dual SQLite (PVPT_DATABASE_PATH & PVPT_TOTAL_DEMO_DB).');
}
delete mergedEnv.DATABASE_URL;

const port = String(mergedEnv.PORT || '3000');
const workspaceDbPath = mergedEnv.PVPT_DATABASE_PATH === ':memory:'
  ? ':memory:'
  : path.resolve(rootDir, mergedEnv.PVPT_DATABASE_PATH || '.pvpt/demo.sqlite');
const scenarioBankPath = path.resolve(rootDir, mergedEnv.PVPT_TOTAL_DEMO_DB || '.pvpt/total-demo.sqlite');
const pythonBin = mergedEnv.PVPT_PYTHON || 'python3';

ensureDependencies();
ensureScenarioBank(scenarioBankPath, pythonBin);

if (workspaceDbPath !== ':memory:') {
  mkdirSync(path.dirname(workspaceDbPath), { recursive: true, mode: 0o700 });
}

if (checkOnly) {
  console.log('[PVPT] Pre-flight checks passed.');
  process.exit(0);
}

const serverEnv = {
  ...mergedEnv,
  PORT: port,
  PVPT_DATABASE_PATH: workspaceDbPath,
  PVPT_TOTAL_DEMO_DB: scenarioBankPath,
};

console.log(`[PVPT] Starting server on http://127.0.0.1:${port} (Home: /, Total Demo: /demo/total-system/)`);
const child = spawn(process.execPath, [path.join(rootDir, 'server.js')], {
  cwd: rootDir,
  env: serverEnv,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  });
}

child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});
