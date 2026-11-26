"""Synthetic, traceable cash and FI/CO evidence for the executive scenario lab."""
from datetime import date, timedelta
from decimal import Decimal


SCENARIO = 'EXEC-FIN-01'


def seed_finance(db):
    # Execute statements individually so the caller controls the transaction.
    schema = (
        """CREATE TABLE finance_option(id TEXT PRIMARY KEY, project TEXT NOT NULL,
           required INTEGER NOT NULL CHECK(required>0), deadline TEXT NOT NULL)""",
        """CREATE TABLE finance_funding(option_id TEXT REFERENCES finance_option,
           reference TEXT, available_at TEXT, amount INTEGER, PRIMARY KEY(option_id,reference))""",
        """CREATE TABLE finance_plan(id TEXT PRIMARY KEY, wbs TEXT, work_order TEXT,
           period TEXT, baseline TEXT, currency TEXT, planned INTEGER, earned INTEGER)""",
        """CREATE TABLE finance_posting(document TEXT, line INTEGER, wbs TEXT, work_order TEXT,
           period TEXT, currency TEXT, amount INTEGER, kind TEXT, matched_document TEXT,
           PRIMARY KEY(document,line))""",
        """CREATE TABLE finance_node(scenario TEXT, id TEXT, duration INTEGER, extra INTEGER,
           PRIMARY KEY(scenario,id))""",
        """CREATE TABLE finance_edge(scenario TEXT, parent TEXT, child TEXT,
           PRIMARY KEY(scenario,parent,child),
           FOREIGN KEY(scenario,parent) REFERENCES finance_node(scenario,id),
           FOREIGN KEY(scenario,child) REFERENCES finance_node(scenario,id))""",
        """CREATE TABLE finance_cash_stage(scenario TEXT, id TEXT, node TEXT, principal INTEGER,
           annual_rate_bps INTEGER, observed INTEGER, baseline_due TEXT, PRIMARY KEY(scenario,id),
           FOREIGN KEY(scenario,node) REFERENCES finance_node(scenario,id),
           UNIQUE(scenario,node))""",
        """CREATE TABLE finance_measure(scenario TEXT, kind TEXT, value INTEGER, unit TEXT,
           evidence TEXT, PRIMARY KEY(scenario,kind))""",
    )
    for statement in schema:
        db.execute(statement)
    db.executemany('INSERT INTO finance_option VALUES(?,?,?,?)', (
        ('EXTERNAL-FAT', 'SYN-A', 650, '2026-11-26T12:00:00+03:30'),
        ('QUALIFIED-LOCAL', 'SYN-A', 400, '2026-11-26T14:00:00+03:30'),
    ))
    db.executemany('INSERT INTO finance_funding VALUES(?,?,?,?)', (
        ('EXTERNAL-FAT', 'SYN-FUND-01', '2026-11-26T10:00:00+03:30', 400),
        ('EXTERNAL-FAT', 'SYN-FUND-02', '2026-11-26T13:00:00+03:30', 250),
        ('QUALIFIED-LOCAL', 'SYN-FUND-03', '2026-11-26T12:30:00+03:30', 400),
    ))
    db.execute('INSERT INTO finance_plan VALUES(?,?,?,?,?,?,?,?)',
               ('SYN-COST-01', 'SYN-WBS-A', 'SYN-ORD-A', '2026-11', 'BL-01', 'M_TOMAN', 800, 800))
    db.executemany('INSERT INTO finance_posting VALUES(?,?,?,?,?,?,?,?,?)', (
        ('SYN-MAT-01', 1, 'SYN-WBS-A', 'SYN-ORD-A', '2026-11', 'M_TOMAN', 500, 'SOURCE', None),
        ('SYN-LAB-01', 1, 'SYN-WBS-A', 'SYN-ORD-A', '2026-11', 'M_TOMAN', 450, 'SOURCE', None),
        ('SYN-SET-01', 1, 'SYN-WBS-A', 'SYN-ORD-A', '2026-11', 'M_TOMAN', 500, 'INTERNAL', 'SYN-MAT-01'),
        ('SYN-REV-01', 1, 'SYN-WBS-A', 'SYN-ORD-A', '2026-12', 'M_TOMAN', 100, 'SOURCE', None),
    ))
    db.executemany('INSERT INTO finance_node VALUES(?,?,?,?)', (
        (SCENARIO, 'PART-A', 2, 5), (SCENARIO, 'PART-B', 2, 5),
        (SCENARIO, 'FAT', 1, 0), (SCENARIO, 'DELIVERY', 2, 0),
        (SCENARIO, 'RECEIVABLE', 15, 0),
    ))
    db.executemany('INSERT INTO finance_edge VALUES(?,?,?)', (
        (SCENARIO, 'PART-A', 'FAT'), (SCENARIO, 'PART-B', 'FAT'),
        (SCENARIO, 'FAT', 'DELIVERY'), (SCENARIO, 'DELIVERY', 'RECEIVABLE'),
    ))
    db.execute('INSERT INTO finance_cash_stage VALUES(?,?,?,?,?,?,?)',
               (SCENARIO, 'SYN-PAY-01', 'RECEIVABLE', 60000, 3000, 0, '2026-12-15'))
    db.executemany('INSERT INTO finance_measure VALUES(?,?,?,?,?)', (
        (SCENARIO, 'manufacturing_cost_effect', 50, 'M_TOMAN', 'SYN-CONTROLLER-REVIEW'),
        (SCENARIO, 'released_capacity', 8, 'HOUR', 'SYN-CAPACITY-OBSERVATION'),
    ))


def funding_view(db):
    return [
        dict(option=option, project=project, required=required, deadline=deadline,
             available_by_deadline=available, eventual=eventual, gap=max(0, required - available),
             feasible=available >= required,
             funding_evidence=[dict(reference=ref, available_at=at, amount=amount) for ref, at, amount in db.execute(
                 'SELECT reference,available_at,amount FROM finance_funding WHERE option_id=? ORDER BY available_at,reference',
                 (option,))])
        for option, project, required, deadline, available, eventual in db.execute("""
            SELECT o.id,o.project,o.required,o.deadline,
                COALESCE(SUM(CASE WHEN datetime(f.available_at)<=datetime(o.deadline) THEN f.amount ELSE 0 END),0),
                COALESCE(SUM(f.amount),0)
            FROM finance_option o LEFT JOIN finance_funding f ON f.option_id=o.id
            GROUP BY o.id ORDER BY o.id
        """)
    ]


def cost_view(db):
    plan, wbs, order, period, baseline, currency, pv, ev = db.execute('SELECT * FROM finance_plan').fetchone()
    postings = []
    for doc, line, doc_period, doc_currency, amount, kind, matched in db.execute("""
        SELECT document,line,period,currency,amount,kind,matched_document FROM finance_posting
        WHERE wbs=? AND work_order=? ORDER BY document,line
    """, (wbs, order)):
        reason = ('DIFFERENT_PERIOD' if doc_period != period else
                  'DIFFERENT_CURRENCY' if doc_currency != currency else
                  'INTERNAL_TRANSFER' if kind == 'INTERNAL' and matched else None)
        postings.append(dict(document=doc, line=line, amount=amount,
                             period=doc_period, currency=doc_currency, matched_document=matched,
                             included=reason is None, reason=reason))
    ac = sum(row['amount'] for row in postings if row['included'])
    return dict(id=plan, wbs=wbs, order=order, period=period, baseline=baseline, currency=currency,
                pv=pv, ev=ev, ac=ac, cpi=round(ev/ac, 4) if ac > 0 else None, cv=ev-ac, postings=postings)


def finish_times(db, scenario):
    """Finish of a node is its duration plus the latest predecessor finish."""
    nodes = {node: (duration, extra) for node, duration, extra in db.execute(
        'SELECT id,duration,extra FROM finance_node WHERE scenario=?', (scenario,))}
    edges = {node: [] for node in nodes}
    for parent, child in db.execute('SELECT parent,child FROM finance_edge WHERE scenario=?', (scenario,)):
        edges[child].append(parent)
    visiting, completed = set(), {}

    def finish(node):
        if node in visiting:
            raise ValueError('Cycle in financial dependency graph')
        if node not in completed:
            visiting.add(node)
            predecessors = [finish(parent) for parent in edges[node]]
            duration, extra = nodes[node]
            baseline = duration + max((p[0] for p in predecessors), default=0)
            risk = duration + extra + max((p[1] for p in predecessors), default=0)
            completed[node] = (baseline, risk)
            visiting.remove(node)
        return completed[node]

    return {node: finish(node) for node in sorted(nodes)}


def cash_view(db):
    dates = finish_times(db, SCENARIO)
    cash_rows = []
    for stage, node, principal, rate, observed, baseline_due in db.execute("""
        SELECT id,node,principal,annual_rate_bps,observed,baseline_due
        FROM finance_cash_stage WHERE scenario=? ORDER BY id
    """, (SCENARIO,)):
        baseline, risk = dates[node]
        delay = risk - baseline
        timing_impact = Decimal(principal) * Decimal(rate) * delay / Decimal(365 * 10000)
        cash_rows.append(dict(stage=stage, node=node, principal=principal,
                              date_baseline=baseline_due, date_forecast=str(date.fromisoformat(baseline_due) + timedelta(days=delay)),
                              delay_days=delay, annual_rate_bps=rate, observed_receipt=observed,
                              timing_cost_m_toman=float(round(timing_impact, 2))))
    return dict(scenario=SCENARIO, nodes=dates,
                edges=[list(row) for row in db.execute(
                    'SELECT parent,child FROM finance_edge WHERE scenario=? ORDER BY parent,child', (SCENARIO,))],
                stages=cash_rows,
                independent_metrics=[dict(metric=kind,value=value,unit=unit,evidence=evidence)
                                     for kind,value,unit,evidence in db.execute(
                    'SELECT kind,value,unit,evidence FROM finance_measure WHERE scenario=? ORDER BY kind', (SCENARIO,))])


def finance_view(db):
    return dict(funding=funding_view(db), cost=cost_view(db), cash=cash_view(db),
                data_class='DEMO_SYNTHETIC')


def verify_finance(db):
    data = finance_view(db)
    late, ready = data['funding']
    assert late['eventual'] == late['required'] and late['gap'] == 250 and not late['feasible']
    assert ready['feasible'] and ready['gap'] == 0
    cost = data['cost']
    assert cost['ac'] == 950 and cost['cv'] == -150 and cost['cpi'] == 0.8421
    assert {row['reason'] for row in cost['postings'] if not row['included']} == {'INTERNAL_TRANSFER','DIFFERENT_PERIOD'}
    cash = data['cash']
    assert len(cash['stages']) == 1 and len(cash['edges']) == 4
    row = cash['stages'][0]
    assert row['delay_days'] == 5 and row['timing_cost_m_toman'] == 246.58 and row['observed_receipt'] == 0
    assert set(metric['unit'] for metric in cash['independent_metrics']) == {'M_TOMAN','HOUR'}


if __name__ == '__main__':
    import json
    import sqlite3

    with sqlite3.connect(':memory:') as connection:
        connection.execute('PRAGMA foreign_keys=ON')
        seed_finance(connection)
        verify_finance(connection)
        print(json.dumps(finance_view(connection), indent=2, ensure_ascii=False))
