"""Read-only, independent acceptance oracle for version 1 of the scenario catalogue."""
import argparse
import hashlib
import itertools
import json
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGES = ('engineering', 'procurement', 'stock_release', 'manufacturing',
          'quality_fat', 'dispatch', 'acceptance', 'collection')
RESOURCES = ('drawing', 'supplier', 'usable_stock', 'work_center',
             'test_cell', 'transport', 'customer_witness', 'payment_clearance')
OPTIONS = {'expedite': 1, 'alternate': 2, 'transfer': 3}
# profile -> prior gate, resulting execution when an option is approved
PROFILES = {
    'ready': ('FEASIBLE', None), 'no_action': ('FEASIBLE', None),
    'unknown': ('WAIT_EVIDENCE', None), 'stale': ('STALE', None),
    'late_decision': ('EXPIRED', None), 'shared_conflict': ('BLOCKED_RESERVATION', None),
    'approved': ('FEASIBLE', 'COMPLETED'), 'failed': ('FEASIBLE', 'FAILED'),
    'partial': ('FEASIBLE', 'PARTIAL'), 'cancelled': ('FEASIBLE', 'CANCELLED'),
    'superseded': ('FEASIBLE', 'SUPERSEDED'), 'pending_observation': ('FEASIBLE', 'IN_PROGRESS'),
}


def load(filename):
    return json.loads((ROOT / filename).read_text(encoding='utf-8'))


def anchors():
    fixture = load('data/product-project-fixture.json')
    history = load('data/reference-datasets.json')
    entries = [(p['product_id'], p['family_id'], 'PUBLIC_CATALOGUE') for p in fixture['products']]
    entries.extend((p['project_id'], None, 'DEMO_FIXTURE') for p in fixture['projects'])
    for group in ('company1404MacroPlan', 'company1404DetailedUnits', 'company1404Busducts'):
        entries.extend((f'{group}:{i}', p['family_id'], 'HISTORICAL_REFERENCE')
                       for i, p in enumerate(history[group], 1))
    return entries


def expected(stage, option, profile, variant):
    gate, execution = PROFILES[profile]
    incident = profile != 'ready'
    donor = 1 + variant if option == 'transfer' and incident else 0
    if donor and gate == 'FEASIBLE':
        gate = 'BLOCKED_DONOR'
    decision = {'ready': 'NOT_REQUIRED', 'no_action': 'NO_ACTION'}.get(
        profile, 'APPROVED' if gate == 'FEASIBLE' else 'NOT_APPROVED')
    if decision != 'APPROVED':
        execution = 'NOT_STARTED'
    effects = []
    for position, name in enumerate(STAGES):
        base = (position + 1) * 4
        affected = position >= stage and incident
        delta = 3 + variant if affected else 0
        missing = ((profile == 'unknown' and position >= stage)
                   or (variant and position == 7 and stage < 7))
        without = None if missing else base + delta
        proposal = None if missing else base + max(0, delta - OPTIONS[option])
        actual = None
        if execution == 'COMPLETED':
            actual = proposal
        elif execution == 'FAILED':
            actual = without
        elif execution == 'PARTIAL' and position <= stage and proposal is not None:
            actual = proposal + int(position == stage)
        current = proposal if execution in ('COMPLETED', 'FAILED', 'PARTIAL', 'IN_PROGRESS') else without
        effects.append((name, base, without, proposal, actual if actual is not None else current, actual))
    observed = sum(row[-1] is not None for row in effects)
    outcome = ('VERIFIED' if observed == 8 and execution != 'PARTIAL' else
               'PARTIALLY_VERIFIED' if observed else
               'PENDING' if decision == 'APPROVED' else 'NOT_APPLICABLE')
    effects.append(('donor_delivery', 24, 24, 24+donor, 24, None))
    events = [('OWNER', 'BASELINE', 'FROZEN'),
              ('EXPERT', 'DETECTION', 'REPORTED' if incident else 'NO_ISSUE'),
              ('ASSESSOR', 'ASSESS', gate), ('DECIDER', 'DECIDE', decision)]
    if decision == 'APPROVED':
        events.extend([('EXECUTOR', 'EXECUTE', execution), ('REVIEWER', 'OBSERVE', outcome)])
    if observed:
        events.append(('OWNER', 'LESSON', 'CAPTURED' if outcome == 'VERIFIED' else 'PROVISIONAL'))
    return (gate, decision, execution, outcome), effects, events


def audit(db):
    sources = anchors()
    compare = lambda a, b: set(a) == set(b) and len(a) == len(b)
    if not compare(sources, db.execute('SELECT id,family,provenance FROM anchor').fetchall()):
        raise ValueError('Anchor catalogue differs from approved inputs')
    counts = Counter(anchors=len(sources))
    combinations = itertools.product(sources, range(8), OPTIONS, PROFILES, (0, 1))
    for idx, (anchor, stage, option, profile, variant) in enumerate(combinations, 1):
        key = f'S{idx:06}'
        status, effects, events = expected(stage, option, profile, variant)
        row = db.execute('SELECT anchor,stage,resource,option,profile,variant,gate,decision,execution,'
                         'outcome,data_class FROM scenario WHERE id=?', (key,)).fetchone()
        if row != (anchor[0], STAGES[stage], RESOURCES[stage], option, profile, variant, *status, 'DEMO_SYNTHETIC'):
            raise ValueError(f'{key}: dimensions, resource, classification or status mismatch')
        actual = db.execute('SELECT node,baseline,without_action,proposed,current_forecast,observed '
                            'FROM effect WHERE scenario=?', (key,)).fetchall()
        if not compare(actual, effects):
            raise ValueError(f'{key}: effect mismatch')
        actual = db.execute('SELECT sequence,actor,action,status FROM event WHERE scenario=? ORDER BY sequence',
                            (key,)).fetchall()
        if actual != [(i, *event) for i, event in enumerate(events, 1)]:
            raise ValueError(f'{key}: lifecycle mismatch')
        counts.update({'scenarios': 1, 'effects': len(effects), 'events': len(events)})
        counts.update(f'{k}:{v}' for k, v in zip(('gate', 'decision', 'execution', 'outcome'), status))
    for table, field in [('scenario','scenarios'), ('event','events'), ('effect','effects')]:
        if db.execute(f'SELECT count(*) FROM {table}').fetchone()[0] != counts[field]:
            raise ValueError(f'Unexpected rows in {table}')
    if counts != load('scenario-lab/evidence/summary.json'):
        raise ValueError('Catalogue totals differ from reviewed evidence')
    inputs = ('data/product-project-fixture.json', 'data/reference-datasets.json',
              'scenario-lab/evidence/summary.json')
    provenance = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in inputs}
    return {'oracleVersion': 1, 'status': 'PASS', 'sourceSHA256': provenance, 'dimensions': {
        'anchors': len(sources), 'stages': list(STAGES), 'options': list(OPTIONS),
        'profiles': list(PROFILES), 'variants': [0,1]}, 'verified': dict(counts)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        with sqlite3.connect(args.db.resolve().as_uri()+'?mode=ro', uri=True) as db:
            result = audit(db)
    except (ValueError, sqlite3.Error, OSError) as exc:
        result = {'oracleVersion': 1, 'status': 'FAIL', 'reason': str(exc)}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)+'\n'
    if args.report:
        args.report.write_text(rendered, encoding='utf-8')
    print(rendered, end='')
    raise SystemExit(0 if result['status'] == 'PASS' else 1)
