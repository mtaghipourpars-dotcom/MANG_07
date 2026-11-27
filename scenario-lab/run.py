"""Reproducible, isolated value-chain experiment. Python 3.10+, stdlib only."""
import argparse
import itertools
import json
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGES = ('engineering', 'procurement', 'stock_release', 'manufacturing',
          'quality_fat', 'dispatch', 'acceptance', 'collection')
PROFILES = ('ready', 'no_action', 'unknown', 'stale', 'late_decision',
            'shared_conflict', 'approved', 'failed', 'partial', 'cancelled',
            'superseded', 'pending_observation')
OPTIONS = ('expedite', 'alternate', 'transfer')
RESOURCE = ('drawing', 'supplier', 'usable_stock', 'work_center',
            'test_cell', 'transport', 'customer_witness', 'payment_clearance')


def anchors():
    def load(name):
        return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8'))
    fixture = load('product-project-fixture.json')
    history = load('reference-datasets.json')
    for product in fixture['products']:
        yield product['product_id'], product['family_id'], 'PUBLIC_CATALOGUE'
    for project in fixture['projects']:
        yield project['project_id'], None, 'DEMO_FIXTURE'
    for key in ('company1404MacroPlan', 'company1404DetailedUnits', 'company1404Busducts'):
        for ordinal, row in enumerate(history[key], 1):
            yield f'{key}:{ordinal}', row['family_id'], 'HISTORICAL_REFERENCE'


def evaluate(stage, option, profile, overlap):
    """All values are synthetic days. Missing information propagates as None."""
    baseline = tuple(range(4, 33, 4))
    incident = profile != 'ready'
    delay = 3 + overlap if incident else 0
    without = tuple(day + (delay if i >= stage else 0) for i, day in enumerate(baseline))
    recovery = {'expedite': 1, 'alternate': 2, 'transfer': 3}[option]
    suggested = tuple(
        day - (min(delay, recovery) if i >= stage else 0)
        for i, day in enumerate(without)
    )
    donor_delay = int(option == 'transfer' and incident) * (1 + overlap)
    gate = {'unknown':'WAIT_EVIDENCE', 'stale':'STALE',
            'late_decision':'EXPIRED', 'shared_conflict':'BLOCKED_RESERVATION'}.get(profile)
    if gate is None:
        gate = 'BLOCKED_DONOR' if donor_delay else 'FEASIBLE'
    decision = ('NOT_REQUIRED' if not incident else 'NO_ACTION' if profile == 'no_action'
                else 'APPROVED' if gate == 'FEASIBLE' else 'NOT_APPROVED')
    if profile == 'unknown':
        suggested = tuple(None if i >= stage else day for i, day in enumerate(suggested))
        without = tuple(None if i >= stage else day for i, day in enumerate(without))
    elif overlap and stage < 7:
        suggested = (*suggested[:-1], None)
        without = (*without[:-1], None)
    execution = 'NOT_STARTED'
    if decision == 'APPROVED':
        execution = {'failed':'FAILED', 'partial':'PARTIAL', 'cancelled':'CANCELLED',
                     'superseded':'SUPERSEDED', 'pending_observation':'IN_PROGRESS'}.get(profile, 'COMPLETED')
    current = suggested if decision == 'APPROVED' and execution not in ('CANCELLED','SUPERSEDED') else without
    observed = tuple(
        (max(day, without[i]) if execution == 'FAILED' and without[i] is not None else day + int(execution == 'PARTIAL' and i >= stage))
        if day is not None and execution in ('COMPLETED','PARTIAL','FAILED')
        and (execution != 'PARTIAL' or i <= stage) else None
        for i, day in enumerate(current)
    )
    outcome = ('VERIFIED' if execution in ('COMPLETED','FAILED') and all(d is not None for d in observed)
               else 'PARTIALLY_VERIFIED' if any(d is not None for d in observed)
               else 'PENDING' if decision == 'APPROVED' else 'NOT_APPLICABLE')
    current = tuple(actual if actual is not None else forecast for actual, forecast in zip(observed, current))
    return baseline, without, suggested, current, observed, gate, decision, execution, outcome, donor_delay


def build(db, counts):
    db.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE anchor(id TEXT PRIMARY KEY, family TEXT, provenance TEXT NOT NULL);
    CREATE TABLE scenario(id TEXT PRIMARY KEY, anchor TEXT NOT NULL REFERENCES anchor,
      stage TEXT NOT NULL, resource TEXT NOT NULL, option TEXT NOT NULL, profile TEXT NOT NULL,
      variant INTEGER NOT NULL, gate TEXT NOT NULL, decision TEXT NOT NULL, execution TEXT NOT NULL,
      outcome TEXT NOT NULL, data_class TEXT NOT NULL,
      UNIQUE(anchor,stage,option,profile,variant));
    CREATE TABLE effect(scenario TEXT REFERENCES scenario, node TEXT, baseline INTEGER NOT NULL,
      without_action INTEGER, proposed INTEGER, current_forecast INTEGER, observed INTEGER,
      PRIMARY KEY(scenario,node));
    CREATE TABLE event(scenario TEXT REFERENCES scenario, sequence INTEGER, actor TEXT NOT NULL,
      action TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(scenario,sequence));
    CREATE INDEX scenario_filters ON scenario(anchor,stage,profile);
    """)
    for anchor, family, source in anchors():
        db.execute('INSERT INTO anchor VALUES(?,?,?)', (anchor, family, source))
        for stage, option, profile, overlap in itertools.product(range(8), OPTIONS, PROFILES, range(2)):
            case = f'S{counts["scenarios"]+1:06}'
            base, without, proposal, current, actual, gate, decision, execution, outcome, donor = evaluate(stage,option,profile,overlap)
            verify(stage, profile, base, without, proposal, current, actual, gate, decision, execution, donor)
            db.execute('INSERT INTO scenario VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                       (case,anchor,STAGES[stage],RESOURCE[stage],option,profile,overlap,
                        gate,decision,execution,outcome,'DEMO_SYNTHETIC'))
            db.executemany('INSERT INTO effect VALUES(?,?,?,?,?,?,?)',
                           ((case, STAGES[i], base[i], without[i], proposal[i], current[i], actual[i]) for i in range(8)))
            db.execute('INSERT INTO effect VALUES(?,?,?,?,?,?,?)',
                       (case, 'donor_delivery', 24,24,24+donor,24,None))
            history = [('OWNER','BASELINE','FROZEN'),
                       ('EXPERT','DETECTION','NO_ISSUE' if profile=='ready' else 'REPORTED'),
                       ('ASSESSOR','ASSESS',gate), ('DECIDER','DECIDE',decision)]
            if decision == 'APPROVED':
                history += [('EXECUTOR','EXECUTE',execution),('REVIEWER','OBSERVE',outcome)]
            if outcome in ('VERIFIED','PARTIALLY_VERIFIED'):
                history += [('OWNER','LESSON','CAPTURED' if outcome=='VERIFIED' else 'PROVISIONAL')]
            db.executemany('INSERT INTO event VALUES(?,?,?,?,?)',
                           ((case,i,*entry) for i,entry in enumerate(history,1)))
            counts.update(['scenarios', f'gate:{gate}', f'decision:{decision}',
                           f'execution:{execution}', f'outcome:{outcome}'])
    counts['anchors'] = db.execute('SELECT count(*) FROM anchor').fetchone()[0]
    counts['events'] = db.execute('SELECT count(*) FROM event').fetchone()[0]
    counts['effects'] = db.execute('SELECT count(*) FROM effect').fetchone()[0]
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchone():
        raise RuntimeError('Database integrity failure')


def verify(stage, profile, base, without, proposal, current, actual, gate, decision, execution, donor):
    if decision == 'APPROVED' and (gate != 'FEASIBLE' or donor):
        raise AssertionError('Approval breached a hard gate')
    if decision != 'APPROVED' and any(day is not None for day in actual):
        raise AssertionError('Observation without approval')
    if current[:stage] != base[:stage]:
        raise AssertionError('Impact propagated upstream')
    if profile == 'unknown' and (without[stage] is not None or proposal[stage] is not None):
        raise AssertionError('Missing evidence produced a numeric forecast')
    if any(observed is not None and observed != current[i] for i, observed in enumerate(actual)):
        raise AssertionError('Current state does not reflect observed result')
    if execution in ('CANCELLED', 'SUPERSEDED') and current != without:
        raise AssertionError('Inactive decision still governs forecast')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=Path('pvpt-scenarios.sqlite'))
    parser.add_argument('--report', type=Path)
    parser.add_argument('--case', help='Inspect a scenario and its lifecycle')
    args = parser.parse_args()
    if args.case:
        with sqlite3.connect(args.db.resolve().as_uri()+'?mode=ro', uri=True) as db:
            db.row_factory = sqlite3.Row
            row = db.execute('SELECT * FROM scenario WHERE id=?',(args.case,)).fetchone()
            if row is None:
                parser.error('Scenario not found')
            result = dict(row)
            for table, order in (('event','sequence'), ('effect','node')):
                result[table] = [dict(r) for r in db.execute(
                    f'SELECT * FROM {table} WHERE scenario=? ORDER BY {order}',(args.case,))]
            print(json.dumps(result,ensure_ascii=False,indent=2))
        return
    if args.db.exists():
        parser.error('Destination already exists; choose another database path')
    counts = Counter()
    with sqlite3.connect(args.db) as db:
        build(db, counts)
    report = json.dumps(counts,indent=2,sort_keys=True)+'\n'
    if args.report:
        args.report.write_text(report, encoding='utf-8')
    print(report,end='')


if __name__ == '__main__':
    main()
