"""Record the release finding supported by independent cold-start QA."""
import argparse
from contextlib import closing
from hashlib import sha256
import json
from pathlib import Path
import sqlite3


def record(bank, run, regression):
    report = json.loads(run.read_text(encoding='utf-8'))
    evidence = json.loads(regression.read_text(encoding='utf-8'))
    root = Path(__file__).resolve().parents[3]
    config_hash = sha256((root / 'playwright.config.js').read_bytes()).hexdigest()
    if not any(entry.get('result') == 'PASS'
               and entry.get('count', 0) >= 26
               and 'cold' in entry.get('scope', '').lower()
               and entry.get('input_sha256', {}).get('playwright.config.js') == config_hash
               for entry in evidence.get('runs', [])):
        raise ValueError('Missing passing cold-start QA evidence for the current config')
    finding = (
        report['run_id'], 'AUD-03', 'REMEDIATED',
        'Fresh test checkout returned HTTP 503 because the scenario bank did not exist.',
        'The Playwright web server now uses the user launcher, which creates the bank when absent.',
        'A cold-start acceptance test should follow the same initialization path as a user.',
        regression.name,
    )
    with closing(sqlite3.connect(bank)) as db, db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute("""
            CREATE TABLE IF NOT EXISTS educational_audit_defect (
                run_id TEXT NOT NULL REFERENCES educational_audit_run(run_id),
                defect_id TEXT NOT NULL, state TEXT NOT NULL, observation TEXT NOT NULL,
                decision TEXT NOT NULL, lesson TEXT NOT NULL, evidence TEXT NOT NULL,
                PRIMARY KEY (run_id, defect_id)
            ) WITHOUT ROWID
        """)
        db.execute("""
            CREATE VIEW IF NOT EXISTS educational_audit_coverage AS
            SELECT t.run_id, s.stage, s.gate, s.decision, s.execution, s.outcome,
                   t.outcome AS test_outcome, count(*) AS cases
            FROM educational_audit_test t JOIN scenario s ON s.id = t.scenario_id
            GROUP BY t.run_id, s.stage, s.gate, s.decision, s.execution, s.outcome, t.outcome
        """)
        db.execute("""
            INSERT INTO educational_audit_defect VALUES (?,?,?,?,?,?,?)
            ON CONFLICT (run_id,defect_id) DO NOTHING
        """, finding)
        existing = db.execute("""
            SELECT * FROM educational_audit_defect WHERE run_id=? AND defect_id=?
        """, finding[:2]).fetchone()
        if existing != finding:
            raise ValueError('Existing release finding differs from this evidence')
        if db.execute('PRAGMA integrity_check').fetchone() != ('ok',):
            raise ValueError('SQLite integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('SQLite foreign key check failed')
        print(json.dumps({'run_id': finding[0], 'defect_id': finding[1], 'state': finding[2]}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bank', type=Path)
    parser.add_argument('run', type=Path)
    parser.add_argument('regression', type=Path)
    args = parser.parse_args()
    record(args.bank, args.run, args.regression)
