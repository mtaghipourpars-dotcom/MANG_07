"""Independently verify audit persistence and the recorded HTTP workflow."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
from tempfile import TemporaryDirectory
from threading import Barrier
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scenario-lab'))
from audit_store import persist_audit, verify_audit


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fixture(case='S000001', outcome='PASS', action='REPORT'):
    return {
        'test_id': 'HTTP-' + case, 'scenario_id': case, 'stage': 'manufacturing',
        'outcome': outcome, 'decision': 'تصمیم و دلیل ثبت شد', 'lesson': 'درس آزمون',
        'events': [{'actor': 'EXPERT', 'action': action, 'status': 'REPORTED'}],
        'evidence': {'elapsed_ms': 1, 'source': 'fixture'},
    }


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys=ON')

    def write(self, rows, expected=None, run_id='run1'):
        return persist_audit(self.db, run_id=run_id, source='fixture',
                             expected_count=expected if expected is not None else len(rows), rows=rows)

    def test_exact_retry_is_order_independent(self):
        rows = [fixture(), fixture('S000002', 'FAIL'), fixture('S000003', 'BLOCKED')]
        first = self.write(rows)
        self.assertEqual(first, self.write(rows[::-1]))
        self.assertEqual(first, verify_audit(self.db, 'run1'))
        self.assertEqual(first['outcomes'], {'PASS': 1, 'FAIL': 1, 'BLOCKED': 1})
        self.assertEqual(first['event_count'], 3)

    def test_rejected_retry_preserves_previous_record(self):
        rows = [fixture()]
        first = self.write(rows)
        with self.assertRaisesRegex(ValueError, 'retry differs'):
            self.write([fixture(action='ASSESS')])
        self.assertEqual(first, verify_audit(self.db, 'run1'))

    def test_rollback_of_duplicate_and_incomplete_run(self):
        old = self.write([fixture()])
        for rows, expected in [([fixture(), fixture()], 2), ([fixture()], 2)]:
            with self.subTest(expected=expected, count=len(rows)), self.assertRaises(ValueError):
                self.write(rows, expected, 'run2')
            self.assertEqual(self.db.execute('SELECT run_id FROM educational_audit_run').fetchall(), [('run1',)])
        self.assertEqual(old, verify_audit(self.db, 'run1'))

    def test_late_invalid_record_rolls_back_flushed_batch(self):
        old = self.write([fixture()])
        rows = [fixture(f'S{i:06}') for i in range(1, 751)]
        rows.append({**fixture('S000751'), 'lesson': ' '})
        with self.assertRaisesRegex(ValueError, 'lesson'):
            self.write(rows, run_id='run2')
        self.assertEqual(old, verify_audit(self.db, 'run1'))
        self.assertEqual(self.db.execute('SELECT count(*) FROM educational_audit_test').fetchone(), (1,))
        self.assertEqual(self.db.execute('SELECT count(*) FROM educational_audit_event').fetchone(), (1,))

    def test_detects_content_and_event_tampering(self):
        self.write([fixture()])
        self.db.execute("UPDATE educational_audit_test SET decision='changed'")
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            verify_audit(self.db, 'run1')
        self.db.execute('DELETE FROM educational_audit_event')
        with self.assertRaisesRegex(ValueError, 'missing or unordered events'):
            verify_audit(self.db, 'run1')

    def test_concurrent_exact_retries_reuse_one_run(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / 'audit.sqlite'
            ready = Barrier(2)

            def submit(rows):
                with closing(sqlite3.connect(path, timeout=10)) as db:
                    db.execute('PRAGMA foreign_keys=ON')
                    ready.wait(timeout=10)
                    return persist_audit(db, run_id='shared', source='fixture',
                                         expected_count=2, rows=rows)

            rows = [fixture(), fixture('S000002', 'FAIL')]
            with ThreadPoolExecutor(max_workers=2) as pool:
                left, right = pool.map(submit, (rows, rows[::-1]))
            self.assertEqual(left, right)
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM educational_audit_run').fetchone(), (1,))
                self.assertEqual(left, verify_audit(db, 'shared'))


def read_only(path):
    return path.resolve().as_uri() + '?mode=ro'


def check_directory(directory):
    report = json.loads((directory / 'report.json').read_text(encoding='utf-8'))
    workflow = json.loads((ROOT / 'DEV/api-contract.json').read_text(encoding='utf-8'))['workflow']
    transitions = {(r['from'], r['actor'], r['action'], r['to']): r.get('requiresAll', {})
                   for r in workflow['transitions']}
    run_id = report['run_id']
    counts = Counter()
    covered_states = Counter()
    covered_edges = Counter()
    action_count = 0
    lesson_count = 0
    with closing(sqlite3.connect(read_only(directory / 'total-demo.sqlite'), uri=True)) as db:
        require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'Invalid bank SQLite file')
        require(not db.execute('PRAGMA foreign_key_check').fetchall(), 'Broken bank foreign keys')
        require(verify_audit(db, run_id) == report['database'], 'Report diverges from audit rows')
        db.execute('ATTACH DATABASE ? AS runtime', (read_only(directory / 'audit-workspace.sqlite'),))
        require(db.execute('PRAGMA runtime.integrity_check').fetchall() == [('ok',)], 'Invalid runtime SQLite file')
        require(not db.execute('PRAGMA runtime.foreign_key_check').fetchall(), 'Broken runtime foreign keys')
        workspaces = db.execute('SELECT id FROM runtime.workspaces').fetchall()
        require(len(workspaces) == 1, 'Expected exactly one isolated audit workspace')
        workspace = workspaces[0][0]
        expected = db.execute('SELECT count(*) FROM scenario').fetchone()[0]
        require(expected == report['expected'] == report['linked_cases'], 'Wrong case denominator')
        require(not db.execute("""
            SELECT s.id FROM scenario s LEFT JOIN educational_audit_test t
              ON t.run_id=? AND t.scenario_id=s.id AND t.stage=s.stage
                 AND t.test_id='HTTP-' || s.id
            WHERE t.test_id IS NULL LIMIT 1
        """, (run_id,)).fetchone(), 'At least one case has no associated HTTP result')
        rows = db.execute("""
            SELECT s.id, s.stage, s.gate, s.decision, s.outcome, t.test_id, t.outcome,
                   t.decision, t.lesson, t.evidence_json
              FROM educational_audit_test t JOIN scenario s
                ON s.id=t.scenario_id AND s.stage=t.stage
             WHERE t.run_id=? ORDER BY s.id
        """, (run_id,))
        for case, stage, gate, model_decision, model_outcome, test_id, outcome, decision, lesson, evidence in rows:
            require(test_id == 'HTTP-' + case and decision.strip() and lesson.strip(),
                    f'{case}: missing decision, lesson or canonical result ID')
            evidence = json.loads(evidence)
            fixture_input = evidence['input']
            require((fixture_input['id'], fixture_input['stage'], fixture_input['gate'],
                     fixture_input['decision'], fixture_input['outcome']) ==
                    (case, stage, gate, model_decision, model_outcome), f'{case}: wrong input trace')
            require(evidence['source'] == report['source'] and evidence['elapsed_ms'] >= 0,
                    f'{case}: wrong run provenance or duration')
            history = db.execute("""
                SELECT sequence,actor,action,status FROM educational_audit_event
                 WHERE run_id=? AND test_id=? ORDER BY sequence
            """, (run_id, test_id)).fetchall()
            counts[outcome] += 1
            if outcome != 'PASS':
                require(evidence['error'], f'{case}: no reason recorded for unsuccessful run')
                continue
            require(all(evidence['review']['assertions'].values()),
                    f'{case}: an analysis assertion failed despite PASS')
            initial = workflow['initial']['status']
            require(history[0] == (1, 'SYSTEM', 'INITIAL_STATE', initial), f'{case}: invalid initial state')
            stored = db.execute("""
                SELECT revision,actor,action,status FROM runtime.total_demo_actions
                 WHERE workspace_id=? AND scenario_id=? ORDER BY revision
            """, (workspace, case)).fetchall()
            state = initial
            covered_states[state] += 1
            for sequence, actor, action, target in history[1:]:
                edge = (state, actor, action, target)
                require(edge in transitions, f'{case}: unknown transition {edge}')
                require(all(fixture_input[k] in vals for k, vals in transitions[edge].items()),
                        f'{case}: preconditions false for {edge}')
                covered_edges[' → '.join(edge)] += 1
                covered_states[target] += 1
                state = target
            require(stored == [(seq - 1, *event) for seq, *event in history[1:]],
                    f'{case}: runtime actions diverge from recorded HTTP evidence')
            action_count += len(stored)
            runtime_lessons = db.execute("""
                SELECT close_revision, observation_revision, decision_revision, text
                  FROM runtime.total_demo_lessons WHERE workspace_id=? AND scenario_id=?
            """, (workspace, case)).fetchall()
            if covered := [revision for revision, _, _, status in stored if status == 'OBSERVED']:
                approvals = [revision for revision, _, _, status in stored if status == 'APPROVED']
                require(runtime_lessons == [(len(stored), covered[0], approvals[0], lesson)],
                        f'{case}: runtime lesson does not match approval, observation and close')
                lesson_count += 1
            else:
                require(not runtime_lessons, f'{case}: recorded an outcome lesson without observation')
            require(evidence['actual'] == state and evidence['revision'] == len(stored)
                    and evidence['expected'] == [r[3] for r in history] and evidence['error'] is None,
                    f'{case}: final status, revision or expected path diverges')
        expected_states = {workflow['initial']['status'], *(edge[3] for edge in transitions)}
        require(sum(counts.values()) == expected, 'Incomplete result counts')
        require(dict(counts) == report['execution'], 'Outcome count mismatch')
        require(set(covered_states) == expected_states, 'Uncovered workflow states')
        require(len(covered_edges) == len(transitions), 'Uncovered workflow transitions')
        if counts['PASS'] == expected:
            require(db.execute('SELECT count(*) FROM runtime.total_demo_actions').fetchone()[0]
                    == action_count, 'Unexpected runtime actions')
            require(db.execute('SELECT count(*) FROM runtime.total_demo_lessons').fetchone()[0]
                    == lesson_count, 'Unexpected runtime lessons')
    return {'run_id': run_id, 'expected': expected, 'counts': dict(counts),
            'covered_states': dict(covered_states), 'covered_edges': dict(covered_edges),
            'matched_runtime_actions': action_count, 'matched_runtime_outcome_lessons': lesson_count,
            'passed': counts['PASS'] == expected}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path)
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(StoreTests)
    if not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful():
        return 1
    if args.run_dir:
        result = check_directory(args.run_dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return int(not result['passed'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
