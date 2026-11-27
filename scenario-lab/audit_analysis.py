"""Explain one existing scenario run using only its recorded bank evidence."""

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path


def delta(left, right):
    return left - right if left is not None and right is not None else None


def analyze_case(record):
    """Accept the JSON shape returned by run.py --case. Do not mutate the record."""
    case_id = record['id']
    gate = record['gate']
    decision = record['decision']
    execution = record['execution']
    outcome = record['outcome']
    events = record['event']
    effects = []
    donor_effect = None
    for row in record['effect']:
        node = row['node']
        effect = {
            'node': node,
            'baseline_delay_without_action_days': delta(row['without_action'], row['baseline']),
            'proposed_recovery_days': delta(row['without_action'], row['proposed']),
            'observed_delay_vs_baseline_days': delta(row['observed'], row['baseline']),
            'observed_deviation_vs_proposal_days': delta(row['observed'], row['proposed']),
            'observation_available': row['observed'] is not None,
            'forecast_matches_observation': (
                row['current_forecast'] == row['observed'] if row['observed'] is not None else None
            ),
        }
        if node == 'donor_delivery':
            donor_effect = effect
        else:
            effects.append(effect)
    missing = [effect['node'] for effect in effects if not effect['observation_available']]
    observed = len(effects) - len(missing)
    lesson_events = [event for event in events if event['action'] == 'LESSON']
    expected_lesson = outcome in ('VERIFIED', 'PARTIALLY_VERIFIED')
    eligible = (
        decision == 'APPROVED' and execution in ('COMPLETED', 'FAILED', 'PARTIAL') and
        expected_lesson and observed > 0 and bool(lesson_events)
    )
    if eligible:
        qualifier = 'پوشش شاهد کامل' if outcome == 'VERIFIED' and not missing else 'پوشش شاهد جزئی'
        lesson = (
            f'رویداد آموزشی {lesson_events[-1]["status"]} با {observed} مشاهده از {len(effects)} مرحله '
            f'({qualifier}) قابل بازبینی است. هر درس تحلیلی را به اختلاف مشاهده و مبنا یا پیشنهاد همین اجرا پیوند بده.'
        )
    else:
        lesson = (
            f'با وضعیت اجرای {execution} و نتیجهٔ {outcome}، شاهد کافی برای درس مبتنی بر نتیجه '
            'احراز نشد. علت و رویدادهای موجود برای بازبینی قابل استفاده‌اند.'
        )
    disposition = f'تصمیم ثبت‌شده {decision} با قید {gate}، اجرای {execution} و نتیجهٔ {outcome}.'
    if donor_effect and (donor_effect['proposed_recovery_days'] or 0) < 0:
        displacement = -donor_effect['proposed_recovery_days']
        disposition += f' پیشنهاد برای تعهد اهداکننده {displacement} روز اثر نامطلوب دارد.'
    baseline = next((effect for effect in effects if effect['node'] == record['stage']), None)
    return {
        'scenario_id': case_id,
        'data_class': record['data_class'],
        'decision': disposition,
        'lesson': lesson,
        'decision_code': decision,
        'lesson_eligible': eligible,
        'lifecycle': {'gate': gate, 'decision': decision, 'execution': execution, 'outcome': outcome},
        'issue': {
            'stage': record['stage'],
            'resource': record['resource'],
            'profile': record['profile'],
            'baseline_delay_without_action_days': (
                baseline['baseline_delay_without_action_days'] if baseline else None
            ),
        },
        'observation_coverage': {'observed': observed, 'total': len(effects), 'missing_nodes': missing},
        'effects': effects,
        'donor_effect': donor_effect,
        'assertions': {
            'educational_source': record['data_class'] == 'DEMO_SYNTHETIC',
            'record_links_match': all(row['scenario'] == case_id for row in [*record['effect'], *events]),
            'gate_allows_recorded_approval': decision != 'APPROVED' or gate == 'FEASIBLE',
            'observations_follow_approval': not observed or decision == 'APPROVED',
            'recorded_observations_match_current_forecast': all(
                effect['forecast_matches_observation'] is not False for effect in effects
            ),
            'verified_has_complete_observations': bool(effects) and (outcome != 'VERIFIED' or not missing),
            'lesson_event_matches_recorded_outcome': bool(lesson_events) == expected_lesson,
        },
    }


def read_case(database, case_id):
    """Read the bank without creating a missing DB or upgrading its schema."""
    uri = Path(database).resolve().as_uri() + '?mode=ro'
    with closing(sqlite3.connect(uri, uri=True)) as db:
        db.row_factory = sqlite3.Row
        row = db.execute('SELECT * FROM scenario WHERE id = ?', (case_id,)).fetchone()
        if row is None:
            raise ValueError(f'Scenario not found: {case_id}')
        record = dict(row)
        record['event'] = [dict(value) for value in db.execute(
            'SELECT * FROM event WHERE scenario = ? ORDER BY sequence', (case_id,)
        )]
        record['effect'] = [dict(value) for value in db.execute(
            'SELECT * FROM effect WHERE scenario = ? ORDER BY node', (case_id,)
        )]
        return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--case', required=True)
    args = parser.parse_args()
    try:
        analysis = analyze_case(read_case(args.db, args.case))
    except (sqlite3.Error, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(analysis, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
