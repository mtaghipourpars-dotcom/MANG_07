"""Shared demo case, role queues and immutable decision/outcome history."""
import sqlite3


def install(db):
    db.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS gov_authority (
      actor TEXT PRIMARY KEY, scope TEXT NOT NULL, ceiling INTEGER NOT NULL,
      deputy TEXT REFERENCES gov_authority(actor)
    );
    CREATE TABLE IF NOT EXISTS gov_case (
      id TEXT PRIMARY KEY, promise TEXT NOT NULL, issue TEXT NOT NULL,
      owner TEXT REFERENCES gov_authority(actor), amount INTEGER NOT NULL,
      policy_ceo INTEGER NOT NULL CHECK(policy_ceo IN (0,1)),
      risk TEXT NOT NULL, due INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gov_assignment (
      id INTEGER PRIMARY KEY, case_id TEXT NOT NULL REFERENCES gov_case(id),
      actor TEXT NOT NULL REFERENCES gov_authority(actor), assigned_at INTEGER NOT NULL,
      accept_by INTEGER NOT NULL, accepted_at INTEGER,
      CHECK(assigned_at < accept_by),
      CHECK(accepted_at IS NULL OR accepted_at BETWEEN assigned_at AND accept_by)
    );
    CREATE TABLE IF NOT EXISTS gov_decision (
      id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES gov_case(id),
      actor TEXT NOT NULL REFERENCES gov_authority(actor), decided_at INTEGER NOT NULL,
      approved_forecast INTEGER NOT NULL, directive TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gov_observation (
      id INTEGER PRIMARY KEY, case_id TEXT NOT NULL REFERENCES gov_case(id),
      decision TEXT NOT NULL REFERENCES gov_decision(id), observed_at INTEGER NOT NULL,
      actual INTEGER, evidence TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gov_event (
      sequence INTEGER PRIMARY KEY, case_id TEXT NOT NULL REFERENCES gov_case(id),
      occurred_at INTEGER NOT NULL, actor TEXT NOT NULL, status TEXT NOT NULL,
      detail TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS gov_decision_no_update BEFORE UPDATE ON gov_decision
      BEGIN SELECT RAISE(ABORT, 'approved snapshot immutable'); END;
    CREATE TRIGGER IF NOT EXISTS gov_decision_no_delete BEFORE DELETE ON gov_decision
      BEGIN SELECT RAISE(ABORT, 'approved snapshot immutable'); END;
    CREATE TRIGGER IF NOT EXISTS gov_observation_decision_scope BEFORE INSERT ON gov_observation
      WHEN NOT EXISTS (SELECT 1 FROM gov_decision
                       WHERE id=NEW.decision AND case_id=NEW.case_id
                         AND decided_at<=NEW.observed_at)
      BEGIN SELECT RAISE(ABORT, 'observation must follow its case decision'); END;
    """)


def records(db, sql, values=()):
    cursor = db.execute(sql, values)
    keys = [c[0] for c in cursor.description]
    return [dict(zip(keys, row)) for row in cursor.fetchall()]


def authorized(db, case_id, actor):
    return bool(db.execute("""
      SELECT 1 FROM gov_case c JOIN gov_authority a ON a.actor=?
      WHERE c.id=? AND c.amount<=a.ceiling AND
      (a.scope='enterprise' OR
       (c.policy_ceo=0 AND
        (c.owner=a.actor OR a.actor=
          (SELECT deputy FROM gov_authority WHERE actor=c.owner))))
    """, (actor, case_id)).fetchone())


def add_event(db, case_id, at, actor, status, detail):
    db.execute("INSERT INTO gov_event(case_id,occurred_at,actor,status,detail) VALUES(?,?,?,?,?)",
               (case_id, at, actor, status, detail))


def approve(db, directive, case_id, actor, at, forecast, text):
    assignment = records(db, """
      SELECT actor, accepted_at FROM gov_assignment
      WHERE case_id=? AND assigned_at<=? ORDER BY assigned_at DESC,id DESC LIMIT 1
    """, (case_id, at))
    if (not authorized(db, case_id, actor) or not assignment
        or assignment[0]["actor"] != actor or assignment[0]["accepted_at"] is None
        or assignment[0]["accepted_at"] > at):
        raise ValueError("scope, authority or acceptance missing")
    db.execute("INSERT INTO gov_decision VALUES(?,?,?,?,?,?)",
               (directive, case_id, actor, at, forecast, text))
    add_event(db, case_id, at, actor, "APPROVED", directive)


def route_expired(db, now):
    for row in records(db, """
      SELECT w.*,a.deputy FROM gov_assignment w
       JOIN gov_authority a ON a.actor=w.actor
      WHERE w.accepted_at IS NULL AND w.assigned_at<=? AND w.accept_by<=?
        AND w.id=(SELECT v.id FROM gov_assignment v WHERE v.case_id=w.case_id
                  AND v.assigned_at<=? ORDER BY v.assigned_at DESC,v.id DESC LIMIT 1)
        AND NOT EXISTS(SELECT 1 FROM gov_decision d WHERE d.case_id=w.case_id)
    """, (now, now, now)):
        deputy = row["deputy"]
        if (not deputy or not authorized(db, row["case_id"], deputy)
            or db.execute("SELECT 1 FROM gov_assignment WHERE case_id=? AND actor=?",
                          (row["case_id"], deputy)).fetchone()):
            add_event(db, row["case_id"], now, "SYSTEM", "SUPERVISOR_REVIEW",
                      "پیگیری مهلت پذیرش؛ اختیار تصویب خودکار تغییر نکرد")
            continue
        db.execute("""INSERT INTO gov_assignment(case_id,actor,assigned_at,accept_by)
                      VALUES(?,?,?,?)""", (row["case_id"], deputy, now, now + 60))
        add_event(db, row["case_id"], now, deputy, "DEPUTY_ASSIGNED", row["actor"])


def card(db, case_id, now):
    row = records(db, "SELECT * FROM gov_case WHERE id=?", (case_id,))[0]
    assignment = records(db, """
      SELECT actor,assigned_at,accept_by,accepted_at FROM gov_assignment
      WHERE case_id=? AND assigned_at<=? ORDER BY assigned_at DESC,id DESC LIMIT 1
    """, (case_id, now))
    decision = records(db, """
      SELECT * FROM gov_decision WHERE case_id=? AND decided_at<=?
      ORDER BY decided_at DESC,id DESC LIMIT 1
    """, (case_id, now))
    observed = records(db, """
      SELECT * FROM gov_observation WHERE case_id=? AND observed_at<=?
       AND decision=? ORDER BY observed_at DESC,id DESC LIMIT 1
    """, (case_id, now, decision[0]["id"] if decision else None))
    actual = observed[0]["actual"] if observed else None
    forecast = decision[0]["approved_forecast"] if decision else None
    status = records(db, """SELECT sequence,occurred_at,actor,status,detail FROM gov_event
                         WHERE case_id=? AND occurred_at<=?
                         ORDER BY occurred_at DESC,sequence DESC LIMIT 1""", (case_id, now))
    return {
        **row, "current_assignment": assignment[0] if assignment else None,
        "approved_snapshot": decision[0] if decision else None,
        "observed_result": observed[0] if observed else None,
        "latest_valid_status": status[0] if status else None,
        "forecast_error_minutes": actual - forecast if actual is not None else None,
        "residual_minutes": (max(0, actual - row["due"]) if actual is not None else None),
        "remaining_risk_status": (
            "UNVERIFIED" if actual is None else
            "LATE_REALIZED" if actual > row["due"] else "MET_VERIFIED"
        ),
    }


def demo(db, now=0):
    """Insert a deterministic synthetic fixture in a fresh demo database."""
    install(db)
    db.executemany("INSERT INTO gov_authority VALUES(?,?,?,?)", (
        ("CEO", "enterprise", 10000, None),
        ("OPS-DEPUTY", "unit", 180, None),
        ("OPS", "unit", 200, "OPS-DEPUTY"),
    ))
    db.executemany("INSERT INTO gov_case VALUES(?,?,?,?,?,?,?,?)", (
        ("EXEC-FIN-01", "PAY-FAT-01", "گزینه آزمون بیرونی نیازمند تصمیم و تأیید نقد", "OPS", 480, 1, "HIGH", now + 360),
        ("EXEC-GOV-02", "DELIVERY-02", "خرابی ایستگاه؛ دامنه اختیار واحد", "OPS", 140, 0, "HIGH", now + 720),
        ("EXEC-GOV-03", "DELIVERY-03", "پیگیری دستور اجرایی روز قبل", "OPS", 170, 0, "HIGH", now - 120),
    ))
    db.executemany("""INSERT INTO gov_assignment(case_id,actor,assigned_at,accept_by,accepted_at)
                      VALUES(?,?,?,?,?)""", (
        ("EXEC-FIN-01", "CEO", now - 90, now + 120, None),
        ("EXEC-GOV-02", "OPS", now - 180, now - 60, None),
        ("EXEC-GOV-03", "OPS", now - 1560, now - 1500, now - 1530),
    ))
    add_event(db, "EXEC-FIN-01", now - 90, "ASSESSOR", "CEO_DECISION_REQUIRED", "خارج از سقف اختیار واحد")
    add_event(db, "EXEC-GOV-02", now - 180, "EXPERT", "REPORTED", "پرونده تحت اختیار واحد")
    approve(db, "ORDER-YDAY-03", "EXEC-GOV-03", "OPS", now - 1440, now - 180,
            "نوبت آزمون جایگزین اجرا شود")
    add_event(db, "EXEC-GOV-03", now - 90, "OPS", "IN_EXECUTION", "تحویل در انتظار شاهد")
    db.execute("""INSERT INTO gov_observation(case_id,decision,observed_at,actual,evidence)
                   VALUES(?,?,?,?,?)""",
               ("EXEC-GOV-03", "ORDER-YDAY-03", now - 30, now - 45, "DEMO-POD-03"))
    add_event(db, "EXEC-GOV-03", now - 30, "REVIEWER", "RESULT_VERIFIED", "DEMO-POD-03")
    route_expired(db, now)
    ids = [r[0] for r in db.execute("SELECT id FROM gov_case ORDER BY id")]
    cards = {case_id: card(db, case_id, now) for case_id in ids}
    result = {
        "cards": cards,
        "ceo_queue": [row for row in cards.values()
                      if row["current_assignment"] and row["current_assignment"]["actor"] == "CEO"
                      and authorized(db, row["id"], "CEO") and row["approved_snapshot"] is None],
        "high_risk_watch": [row["id"] for row in cards.values()
                            if row["risk"] == "HIGH" and
                            (not row["current_assignment"] or row["current_assignment"]["actor"] != "CEO")],
        "changes_since_visit": records(db, """
          SELECT * FROM gov_event WHERE occurred_at>? AND occurred_at<=?
          ORDER BY occurred_at, sequence
        """, (now - 240, now)),
        "previous_visit": now - 240,
        "role_views": {
            "OWNER": [{"id": row["id"], "promise": row["promise"], "due": row["due"]} for row in cards.values()],
            "EXPERT": [{"id": row["id"], "issue": row["issue"]} for row in cards.values()],
            "ASSESSOR": [{"id": row["id"], "risk": row["risk"], "amount": row["amount"]}
                         for row in cards.values()],
            "DECIDER": [{"id": row["id"], "assignment": row["current_assignment"]}
                        for row in cards.values() if row["current_assignment"]],
        },
        "yesterday_directive": cards["EXEC-GOV-03"],
    }
    verify(db, result)
    return result


def verify(db, result):
    """Executable acceptance checks for the role queue and decision history."""
    if [row["id"] for row in result["ceo_queue"]] != ["EXEC-FIN-01"]:
        raise AssertionError("watch items leaked into CEO decision queue")
    if result["cards"]["EXEC-GOV-02"]["current_assignment"]["actor"] != "OPS-DEPUTY":
        raise AssertionError("eligible deputy routing failed")
    observed = result["yesterday_directive"]
    if observed["residual_minutes"] != 75 or observed["forecast_error_minutes"] != 135:
        raise AssertionError("actual did not refresh risk while retaining approved baseline")
    if authorized(db, "EXEC-FIN-01", "OPS") or authorized(db, "EXEC-FIN-01", "OPS-DEPUTY"):
        raise AssertionError("case ceiling enforcement failed")
    if "RESULT_VERIFIED" not in {row["status"] for row in result["changes_since_visit"]}:
        raise AssertionError("outcome not marked in since-visit delta")
    try:
        db.execute("UPDATE gov_decision SET approved_forecast=0 WHERE id='ORDER-YDAY-03'")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("approved forecast mutable")
