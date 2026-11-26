(function (root) {
  'use strict';

  const commitments = [
    { id: 'A-C', order: 'A', type: 'تکمیل', wbs: 'D-A.20', due: null, before: 11, blocked: 15, external: 12, swap: 11, evidence: 'تأیید عملیات و آزادسازی آزمون' },
    { id: 'A-D', order: 'A', type: 'تحویل', wbs: 'D-A.30', due: 13, before: 13, blocked: 16, external: 13, swap: 13, evidence: 'مدرک تحویل طبق شرط قرارداد' },
    { id: 'A-R', order: 'A', type: 'وصول', wbs: 'D-A.40', due: null, before: 43, blocked: 46, external: 43, swap: 43, evidence: 'شرط پرداخت آموزشی؛ تحقق با تطبیق دریافت' },
    { id: 'B-C', order: 'B', type: 'تکمیل', wbs: 'D-B.20', due: null, before: 13, blocked: 13, external: 13, swap: 17, evidence: 'تأیید عملیات و آزادسازی آزمون' },
    { id: 'B-D', order: 'B', type: 'تحویل', wbs: 'D-B.30', due: 14, before: 14, blocked: 14, external: 14, swap: 18, evidence: 'مدرک تحویل طبق شرط قرارداد' },
    { id: 'B-R', order: 'B', type: 'وصول', wbs: 'D-B.40', due: null, before: null, blocked: null, external: null, swap: null, evidence: 'شرط پرداخت نامشخص است' }
  ];
  const options = [
    { id: 'external', title: 'آزمون بیرونی', costA: 10200, costB: 8000, incremental: 650 },
    { id: 'swap', title: 'جابه‌جایی نوبت آزمون', costA: 10100, costB: 8250, incremental: 100 }
  ];

  function difference(left, right) {
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
  }

  function evaluate(id, evidence) {
    const option = options.find(item => item.id === id);
    if (!option) return null;
    const rows = commitments.map(item => {
      const valid = item.id !== 'A-R' || evidence.payment;
      const without = valid ? item.blocked : null;
      const forecast = valid ? item[id] : null;
      return {
        ...item,
        before: valid ? item.before : null,
        without,
        forecast,
        issueEffect: difference(without, valid ? item.before : null),
        recovered: difference(without, forecast),
        dueDelta: difference(forecast, item.due)
      };
    });
    const hardBreaches = rows.filter(row => row.dueDelta > 0).map(row => row.id);
    const recovered = rows.find(row => row.id === 'A-R').recovered;
    const timing = recovered === null ? null : 60000 * 0.3 * recovered / 365;
    const costBenefit = 10800 + 8000 - option.costA - option.costB - option.incremental;
    const gates = [
      ['موعد سخت', hardBreaches.length ? 'رد' : 'تأیید'],
      ['سقف اقدام ۷۰۰', option.incremental <= 700 ? 'تأیید' : 'رد'],
      ['تأیید ظرفیت و کیفیت', id === 'external' && !evidence.external ? 'در انتظار شاهد' : 'تأیید آموزشی']
    ];
    return {
      rows, gates, hardBreaches, timing, costBenefit, subtotal: costBenefit + (timing ?? 0),
      complete: rows.every(row => row.forecast !== null),
      feasible: gates.every(([, value]) => value.startsWith('تأیید'))
    };
  }

  function performance() {
    const work = [
      { wbs: 'D-A.10', title: 'مهندسی و آماده‌سازی', budget: 60, planned: 1, accepted: 1, actualCost: 70 },
      { wbs: 'D-A.20', title: 'ساخت و آزمون', budget: 40, planned: 0.5, accepted: 0.5, actualCost: 25 }
    ];
    const planned = work.reduce((sum, item) => sum + item.budget * item.planned, 0);
    const earned = work.reduce((sum, item) => sum + item.budget * item.accepted, 0);
    const actual = work.reduce((sum, item) => sum + item.actualCost, 0);
    return { work, planned, earned, actual, physical: 100 * earned / 100, cpi: actual ? earned / actual : null };
  }

  root.PvptSapDemo = { commitments, options, evaluate, performance };
})(typeof module === 'object' ? module.exports : globalThis);
