"""Exclusive, time-phased portfolio reservations for synthetic demo data."""
from contextlib import contextmanager


def init_reservations(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS portfolio_option(
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS portfolio_decision(
        id TEXT PRIMARY KEY, option_id TEXT NOT NULL REFERENCES portfolio_option,
        actor TEXT NOT NULL, approved_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS portfolio_reservation(
        id TEXT PRIMARY KEY, decision_id TEXT NOT NULL REFERENCES portfolio_decision,
        resource TEXT NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, owner TEXT NOT NULL, order_id TEXT NOT NULL,
        recorded_at INTEGER NOT NULL, CHECK(start_min < end_min));
    CREATE INDEX IF NOT EXISTS portfolio_resource_window
        ON portfolio_reservation(resource, start_min, end_min, expires_at);
    CREATE TABLE IF NOT EXISTS portfolio_reservation_attempt(
        id TEXT PRIMARY KEY, option_id TEXT NOT NULL, decision_id TEXT NOT NULL,
        resource TEXT NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, owner TEXT NOT NULL, order_id TEXT NOT NULL,
        recorded_at INTEGER NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS portfolio_reservation_conflict(
        attempt_id TEXT NOT NULL REFERENCES portfolio_reservation_attempt,
        reservation_id TEXT NOT NULL REFERENCES portfolio_reservation,
        PRIMARY KEY(attempt_id, reservation_id));
    """)


@contextmanager
def _atomic(db):
    # First reservation statement is a write, acquiring SQLite's writer lock
    # before the overlap query, including when called inside a transaction.
    db.execute('SAVEPOINT pvpt_reserve')
    try:
        yield
    except Exception:
        db.execute('ROLLBACK TO pvpt_reserve')
        raise
    finally:
        db.execute('RELEASE pvpt_reserve')


def register_option(db, option_id, order_id):
    db.execute('INSERT INTO portfolio_option VALUES(?,?)', (option_id, order_id))


def approve(db, decision_id, option_id, actor, now):
    if not db.execute('SELECT 1 FROM portfolio_option WHERE id=?', (option_id,)).fetchone():
        raise ValueError('Unknown option')
    db.execute('INSERT INTO portfolio_decision VALUES(?,?,?,?)', (decision_id, option_id, actor, now))


def active_reservations(db, now):
    return db.execute("""
        SELECT id, resource, start_min, end_min, expires_at, owner, order_id
        FROM portfolio_reservation
        WHERE recorded_at <= ? AND expires_at > ? AND end_min > ?
        ORDER BY start_min, id
        """, (now, now, now)).fetchall()


def reserve(db, *, reservation_id, option_id, decision_id, resource, start, end,
            expires, owner, order_id, now):
    if not all(type(value) is int for value in (start, end, expires, now)):
        raise ValueError('Time must be an integer minute')
    if not all(value and isinstance(value, str) for value in
               (reservation_id, option_id, decision_id, resource, owner, order_id)):
        raise ValueError('Reservation identifiers and owner are required')
    if start >= end or start < now or expires <= now:
        raise ValueError('Invalid request interval or expiry')
    with _atomic(db):
        db.execute('INSERT INTO portfolio_reservation_attempt VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                   (reservation_id, option_id, decision_id, resource, start, end,
                    expires, owner, order_id, now, 'PENDING'))
        approval = db.execute("""
            SELECT 1 FROM portfolio_decision d JOIN portfolio_option o ON o.id=d.option_id
            WHERE d.id=? AND d.option_id=? AND o.order_id=? AND d.approved_at<=?
            """, (decision_id, option_id, order_id, now)).fetchone()
        collisions = []
        if not approval:
            status = 'APPROVAL_REQUIRED'
        else:
            collisions = db.execute("""
                SELECT id, order_id FROM portfolio_reservation
                WHERE resource=? AND expires_at>? AND start_min<? AND end_min>?
                ORDER BY id
                """, (resource, now, end, start)).fetchall()
            status = 'BLOCKED_CONFLICT' if collisions else 'RESERVED'
        db.execute('UPDATE portfolio_reservation_attempt SET status=? WHERE id=?',
                   (status, reservation_id))
        if status == 'RESERVED':
            db.execute('INSERT INTO portfolio_reservation VALUES(?,?,?,?,?,?,?,?,?)',
                       (reservation_id, decision_id, resource, start, end,
                        expires, owner, order_id, now))
        db.executemany('INSERT INTO portfolio_reservation_conflict VALUES(?,?)',
                       ((reservation_id, row[0]) for row in collisions))
        return {'status': status, 'conflicting_orders': sorted({row[1] for row in collisions})}
