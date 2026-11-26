"""Create and verify the executive proof-of-concept in the scenario database."""
import argparse
import json
import sqlite3
from pathlib import Path

import finance
import governance
from reservation import active_reservations, init_reservations, register_option, approve, reserve

CASE = 'EXEC-FIN-01'
NOW = 0  # All times in this exercise are minutes relative to the demo visit.


def capacity_cases(db):
    init_reservations(db)
    for option, order in [('original', 'ORDER-A'), ('incoming', 'ORDER-B')]:
        register_option(db, option, order)
    approve(db, 'DEC-A', 'original', 'manager', NOW)

    def request(key, option, decision, start, end):
        return reserve(db, reservation_id=key, option_id=option, decision_id=decision,
                       resource='FAT-01', start=start, end=end, expires=4000,
                       owner='test-planning', order_id='ORDER-A' if option == 'original' else 'ORDER-B', now=NOW)

    original = request('RES-A', 'original', 'DEC-A', 600, 780)
    approve(db, 'DEC-B', 'incoming', 'ceo', NOW)
    clash = request('RES-B-CLASH', 'incoming', 'DEC-B', 690, 870)
    alternative = request('RES-B-ALT', 'incoming', 'DEC-B', 780, 960)
    assert 'ORDER-A' in clash['conflicting_orders']
    assert not alternative['conflicting_orders']
    assert original['status'] == alternative['status'] != clash['status']
    return {'case_id': CASE, 'approved_does_not_mean_reserved': True,
            'resource': 'FAT-01', 'protected_order': 'ORDER-A',
            'reserved_slot': [600, 780], 'incoming_requested_slot': [690, 870],
            'alternative_slot': [780, 960],
            'existing': original, 'requested': clash, 'alternative': alternative}


def promises(db):
    db.executescript("""
    CREATE TABLE executive_promise(
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL, order_id TEXT NOT NULL,
        deliverable TEXT NOT NULL, due_minute INTEGER NOT NULL,
        reserved_start INTEGER, reserved_end INTEGER);
    CREATE TABLE executive_prerequisite(
        promise_id TEXT NOT NULL REFERENCES executive_promise,
        requirement TEXT NOT NULL, status TEXT NOT NULL, evidence TEXT NOT NULL,
        PRIMARY KEY(promise_id, requirement));
    """)
    db.executemany('INSERT INTO executive_promise VALUES(?,?,?,?,?,?,?)', [
        ('PROM-A', CASE, 'ORDER-A', 'پایان آزمون سفارش الف', 840, 600, 780),
        ('PROM-B', CASE, 'ORDER-B', 'پذیرش سفارش ب', 2880, 780, 960),
        ('PROM-C', CASE, 'ORDER-C', 'ارسال سفارش ج', 3900, None, None),
    ])
    db.executemany('INSERT INTO executive_prerequisite VALUES(?,?,?,?)', [
        ('PROM-A', 'آمادگی تجهیز', 'READY', 'RES-A'),
        ('PROM-A', 'تیم مجاز و هم‌زمان', 'READY', 'DEMO-SHIFT-A'),
        ('PROM-A', 'مواد آزادشده', 'READY', 'DEMO-QM-A'),
        ('PROM-B', 'نوبت آزمون', 'READY', 'RES-B-ALT'),
        ('PROM-B', 'تأیید شاهد مشتری', 'UNKNOWN', 'DEMO-WITNESS-PENDING'),
        ('PROM-C', 'آزادسازی کیفیت', 'BLOCKED', 'DEMO-QM-HOLD'),
    ])

    active_slots = {(order, start, end) for _, _, start, end, _, _, order in active_reservations(db, NOW)}

    def window(hours):
        result = []
        data = db.execute('SELECT id,case_id,order_id,deliverable,due_minute,reserved_start,reserved_end '
                          'FROM executive_promise WHERE due_minute > ? AND due_minute <= ? ORDER BY due_minute',
                          (NOW, NOW + hours * 60))
        for key, case, order, title, due, start, end in data:
            controls = [dict(requirement=r, status=s, evidence=e) for r, s, e in db.execute(
                'SELECT requirement,status,evidence FROM executive_prerequisite WHERE promise_id=? ORDER BY requirement',(key,))]
            readiness = ('BLOCKED' if any(c['status']=='BLOCKED' for c in controls)
                         else 'READY' if (order, start, end) in active_slots and end <= due and controls
                         and all(c['status']=='READY' for c in controls) else 'UNKNOWN')
            result.append(dict(id=key,case_id=case,order=order,title=title,due_minute=due,
                               readiness=readiness,reserved_slot=[start,end],controls=controls))
        return result

    result = {'24h': window(24), '72h': window(72)}
    assert [p['readiness'] for p in result['24h']] == ['READY']
    assert [p['readiness'] for p in result['72h']] == ['READY','UNKNOWN','BLOCKED']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('First create the scenario database with run.py')
    with sqlite3.connect(args.db) as db:
        db.execute('PRAGMA foreign_keys=ON')
        if not db.execute('SELECT count(*) FROM scenario').fetchone()[0]:
            parser.error('Scenario bank is empty')
        report = {'data_class':'DEMO_SYNTHETIC','case_id':CASE,'now_minute':NOW}
        report['order_conflict'] = capacity_cases(db)
        report['promises'] = promises(db)
        governance.install(db)
        report['governance'] = governance.demo(db, now=NOW)
        finance.seed_finance(db)
        finance.verify_finance(db)
        report['finance'] = finance.finance_view(db)
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
    output = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.report:
        args.report.write_text(output, encoding='utf-8')
    else:
        print(output, end='')


if __name__ == '__main__':
    main()
