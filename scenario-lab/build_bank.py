"""Publish the reviewed demo scenario bank into a new SQLite file."""
import argparse
import json
from hashlib import sha256
import os
from pathlib import Path
import sqlite3
from collections import Counter
from contextlib import closing
from tempfile import TemporaryDirectory

import executive
import finance
import governance
import run


def build_bank(destination, evidence):
    """Rebuild the existing version only when all results match reviewed evidence."""
    destination = Path(destination).absolute()
    evidence = Path(evidence)
    summary = json.loads((evidence / 'summary.json').read_text(encoding='utf-8'))
    expected = json.loads((evidence / 'executive.json').read_text(encoding='utf-8'))
    if destination.exists():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='.pvpt-bank-', dir=destination.parent) as directory:
        staging = Path(directory) / 'bank.sqlite'
        with closing(sqlite3.connect(staging)) as db, db:
            counts = Counter()
            run.build(db, counts)
            if counts != summary:
                raise ValueError('Scenario results differ from reviewed summary.json')

            conflict = executive.capacity_cases(db)
            promises = executive.promises(db)
            governance.install(db)
            decisions = governance.demo(db, now=executive.NOW)
            finance.seed_finance(db)
            finance.verify_finance(db)
            actual = {
                'data_class': 'DEMO_SYNTHETIC',
                'case_id': executive.CASE,
                'now_minute': executive.NOW,
                'order_conflict': conflict,
                'promises': promises,
                'governance': decisions,
                'finance': finance.finance_view(db),
            }
            actual_json = json.dumps(actual, ensure_ascii=False, allow_nan=False, sort_keys=True)
            if json.loads(actual_json) != expected:
                raise ValueError('Executive results differ from reviewed executive.json')
            db.execute('CREATE TABLE scenario_bank_view(view_id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
            release = {
                'schema_version': 1,
                'data_class': 'DEMO_SYNTHETIC',
                'evidence': {
                    name: sha256((evidence / name).read_bytes()).hexdigest()
                    for name in ('summary.json', 'executive.json')
                },
            }
            db.executemany('INSERT INTO scenario_bank_view VALUES (?, ?)', (
                (view, json.dumps(payload, ensure_ascii=False, allow_nan=False, sort_keys=True))
                for view, payload in {'summary': summary, 'executive': actual, 'release': release}.items()
            ))
            db.execute('PRAGMA user_version=1')
            if db.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                raise ValueError('Scenario database integrity check failed')
            if db.execute('PRAGMA foreign_key_check').fetchone():
                raise ValueError('Scenario database foreign key check failed')
        # Same-filesystem link publishes the complete file without replacing an existing bank.
        os.link(staging, destination)
    return dict(counts)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(build_bank(args.db, Path(__file__).with_name('evidence')), sort_keys=True))
