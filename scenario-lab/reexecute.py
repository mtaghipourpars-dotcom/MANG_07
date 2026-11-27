"""Rebuild the educational bank and record a fresh localhost execution of every case."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import datetime, timezone
from hashlib import sha256
from http.client import HTTPConnection, HTTPException
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
from threading import local
from time import monotonic, sleep

import audit_analysis
import audit_oracle
import audit_store
import build_bank

ROOT = Path(__file__).resolve().parents[1]
BASE = '/api/total-demo'
PHASES = (
    ('REPORT', 'EXPERT', 'REPORTED'),
    ('SCOPE', 'OWNER', 'SCOPED'),
    ('ASSESS', 'ASSESSOR', 'ASSESSED'),
)
RESOLUTION = {
    'APPROVE': ('DECIDER', 'APPROVED'), 'DECLINE': ('DECIDER', 'DECLINED'),
    'EXECUTE': ('OWNER', 'EXECUTED'), 'OBSERVE': ('OWNER', 'OBSERVED'),
    'CLOSE': ('EXPERT', 'CLOSED'),
}


def source_fingerprint():
    digest = sha256()
    entries = [ROOT / 'server.js', ROOT / 'package.json']
    for folder in ('server', 'scenario-lab', 'data'):
        entries.extend(p for p in (ROOT / folder).rglob('*')
                       if p.is_file() and '__pycache__' not in p.parts)
    for path in sorted(entries):
        digest.update(path.relative_to(ROOT).as_posix().encode() + b'\0')
        digest.update(sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def verify(condition, message):
    if not condition:
        raise AssertionError(message)


def plan(case):
    if case['decision'] == 'APPROVED':
        return [*PHASES, ('APPROVE', *RESOLUTION['APPROVE']),
                ('EXECUTE', *RESOLUTION['EXECUTE']),
                *([('OBSERVE', *RESOLUTION['OBSERVE']), ('CLOSE', *RESOLUTION['CLOSE'])]
                  if case['outcome'] in ('VERIFIED', 'PARTIALLY_VERIFIED') else [])]
    return [*PHASES, ('DECLINE', *RESOLUTION['DECLINE']), ('CLOSE', *RESOLUTION['CLOSE'])]


def execute(port, cookie, source, worker, case):
    started = monotonic()
    trace = []
    state = {}
    outcome = 'PASS'
    failure = None
    analysis_input = dict(case)
    path = f"{BASE}/cases/{case['id']}"
    steps = plan(case)
    analysis_input.setdefault('effect', [])
    analysis_input.setdefault('event', [])

    def request(method, route, payload=None):
        if not hasattr(worker, 'connection'):
            worker.connection = HTTPConnection('127.0.0.1', port, timeout=20)
        headers = {'Cookie': cookie, 'Content-Type': 'application/json'}
        worker.connection.request(method, route, json.dumps(payload) if payload else None, headers)
        response = worker.connection.getresponse()
        return response.status, json.loads(response.read())

    try:
        status, details = request('GET', f"{BASE}/scenarios/{case['id']}")
        verify(status == 200, f'Scenario lookup returned HTTP {status}')
        verify(all(details.get(k) == v for k, v in case.items()), 'API case differs from reviewed bank row')
        analysis_input.update(details)
        status, state = request('GET', path)
        verify(status == 200 and state['status'] == 'DRAFT' and state['revision'] == 0, 'Expected fresh DRAFT')
        trace.append({'actor': 'SYSTEM', 'action': 'INITIAL_STATE', 'status': 'DRAFT'})
        for revision, (action, actor, expected) in enumerate(steps):
            payload = dict(action=action, actor=actor, revision=revision,
                           reason='Educational re-execution of ' + case['id'])
            if action == 'CLOSE' and state['status'] == 'OBSERVED':
                payload['lesson'] = {
                    'text': audit_analysis.analyze_case(analysis_input)['lesson'],
                    'applicability': 'Educational scenario only, ' + case['id'],
                }
            status, state = request('POST', path + '/actions', payload)
            trace.append({'actor': actor, 'action': action, 'status': state.get('status', 'HTTP_' + str(status))})
            verify(status == 200 and state.get('status') == expected and state.get('revision') == revision + 1,
                   f"{action}: expected {expected} at revision {revision + 1}, HTTP {status} {state.get('error', '')}")
            if 'lesson' in payload:
                verify(bool(state.get('lessons')), 'CLOSE did not persist its lesson')
        status, restored = request('GET', path)
        verify(status == 200 and restored == state, 'Persisted case differs from action response')
        if steps[-1][2] == 'EXECUTED':
            verify(restored['allowedActions'] == [], 'Observation was allowed without modelled evidence')
    except (OSError, HTTPException) as error:
        outcome, failure = 'BLOCKED', str(error)
        if hasattr(worker, 'connection'):
            worker.connection.close()
            del worker.connection
    except (AssertionError, KeyError, ValueError) as error:
        outcome, failure = 'FAIL', str(error)
    analysis_input['audit_outcome'] = outcome
    try:
        review = audit_analysis.analyze_case(analysis_input)
    except (ValueError, KeyError, TypeError) as error:
        if outcome == 'PASS':
            outcome, failure = 'FAIL', 'Analysis: ' + str(error)
        review = {
            'decision': 'Evidence unavailable. Hold approval of test result.',
            'lesson': 'Resolve the recorded error and repeat the scenario before accepting its result.',
        }
    if outcome != 'PASS':
        review['decision'] = f'Hold scenario acceptance. {failure}'
        review['lesson'] = f'Reproduce the recorded failure at {trace[-1]["action"] if trace else "initial request"} and recheck the contract.'
    return {
        'test_id': 'HTTP-' + case['id'], 'scenario_id': case['id'], 'stage': case['stage'],
        'outcome': outcome, 'decision': review['decision'], 'lesson': review['lesson'],
        'events': trace or [{'actor': 'SYSTEM', 'action': 'REQUEST', 'status': outcome}],
        'evidence': {
            'source': source, 'input': case, 'expected': ['DRAFT', *(step[2] for step in steps)],
            'actual': state.get('status'), 'revision': state.get('revision'), 'error': failure,
            'elapsed_ms': round((monotonic() - started) * 1000, 2), 'review': review,
        },
    }


def run(output, workers):
    output.mkdir(parents=True, exist_ok=False)
    bank = output / 'total-demo.sqlite'
    runtime = output / 'audit-workspace.sqlite'
    build = build_bank.build_bank(bank, Path(__file__).with_name('evidence'))
    source = source_fingerprint()
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + source[:12]
    with closing(sqlite3.connect(bank)) as db:
        oracle = audit_oracle.audit(db)
        db.row_factory = sqlite3.Row
        cases = [dict(r) for r in db.execute('SELECT * FROM scenario ORDER BY id')]
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    env = dict(os.environ, PORT=str(port), PVPT_HOST='127.0.0.1',
               PVPT_TOTAL_DEMO_DB=str(bank), PVPT_DATABASE_PATH=str(runtime))
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise RuntimeError('npm is required')
    with (output / 'server.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen([npm, 'run', 'localhost'], cwd=ROOT, env=env, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=os.name != 'nt')
        try:
            until = monotonic() + 60
            while True:
                startup = HTTPConnection('127.0.0.1', port, timeout=2)
                try:
                    startup.request('GET', '/api/workspace')
                    response = startup.getresponse()
                    response.read()
                    verify(response.status == 200 and response.getheader('Set-Cookie'), 'No fresh audit workspace')
                    cookie = response.getheader('Set-Cookie').split(';', 1)[0]
                    break
                except OSError:
                    if process.poll() is not None or monotonic() >= until:
                        raise RuntimeError('localhost did not start, see server.log')
                    sleep(0.2)
                finally:
                    startup.close()
            worker = local()
            totals = Counter()
            def task(case):
                return execute(port, cookie, source, worker, case)

            with (output / 'execution.jsonl').open('w', encoding='utf-8') as raw:
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    for result in pool.map(task, cases):
                        raw.write(json.dumps(result, ensure_ascii=False, allow_nan=False) + '\n')
                        totals[result['outcome']] += 1
                        if sum(totals.values()) % 5000 == 0:
                            print(dict(totals), flush=True)
        finally:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False)
                else:
                    import signal
                    os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=20)
    with closing(sqlite3.connect(bank)) as db, (output / 'execution.jsonl').open(encoding='utf-8') as raw:
        db.execute('PRAGMA foreign_keys=ON')
        persisted = audit_store.persist_audit(db, run_id=run_id, source=source,
                                              expected_count=len(cases),
                                              rows=map(json.loads, raw))
        integrity = audit_store.verify_audit(db, run_id)
        verify(db.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'SQLite integrity check failed')
        verify(not db.execute('PRAGMA foreign_key_check').fetchall(), 'Broken SQLite foreign key')
        verified = db.execute('''
            SELECT count(DISTINCT s.id)
            FROM scenario s JOIN educational_audit_test t
              ON t.scenario_id = s.id AND t.stage = s.stage
            WHERE t.run_id = ? AND t.test_id = 'HTTP-' || s.id
        ''', (run_id,)).fetchone()[0]
        verify(verified == len(cases), 'A scenario is missing its linked HTTP result')
    report = dict(run_id=run_id, source=source, catalog=build, execution=dict(totals),
                  database=persisted, integrity=integrity, oracle=oracle,
                  linked_cases=verified, expected=len(cases))
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True), flush=True)
    return int(totals['PASS'] != len(cases))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=12, choices=range(1, 33), metavar='1..32')
    args = parser.parse_args()
    raise SystemExit(run(args.output.resolve(), args.workers))
