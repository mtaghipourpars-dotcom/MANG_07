"""Persistent, transactional evidence for the isolated educational scenario audit."""
from collections import Counter
import hashlib
import json
import sqlite3
from uuid import uuid4


OUTCOMES = ('PASS', 'FAIL', 'BLOCKED')
BATCH_SIZE = 750
SCHEMA = (
    """CREATE TABLE IF NOT EXISTS educational_audit_run (
         run_id TEXT PRIMARY KEY, source TEXT NOT NULL,
         expected_count INTEGER NOT NULL CHECK (expected_count > 0),
         digest TEXT, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
       )""",
    """CREATE TABLE IF NOT EXISTS educational_audit_test (
         run_id TEXT NOT NULL REFERENCES educational_audit_run(run_id),
         test_id TEXT NOT NULL, scenario_id TEXT NOT NULL, stage TEXT NOT NULL,
         outcome TEXT NOT NULL CHECK (outcome IN ('PASS','FAIL','BLOCKED')),
         decision TEXT NOT NULL, lesson TEXT NOT NULL, evidence_json TEXT NOT NULL,
         PRIMARY KEY (run_id, test_id)
       ) WITHOUT ROWID""",
    """CREATE TABLE IF NOT EXISTS educational_audit_event (
         run_id TEXT NOT NULL, test_id TEXT NOT NULL,
         sequence INTEGER NOT NULL CHECK (sequence > 0),
         actor TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL,
         PRIMARY KEY (run_id, test_id, sequence),
         FOREIGN KEY (run_id, test_id) REFERENCES educational_audit_test(run_id, test_id)
       ) WITHOUT ROWID""",
    """CREATE INDEX IF NOT EXISTS educational_audit_scenario
       ON educational_audit_test(run_id, scenario_id, stage)""",
)
ADD_TEST = """INSERT INTO educational_audit_test
    (run_id, test_id, scenario_id, stage, outcome, decision, lesson, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""
ADD_EVENT = """INSERT INTO educational_audit_event
    (run_id, test_id, sequence, actor, action, status)
    VALUES (?, ?, ?, ?, ?, ?)"""


def _text(value, field, length=220):
    if not isinstance(value, str) or not value.strip() or len(value) > length:
        raise ValueError(f'{field} must be a nonblank string of at most {length} characters')
    return value.strip()


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(',', ':'))


def _normalise(row):
    if not isinstance(row, dict):
        raise ValueError('each test must be a dictionary')
    result = tuple(_text(row.get(k), k) for k in ('test_id', 'scenario_id', 'stage', 'outcome')) + (
        _text(row.get('decision'), 'decision', 2000),
        _text(row.get('lesson'), 'lesson', 4000),
    )
    if result[3] not in OUTCOMES:
        raise ValueError('outcome must be PASS, FAIL or BLOCKED')
    evidence = row.get('evidence', {})
    if not isinstance(evidence, dict):
        raise ValueError('evidence must be a JSON object')
    events = row.get('events')
    if not isinstance(events, (list, tuple)) or not events:
        raise ValueError('each test needs at least one event')
    normal_events = []
    for sequence, event in enumerate(events, 1):
        if not isinstance(event, dict):
            raise ValueError('an event must be a dictionary')
        if 'sequence' in event and (type(event['sequence']) is not int or event['sequence'] != sequence):
            raise ValueError('event sequence must be consecutive and start at 1')
        normal_events.append((sequence, *(_text(event.get(k), k) for k in ('actor', 'action', 'status'))))
    return (*result, _json(evidence)), normal_events


def _run(db, run_id):
    return db.execute(
        'SELECT source, expected_count, digest FROM educational_audit_run WHERE run_id=?', (run_id,)
    ).fetchone()


def _database_rows(db, run_id):
    tests = db.execute("""
        SELECT test_id, scenario_id, stage, outcome, decision, lesson, evidence_json
        FROM educational_audit_test WHERE run_id=? ORDER BY test_id
    """, (run_id,))
    events = iter(db.execute("""
        SELECT test_id, sequence, actor, action, status FROM educational_audit_event
        WHERE run_id=? ORDER BY test_id, sequence
    """, (run_id,)))
    event = next(events, None)
    for test in tests:
        associated = []
        while event is not None and event[0] == test[0]:
            associated.append(tuple(event)[1:])
            event = next(events, None)
        if not associated or any(row[0] != sequence for sequence, row in enumerate(associated, 1)):
            raise ValueError(f'missing or unordered events for {test[0]}')
        yield tuple(test), associated
    if event is not None:
        raise ValueError('orphan audit events')


def _digest(run_id, source, expected_count, records):
    sha = hashlib.sha256()
    sha.update(_json((run_id, source, expected_count)).encode('utf-8') + b'\n')
    count = 0
    for test, events in records:
        sha.update(_json((test, events)).encode('utf-8') + b'\n')
        count += 1
    if count != expected_count:
        raise ValueError(f'expected {expected_count} tests but found {count}')
    return sha.hexdigest()


def read_audit_summary(db, run_id):
    """Read one run and count independent tests, decisions, lessons and events."""
    run = _run(db, run_id)
    if run is None:
        raise KeyError(run_id)
    source, expected_count, digest = run
    outcomes = Counter(dict(db.execute("""
        SELECT outcome, count(*) FROM educational_audit_test WHERE run_id=? GROUP BY outcome
    """, (run_id,)).fetchall()))
    test_count = outcomes.total()
    event_count = db.execute(
        'SELECT count(*) FROM educational_audit_event WHERE run_id=?', (run_id,)
    ).fetchone()[0]
    return {
        'run_id': run_id, 'source': source, 'data_class': 'DEMO_SYNTHETIC',
        'expected_count': expected_count, 'test_count': test_count,
        'decision_count': test_count, 'lesson_count': test_count, 'event_count': event_count,
        'outcomes': {key: outcomes[key] for key in OUTCOMES}, 'digest': digest,
    }


def verify_audit(db, run_id):
    """Re-read ordered rows and confirm identity, counts and content digest."""
    summary = read_audit_summary(db, run_id)
    if summary['digest'] != _digest(run_id, summary['source'], summary['expected_count'], _database_rows(db, run_id)):
        raise ValueError('audit digest mismatch')
    return summary


def _check_retry(db, run_id, source, expected_count, rows, stored):
    if stored[0] != source or stored[1] != expected_count:
        raise ValueError('audit run identity conflicts with an earlier result')
    normalized = {}
    for row in rows:
        test, events = _normalise(row)
        if test[0] in normalized:
            raise ValueError(f'duplicate test identity {test[0]}')
        normalized[test[0]] = (test, events)
    candidate_digest = _digest(run_id, source, expected_count, (normalized[key] for key in sorted(normalized)))
    if candidate_digest != stored[2]:
        raise ValueError('audit retry differs from the recorded run')
    return verify_audit(db, run_id)


def persist_audit(db, *, run_id, source, expected_count, rows):
    """Write a complete immutable run once, or accept an exact retry in any input order.

    Each row has test_id, scenario_id, stage, outcome, decision, lesson, events,
    and optional JSON evidence. The caller should use a private SQLite path.
    An incomplete run, failed integrity check, or differing retry raises and
    rolls back this run without changing other transactions.
    """
    run_id = _text(run_id, 'run_id')
    source = _text(source, 'source', 2000)
    if type(expected_count) is not int or expected_count <= 0:
        raise ValueError('expected_count must be a positive integer')
    savepoint = 'audit_' + uuid4().hex
    db.execute(f'SAVEPOINT {savepoint}')
    try:
        for statement in SCHEMA:
            db.execute(statement)
        # Reserve SQLite's write lock before checking an earlier run. Concurrent
        # resumes see the committed run rather than racing on a read snapshot.
        inserted = db.execute("""
            INSERT INTO educational_audit_run(run_id, source, expected_count)
            VALUES (?, ?, ?) ON CONFLICT(run_id) DO NOTHING
        """, (run_id, source, expected_count)).rowcount
        if not inserted:
            summary = _check_retry(db, run_id, source, expected_count, rows, _run(db, run_id))
        else:
            tests, events, count = [], [], 0
            for row in rows:
                result, history = _normalise(row)
                count += 1
                if count > expected_count:
                    raise ValueError(f'more than {expected_count} tests')
                tests.append((run_id, *result))
                events.extend((run_id, result[0], *entry) for entry in history)
                if len(tests) == BATCH_SIZE:
                    db.executemany(ADD_TEST, tests)
                    db.executemany(ADD_EVENT, events)
                    tests.clear()
                    events.clear()
            db.executemany(ADD_TEST, tests)
            db.executemany(ADD_EVENT, events)
            digest = _digest(run_id, source, expected_count, _database_rows(db, run_id))
            db.execute('UPDATE educational_audit_run SET digest=? WHERE run_id=?', (digest, run_id))
            summary = read_audit_summary(db, run_id)
    except sqlite3.IntegrityError as error:
        db.execute(f'ROLLBACK TO {savepoint}')
        db.execute(f'RELEASE {savepoint}')
        raise ValueError('duplicate test identity or invalid audit reference') from error
    except BaseException:
        db.execute(f'ROLLBACK TO {savepoint}')
        db.execute(f'RELEASE {savepoint}')
        raise
    db.execute(f'RELEASE {savepoint}')
    return summary
