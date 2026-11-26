import json
import sqlite3
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from build_bank import build_bank


class BankReleaseTest(TestCase):
    evidence = Path(__file__).with_name('evidence')

    def test_reviewed_scenario_and_executive_engines_share_one_database(self):
        with TemporaryDirectory() as directory:
            bank = Path(directory) / 'bank.sqlite'
            summary = build_bank(bank, self.evidence)
            with closing(sqlite3.connect(bank.as_uri() + '?mode=ro', uri=True)) as db:
                views = {name: json.loads(payload) for name, payload in
                         db.execute('SELECT view_id, payload FROM scenario_bank_view')}
                self.assertEqual(db.execute('PRAGMA user_version').fetchone(), (1,))
                self.assertEqual(views['summary'], summary)
                for table, metric in [('scenario', 'scenarios'), ('effect', 'effects'), ('event', 'events')]:
                    self.assertEqual(db.execute(f'SELECT count(*) FROM {table}').fetchone(), (summary[metric],))
                self.assertEqual(views['executive'], json.loads((self.evidence / 'executive.json').read_text()))
                self.assertEqual(views['release']['data_class'], 'DEMO_SYNTHETIC')
            with self.assertRaises(FileExistsError):
                build_bank(bank, self.evidence)

    def test_evidence_mismatch_does_not_publish_a_bank(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'summary.json').write_text('{}')
            (root / 'executive.json').write_text('{}')
            bank = root / 'bank.sqlite'
            with self.assertRaisesRegex(ValueError, 'reviewed summary'):
                build_bank(bank, root)
            self.assertFalse(bank.exists())
