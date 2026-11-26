'use strict';
const { commitments, options, evaluate, performance } = window.PvptSapDemo;
const screen = document.querySelector('#screen');
const notice = document.querySelector('#notice');
const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const show = value => value === null ? 'نامشخص' : number.format(value);
const badge = (value, kind = '') => '<span class="tag ' + kind + '">' + value + '</span>';
const button = (label, action, enabled = true) =>
  '<button class="primary" data-action="' + action + '"' + (enabled ? '' : ' disabled') + '>' + label + '</button>';
const initial = () => ({ role: 'owner', order: 'A', issue: false, payment: true, external: false, reviewed: null, decision: null, started: false, observed: false, lesson: false });
let state = initial();

function table(headers, rows) {
  return '<div class="table-frame"><table><thead><tr>' + headers.map(value => '<th scope="col">' + value + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(value => '<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function panel(title, body) {
  return '<article class="card"><h2>' + title + '</h2>' + body + '</article>';
}
function flags() {
  return { payment: state.payment, external: state.external };
}
function approvalIsCurrent() {
  return state.decision && state.decision.payment === state.payment && state.decision.external === state.external;
}
function owner() {
  const projection = state.decision ? evaluate(state.decision.id, state.decision) : null;
  const rows = commitments.filter(item => item.order === state.order).map(item => {
    const actual = item.id === 'A-D' && state.observed ? 14 : null;
    const without = evaluate('external', flags()).rows.find(row => row.id === item.id).without;
    const approved = projection?.rows.find(row => row.id === item.id).forecast ?? null;
    const forecast = actual ?? (state.decision ? (approvalIsCurrent() ? approved : null) :
      state.issue ? without : item.id === 'A-R' && !state.payment ? null : item.before);
    return [item.type, '<code>' + item.wbs + '</code>', show(item.due), show(forecast), show(approved), show(actual), item.evidence];
  });
  return panel('نمای مالک تعهد',
    '<div class="actions">' + button('سفارش الف', 'orderA') + button('سفارش ب', 'orderB') + '</div>' +
    table(['تعهد','WBS آموزشی','موعد سخت','وضع مؤثر جاری','پیش‌بینی مصوب','مشاهده','شاهد تحقق'], rows) +
    '<p>' + (state.order === 'A' ? 'عملیات آزمون نهایی سفارش الف به نوبت ایستگاه مشترک وابسته است.' :
    'عملیات آزمون نهایی سفارش ب به نوبت ایستگاه مشترک وابسته است. سناریوی انتقال نوبت، تحویل ب را چهار روز عقب می‌اندازد.') + '</p>' +
    button(state.issue ? 'باز کردن چالش مشترک' : 'رفتن به ثبت چالش', 'openIssue') +
    (state.lesson ? '<p>درس مشترک L-01 · در برآورد آزمون بیرونی، پذیرش و بازگشت محصول را جدا لحاظ کنید.</p>' : '')) +
    (state.order === 'A' ? performancePanel() : '');
}
function performancePanel() {
  const p = performance();
  return panel('پیشرفت و کارایی هزینه · نمونه مستقل گزارش میان‌دوره‌ای الف',
    '<p>خط مبنای آموزشی نسخه ۱ · برش روز ۸ · واحد هزینه: میلیارد تومان</p>' +
    table(['WBS','بسته کاری','بودجه','درصد کار تأییدشده','هزینه واقعی نمونه'], p.work.map(item =>
      ['<code>' + item.wbs + '</code>', item.title, show(item.budget), show(100 * item.accepted) + '٪', show(item.actualCost)])) +
    '<div class="meta">' + badge('پیشرفت وزنی: ' + show(p.physical) + '٪') +
    badge('PV: ' + show(p.planned)) + badge('EV: ' + show(p.earned)) + badge('AC: ' + show(p.actual)) +
    badge('CPI: ' + show(p.cpi), 'warning') + '</div><p>این برش تاریخی آموزشی از برآورد هزینه تکمیل گزینه‌ها جداست.</p>');
}
function expert() {
  return panel('ثبت و بررسی اولیه چالش',
    '<p>مدرک آموزشی: توقف ایستگاه آزمون مشترک. مسیر وابستگی: ایستگاه مشترک ← عملیات آزمون در اردرها ← WBS ← تعهد.</p>' +
    '<div class="meta">' + badge('منبع: TEST-CELL-01') + badge('پرونده آموزشی: C-01') + '</div>' +
    '<p>اثر مقدماتی: سفارش الف نیازمند بررسی. نوبت فعلی سفارش ب در گزینه بدون اقدام حفظ می‌شود.</p>' +
    button('مشاهده تعهد سفارش الف', 'showCommitment') +
    button(state.issue ? 'ارجاع به ارزیابی' : 'ثبت مشاهده آموزشی و ارجاع', 'recordIssue'));
}
function assessor() {
  if (!state.issue) return panel('ارزیابی اثر', '<p>ابتدا مشاهده توقف را از فضای کارشناس ثبت کنید.</p>');
  return panel('ارزیاب اثر و راهکار · پرونده C-01',
    '<fieldset><legend>شواهد آموزشی و فرض‌های ارزیابی</legend>' +
    '<label><input type="checkbox" data-evidence="external"' + (state.external ? ' checked' : '') + '> نوبت بیرونی و امکان پذیرش کیفیت تأیید فرضی دارد</label>' +
    '<label><input type="checkbox" data-evidence="payment"' + (state.payment ? ' checked' : '') + '> شرط اثر تحویل بر وصول الف در سناریو احراز شده است</label></fieldset>' +
    '<div class="option-grid">' + options.map(item => {
      const result = evaluate(item.id, flags());
      return '<div class="option"><h3>' + item.title + '</h3>' +
        table(['تعهد','بدون اقدام','با گزینه','تأخیر از موعد'], result.rows.map(row =>
          [row.order + ' · ' + row.type, show(row.without), show(row.forecast), show(row.dueDelta)])) +
        '<p>هزینه افزایشی اقدام: ' + show(item.incremental) + ' · اثر هزینه تکمیل: ' + show(result.costBenefit) +
        ' · منفعت زمانی وصول: ' + show(result.timing) + ' میلیون تومان</p>' +
        '<p>خالص اقلام عدددار: ' + show(result.subtotal) + ' میلیون تومان' + (result.complete ? '' : ' · پوشش ناقص') + '</p>' +
        '<div class="meta">' + result.gates.map(([gate, status]) => badge(gate + ' · ' + status, status.startsWith('تأیید') ? 'positive' : 'warning')).join('') + '</div></div>';
    }).join('') + '</div>' + button('ثبت ارزیابی برای صف تصمیم', 'review'));
}
function executive() {
  if (!state.reviewed) return panel('صف تصمیم', '<p>ارزیابی این نسخه هنوز ثبت نشده است.</p>');
  const result = evaluate('external', flags());
  return panel('تصمیم و نتیجه · پرونده C-01',
    '<p>جابه‌جایی نوبت به علت نقض موعد سخت سفارش ب قابل انتخاب نیست. تأیید آزمون بیرونی وابسته به شاهد ظرفیت و کیفیت است.</p>' +
    '<div class="actions">' + button('تصویب آموزشی آزمون بیرونی', 'approve', !state.decision && result.feasible) +
    button('ثبت شروع آموزشی', 'start', approvalIsCurrent() && !state.started) +
    button('ثبت تحویل مشاهده‌شده در روز ۱۴', 'observe', state.started && !state.observed) +
    button('ثبت درس L-01', 'lesson', state.observed && !state.lesson) + '</div>' +
    (state.decision ? '<p>مصوبه حفظ‌شده: آزمون بیرونی · پیش‌بینی تحویل الف روز ۱۳.</p>' : '') +
    (state.decision && !approvalIsCurrent() ? '<p>فرض‌های جاری تغییر کرده‌اند. آغاز اجرا نیازمند بازبینی مصوبه است. برای تکرار دمو سناریو را بازنشانی کنید.</p>' : '') +
    (state.observed ? '<p>نتیجه آموزشی: روز ۱۴ · یک روز عقب‌تر از مصوبه و موعد سخت. نتیجه مالی تأیید نشده است.</p>' : '') +
    (state.lesson ? '<p>درس L-01 · زمان پذیرش و بازگشت محصول پس از آزمون بیرونی، جداگانه برآورد شود.</p>' : ''));
}
const views = { owner, expert, assessor, executive };
function render() {
  document.querySelectorAll('[data-role]').forEach(node =>
    node.setAttribute('aria-current', String(node.dataset.role === state.role)));
  screen.innerHTML = views[state.role]();
}
document.querySelector('#roles').addEventListener('click', event => {
  const role = event.target.closest('[data-role]')?.dataset.role;
  if (role && Object.hasOwn(views, role)) {
    state.role = role;
    notice.textContent = '';
    render();
  }
});
screen.addEventListener('change', event => {
  const evidence = event.target.dataset.evidence;
  if (state.role !== 'assessor' || !['external', 'payment'].includes(evidence)) return;
  state[evidence] = event.target.checked;
  state.reviewed = null;
  notice.textContent = 'برآوردها به‌روز شدند. ارزیابی این نسخه را دوباره ثبت کنید.';
  render();
  screen.querySelector('[data-evidence="' + evidence + '"]')?.focus();
});
const workspaceActions = {
  owner: ['orderA', 'orderB', 'openIssue'],
  expert: ['recordIssue', 'showCommitment'],
  assessor: ['review'],
  executive: ['approve', 'start', 'observe', 'lesson']
};
screen.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!workspaceActions[state.role].includes(action)) return;
  switch (action) {
    case 'showCommitment': state.order = 'A'; state.role = 'owner'; break;
    case 'orderA': state.order = 'A'; break;
    case 'orderB': state.order = 'B'; break;
    case 'openIssue': state.role = 'expert'; break;
    case 'recordIssue': state.issue = true; state.role = 'assessor'; break;
    case 'review': if (state.issue) { state.reviewed = flags(); state.role = 'executive'; } break;
    case 'approve':
      if (!state.decision && state.reviewed && evaluate('external', flags()).feasible)
        state.decision = { id: 'external', ...flags() };
      break;
    case 'start': if (approvalIsCurrent()) state.started = true; break;
    case 'observe': if (state.started) state.observed = true; break;
    case 'lesson': if (state.observed) state.lesson = true; break;
    default: return;
  }
  notice.textContent = state.issue ? 'پرونده آموزشی مشترک C-01' : '';
  render();
});
document.querySelector('#reset').addEventListener('click', () => {
  state = initial();
  notice.textContent = 'سناریوی آموزشی بازنشانی شد.';
  render();
});
render();
