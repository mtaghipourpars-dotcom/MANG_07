"""Package a verified audit bank in an offline PVPT launcher for Windows x64."""
import argparse
import base64
from contextlib import closing
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import struct
import subprocess
import tarfile
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
NODE_VERSION = '22.23.1'
NODE_ARCHIVE = 'https://registry.npmjs.org/node-win-x64/-/node-win-x64-22.23.1.tgz'
NODE_SHA512 = 'bjZmNeCsAePhC515GTyU45qwl/Oau48jHoGy3dGhPVETQM8cgFMZ1SvnWaHqHW0621ncbGWud/wRRXlFgAjGYg=='
NODE_LICENSE = 'https://raw.githubusercontent.com/nodejs/node/v22.23.1/LICENSE'
SOURCE_DIRECTORIES = ('data/', 'demo/', 'docs/', 'public/', 'server/', 'scenario-lab/', 'DEV/', 'tests/', 'unit/')
SOURCE_FILES = {'server.js', 'package.json', '.env.example', 'README.md', 'playwright.config.js',
                'scripts/localhost.mjs', 'scripts/package-audit-release.py'}
WINDOWS_LAUNCHER = r'''@echo off
setlocal
cd /d "%~dp0"
set "PVPT_HOST=127.0.0.1"
set "PVPT_TOTAL_DEMO_DB=%~dp0.pvpt\total-demo.sqlite"
set "PVPT_DATABASE_PATH=%~dp0.pvpt\demo.sqlite"
echo Starting PVPT. Open the localhost address printed below.
"%~dp0runtime\node.exe" "%~dp0scripts\localhost.mjs"
if errorlevel 1 (
  echo PVPT could not start. Read the error above.
  pause
  exit /b 1
)
'''
GUIDE = '''# اجرای PVPT در ویندوز ۶۴ بیتی

1. کل بسته ZIP را در یک پوشه محلی که اجازه نوشتن در آن دارید استخراج کنید.
2. روی `Start-PVPT.cmd` دوبار کلیک کنید. از PowerShell نیز با
   `.\\Start-PVPT.cmd` اجرا می‌شود.
3. نشانی `http://127.0.0.1:3000/demo/total-system/` را در مرورگر باز کنید.
4. برای توقف، در پنجره برنامه Ctrl+C بزنید.

برای اجرای بسته نیازی به نصب Node.js، npm یا Python نیست. برنامه و بانک
آموزشی از فایل‌های بسته خوانده می‌شوند. تغییرات کاربر در
`.pvpt/demo.sqlite` و شواهد آزمون در `.pvpt/total-demo.sqlite` قرار دارند.
گزارش ممیزی و اطلاعات اعتبار بسته در پوشه `evidence` هستند.

برای مقایسه چک‌سام بسته در PowerShell از
`Get-FileHash .\\PVPT-Windows-x64.zip -Algorithm SHA256`
استفاده کنید و مقدار Hash را با فایل SHA256 مقایسه کنید.

اگر پورت ۳۰۰۰ در حال استفاده است، `.env.example` را به `.env` کپی کنید و
`PORT=3001` بگذارید. سپس نشانی چاپ‌شده در پنجره اجرا را باز کنید.
'''


def hash_file(path, algorithm='sha256'):
    digest = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest


def sha256(path):
    return hash_file(path).hexdigest()


def verify_bank(bank, evidence):
    report = json.loads(evidence.read_text(encoding='utf-8'))
    with closing(sqlite3.connect(bank.as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone() != ('ok',):
            raise ValueError('Audit bank integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchone():
            raise ValueError('Audit bank foreign key check failed')
        matching = db.execute(
            'SELECT source, expected_count, digest FROM educational_audit_run WHERE run_id=?',
            (report['run_id'],),
        ).fetchone()
        counts = dict(db.execute(
            'SELECT outcome, count(*) FROM educational_audit_test WHERE run_id=? GROUP BY outcome',
            (report['run_id'],),
        ))
        catalog_count = db.execute('SELECT count(*) FROM scenario').fetchone()[0]
        linked_count = db.execute("""
            SELECT count(*) FROM scenario s JOIN educational_audit_test t
              ON t.scenario_id=s.id AND t.test_id='HTTP-' || s.id AND t.stage=s.stage
            WHERE t.run_id=? AND t.outcome='PASS'
        """, (report['run_id'],)).fetchone()[0]
    if matching != (report['source'], report['expected'], report['database']['digest']):
        raise ValueError('The run report does not identify the bank run')
    if counts != {'PASS': report['expected']} or linked_count != catalog_count:
        raise ValueError('The bank has incomplete or unsuccessful scenario execution evidence')
    return report, catalog_count


def copy_sources(stage):
    selected = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT
    ).decode('utf-8').split('\0')
    for name in sorted(set(selected)):
        source = ROOT / name
        if name.startswith(SOURCE_DIRECTORIES) or name in SOURCE_FILES:
            if source.is_file() and not source.is_symlink():
                destination = stage / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)


def write_catalog(bank, run_id, destination):
    with closing(sqlite3.connect(bank.as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute("""
            SELECT s.id, s.anchor, s.stage, s.resource, s.option, s.profile, s.variant,
                   s.gate, s.decision, s.execution, s.outcome, s.data_class,
                   CASE
                       WHEN s.gate IN ('WAIT_EVIDENCE','EXPIRED','BLOCKED_DONOR','BLOCKED_RESERVATION') THEN 'P0'
                       WHEN s.gate='STALE' OR s.variant=1 OR
                            s.execution IN ('FAILED','PARTIAL','CANCELLED','SUPERSEDED','IN_PROGRESS') THEN 'P1'
                       ELSE 'P2'
                   END AS test_priority,
                   t.test_id, t.outcome AS test_result,
                   json_extract(t.evidence_json, '$.expected[#-1]') AS expected_terminal,
                   json_extract(t.evidence_json, '$.actual') AS observed_terminal
            FROM scenario s JOIN educational_audit_test t
              ON t.scenario_id=s.id AND t.test_id='HTTP-' || s.id
            WHERE t.run_id=? ORDER BY s.id
        """, (run_id,))
        with destination.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(column[0] for column in rows.description)
            writer.writerows(rows)


def stage_qa_reports(reports, evidence):
    for path in reports:
        destination = evidence / path.name
        if path.name in {'package-manifest.json', 'localhost-smoke.log'} or destination.exists():
            raise ValueError(f'Reserved evidence name: {path.name}')
        shutil.copy2(path, destination)
        if path.suffix != '.json':
            continue
        report = json.loads(path.read_text(encoding='utf-8'))
        for entry in report.get('runs', []):
            if 'observed_log' not in entry:
                continue
            relative = Path(entry['observed_log'])
            if len(relative.parts) != 2 or relative.parts[0] != 'qa-logs' or relative.suffix != '.log':
                raise ValueError(f'QA log must be a relative qa-logs/*.log path: {relative}')
            log = path.parent / relative
            if log.is_symlink() or sha256(log) != entry['log_sha256']:
                raise ValueError(f'QA log does not match its recorded digest: {relative}')
            (evidence / 'qa-logs').mkdir(exist_ok=True)
            copy = evidence / relative
            if copy.exists() and sha256(copy) != entry['log_sha256']:
                raise ValueError(f'Conflicting QA logs share {relative}')
            if not copy.exists():
                shutil.copy2(log, copy)


def stage_windows_runtime(stage, archive, license_file):
    actual = base64.b64encode(hash_file(archive, 'sha512').digest()).decode('ascii')
    if actual != NODE_SHA512:
        raise ValueError(f'Windows Node archive SHA-512 mismatch: {archive}')
    runtime = stage / 'runtime'
    runtime.mkdir()
    executable = runtime / 'node.exe'
    with tarfile.open(archive, 'r:gz') as contents:
        metadata = json.load(contents.extractfile('package/package.json'))
        if metadata['version'] != NODE_VERSION or metadata['cpu'] != 'x64' or metadata['os'] != 'win32':
            raise ValueError('Windows Node runtime metadata mismatch')
        with contents.extractfile('package/bin/node.exe') as binary, executable.open('wb') as output:
            shutil.copyfileobj(binary, output)
    with executable.open('rb') as binary:
        if binary.read(2) != b'MZ':
            raise ValueError('Bundled runtime does not have the Windows executable header')
        binary.seek(0x3C)
        binary.seek(struct.unpack('<I', binary.read(4))[0])
        if binary.read(6) != b'PE\0\0\x64\x86':
            raise ValueError('Bundled runtime is not a Windows AMD64 executable')
    shutil.copy2(license_file, runtime / 'LICENSE')
    return {'version': NODE_VERSION, 'platform': 'win32-x64', 'archive': NODE_ARCHIVE,
            'archive_sha512_base64': NODE_SHA512, 'node_exe_sha256': sha256(executable),
            'license_source': NODE_LICENSE, 'license_sha256': sha256(runtime / 'LICENSE')}


def smoke(stage, node, expected, evidence):
    env = os.environ.copy()
    env.update(PORT='0', PVPT_HOST='127.0.0.1',
               PVPT_TOTAL_DEMO_DB=str(stage / '.pvpt' / 'total-demo.sqlite'),
               PVPT_DATABASE_PATH=str(evidence / 'smoke-workspace.sqlite'))
    log = evidence / 'localhost-smoke.log'
    with log.open('wb') as output:
        process = subprocess.Popen([node, 'scripts/localhost.mjs'], cwd=stage, env=env,
                                   stdout=output, stderr=subprocess.STDOUT)
        try:
            url = None
            for _ in range(100):
                for line in log.read_text(encoding='utf-8', errors='replace').splitlines():
                    if line.startswith('PVPT server running on '):
                        url = line.split()[-1]
                if url or process.poll() is not None:
                    break
                time.sleep(0.1)
            if not url:
                raise RuntimeError(f'Application did not start:\n{log.read_text(encoding="utf-8")}')
            with urlopen(url + '/api/health', timeout=5) as response:
                health = json.load(response)
            with urlopen(url + '/api/total-demo/summary', timeout=5) as response:
                summary = json.load(response)
            with urlopen(url + '/demo/total-system/', timeout=5) as response:
                page_ok = response.status == 200 and len(response.read()) > 0
            if health['status'] != 'ok' or summary['summary']['scenarios'] != expected or not page_ok:
                raise RuntimeError('Staged application responded with an incorrect health, scenario count, or demo page')
        except URLError as error:
            raise RuntimeError(f'Staged localhost request failed: {error}') from error
        finally:
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=10)
    for path in evidence.glob('smoke-workspace.sqlite*'):
        path.unlink()
    version = subprocess.check_output([node, '-v'], text=True).strip()
    return {'status': 'PASS', 'host_platform': os.name, 'node': version,
            'same_node_version_as_windows_bundle': version == f'v{NODE_VERSION}',
            'health': health, 'scenario_count': expected, 'demo_http': 200,
            'windows_native_execution': 'NOT_RUN' if os.name != 'nt' else 'SEE_HOST_RUNTIME'}


def build(args):
    report, catalog_count = verify_bank(args.bank, args.report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pvpt-package-', dir=args.output.parent) as directory:
        root = Path(directory)
        stage = root / 'PVPT'
        stage.mkdir()
        copy_sources(stage)
        runtime = stage_windows_runtime(stage, args.node_archive, args.node_license)
        subprocess.run(['npm', 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
                       cwd=stage, check=True)
        native_plugins = list((stage / 'node_modules').rglob('*.node'))
        if native_plugins:
            raise ValueError(f'Production dependencies include an unverified native module: {native_plugins[0]}')
        bank_path = stage / '.pvpt' / 'total-demo.sqlite'
        bank_path.parent.mkdir()
        shutil.copy2(args.bank, bank_path)
        evidence = stage / 'evidence'
        evidence.mkdir()
        shutil.copy2(args.report, evidence / 'scenario-audit.json')
        write_catalog(bank_path, report['run_id'], evidence / 'scenario-catalog.csv')
        stage_qa_reports(args.qa_report, evidence)
        (stage / 'Start-PVPT.cmd').write_bytes(WINDOWS_LAUNCHER.replace('\n', '\r\n').encode('ascii'))
        (stage / 'README-Windows.fa.md').write_text(GUIDE, encoding='utf-8')
        manifest = {'data_class': 'DEMO_SYNTHETIC', 'run_id': report['run_id'], 'bank_sha256': sha256(bank_path),
                    'npm_lock_sha256': sha256(stage / 'package-lock.json'),
                    'runtime': runtime, 'localhost': smoke(stage, args.smoke_node, catalog_count, evidence)}
        (evidence / 'package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        temp_archive = root / 'package.zip'
        with ZipFile(temp_archive, mode='w', compression=ZIP_DEFLATED, compresslevel=5) as archive:
            for path in sorted(stage.rglob('*')):
                if path.is_file() and not path.is_symlink():
                    archive.write(path, path.relative_to(root).as_posix())
        with ZipFile(temp_archive) as archive:
            invalid_member = archive.testzip()
            if invalid_member:
                raise ValueError(f'Archive integrity check failed: {invalid_member}')
        temp_archive.replace(args.output)
    checksum = sha256(args.output)
    args.output.with_suffix(args.output.suffix + '.sha256').write_text(
        f'{checksum}  {args.output.name}\n', encoding='utf-8'
    )
    print(json.dumps({'path': str(args.output), 'bytes': args.output.stat().st_size,
                      'sha256': checksum, **manifest}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ('bank', 'report', 'node-archive', 'node-license', 'output'):
        parser.add_argument('--' + option, required=True, type=lambda value: Path(value).resolve())
    parser.add_argument('--qa-report', action='append', default=[], type=lambda value: Path(value).resolve())
    parser.add_argument('--smoke-node', default=shutil.which('node'))
    build(parser.parse_args())
