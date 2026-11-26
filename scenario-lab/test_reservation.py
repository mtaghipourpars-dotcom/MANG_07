import sqlite3
import unittest

from reservation import active_reservations, approve, init_reservations, register_option, reserve


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys=ON')
        init_reservations(self.db)
        for i in ('A', 'B'):
            register_option(self.db, f'O{i}', i)

    def ask(self, key, order, start=120, end=180, now=0, expires=90):
        return reserve(self.db, reservation_id=key, option_id=f'O{order}',
                       decision_id=f'D{order}', resource='FAT-1', start=start, end=end,
                       expires=expires, owner='scheduler', order_id=order, now=now)

    def test_choice_approval_and_reservation_distinct(self):
        self.assertEqual(self.ask('early', 'A')['status'], 'APPROVAL_REQUIRED')
        approve(self.db, 'DA', 'OA', 'CEO', 0)
        self.assertEqual(active_reservations(self.db, 0), [])
        self.assertEqual(self.ask('booked', 'A')['status'], 'RESERVED')

    def test_cross_order_conflict_adjacency_and_expiry(self):
        for i in ('A', 'B'):
            approve(self.db, f'D{i}', f'O{i}', 'CEO', 0)
        self.ask('R1', 'A')
        self.assertEqual(self.ask('R2', 'B', 179, 220),
                         {'status': 'BLOCKED_CONFLICT', 'conflicting_orders': ['A']})
        self.assertEqual(self.ask('R3', 'B', 180, 220)['status'], 'RESERVED')
        self.assertEqual(self.ask('R4', 'B', now=90, expires=100)['status'], 'RESERVED')
        self.assertEqual([r[0] for r in active_reservations(self.db, 90)], ['R4'])
        self.assertEqual(self.db.execute('SELECT * FROM portfolio_reservation_conflict').fetchall(),
                         [('R2', 'R1')])

    def test_parallel_requests_cannot_both_reserve(self):
        from concurrent.futures import ThreadPoolExecutor
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from threading import Barrier

        with TemporaryDirectory() as directory:
            path = Path(directory) / 'portfolio.sqlite'
            db = sqlite3.connect(path)
            try:
                init_reservations(db)
                for i in ('A', 'B'):
                    register_option(db, f'O{i}', i)
                    approve(db, f'D{i}', f'O{i}', 'CEO', 0)
                db.commit()
            finally:
                db.close()
            start_together = Barrier(2)

            def request(order):
                db = sqlite3.connect(path)
                try:
                    start_together.wait(timeout=3)
                    return reserve(
                        db, reservation_id=f'R{order}', option_id=f'O{order}',
                        decision_id=f'D{order}', resource='FAT-1', start=120, end=180,
                        expires=90, owner='scheduler', order_id=order, now=0
                    )['status']
                finally:
                    db.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(request, ('A', 'B')))
            self.assertCountEqual(statuses, ['RESERVED', 'BLOCKED_CONFLICT'])
