'use strict';

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const state = {
  lang: preference('total-demo-language', 'fa', ['fa', 'en']),
  theme: preference('total-demo-theme', 'light', ['light', 'dark']),
  section: 'workspace', role: 'owner', scenario: 'S000013', offset: 0, filters: {}, overview: null,
  cases: null, detail: null, executive: null, executiveMeta: null, portfolioReservations: null,
  notice: '', errorCode: '', loading: false, unavailable: false, saving: false
};
const actors = {owner:'OWNER', expert:'EXPERT', assessor:'ASSESSOR', executive:'DECIDER'};
const roleNames = {owner:['مالک تعهد','Commitment owner'],expert:['کارشناس','Expert'],assessor:['مدیر ارزیاب','Assessment manager'],executive:['مدیر تصمیم‌گیر','Decision manager']};
const sectionNames = {workspace:['فضاهای کار و پرونده','Workspaces and case'],scenarios:['بانک سناریو','Scenario bank'],evidence:['رزرو و شواهد مالی','Reservations and financial evidence']};
const actionNames = {
  REPORT:['ثبت مشاهده','Report observation'],SCOPE:['تأیید دامنه اثر','Confirm scope'],ASSESS:['ثبت ارزیابی','Record assessment'],
  APPROVE:['تصویب آموزشی','Approve training case'],DECLINE:['رد گزینه','Decline option'],EXECUTE:['ثبت اجرای آموزشی','Record training execution'],
  OBSERVE:['ثبت نتیجه مشاهده‌شده','Record observed result'],CLOSE:['ثبت درس و بستن پرونده','Record lesson and close']
};
const labels = {
  id:['شناسه','ID'], anchor:['مرجع','Anchor'], stage:['مرحله','Stage'], resource:['منبع','Resource'], option:['گزینه','Option'],
  profile:['پروفایل','Profile'], variant:['حالت','Variant'], gate:['قید','Gate'], decision:['تصمیم','Decision'],
  execution:['اجرا','Execution'], outcome:['نتیجه','Outcome'], engineering:['مهندسی','Engineering'], procurement:['تأمین','Procurement'],
  material:['مواد','Material'], production:['ساخت','Production'], manufacturing:['ساخت','Manufacturing'], fat:['آزمون کارخانه','Factory acceptance test'],
  dispatch:['ارسال','Dispatch'], acceptance:['پذیرش','Acceptance'], collection:['وصول','Collection'],
  quality_fat:['کیفیت و آزمون کارخانه','Quality and FAT'], stock_release:['آزادسازی موجودی','Stock release'],
  donor_delivery:['تحویل سفارش اهداکننده','Donor order delivery'], drawing:['نقشه','Drawing'],
  supplier:['تأمین‌کننده','Supplier'], usable_stock:['موجودی قابل مصرف','Usable stock'], work_center:['مرکز کار','Work center'],
  test_cell:['ایستگاه آزمون','Test cell'], transport:['حمل','Transport'], customer_witness:['شاهد کارفرما','Customer witness'],
  payment_clearance:['آزادسازی پرداخت','Payment clearance'], alternate:['جایگزین','Alternate'],
  expedite:['تسریع','Expedite'], transfer:['انتقال','Transfer'],
  approved:['مصوب','Approved'], cancelled:['لغو شده','Cancelled'], failed:['ناموفق','Failed'],
  late_decision:['تصمیم دیرهنگام','Late decision'], no_action:['بدون اقدام','No action'], partial:['اجرای جزئی','Partial execution'],
  pending_observation:['در انتظار مشاهده','Pending observation'], ready:['آماده','Ready'],
  shared_conflict:['تعارض مشترک','Shared conflict'], stale:['منقضی از نظر نسخه','Stale version'],
  superseded:['جایگزین‌شده','Superseded'], unknown:['نامشخص','Unknown'],
  NOT_REQUIRED:['نیازی به تصمیم ندارد','Decision not required'], NO_ACTION:['بدون اقدام','No action'],
  NOT_APPROVED:['تصویب نشده','Not approved'], NOT_STARTED:['شروع نشده','Not started'],
  COMPLETED:['تکمیل‌شده','Completed'], FAILED:['ناموفق','Failed'], PARTIAL:['جزئی','Partial'], CANCELLED:['لغو‌شده','Cancelled'],
  SUPERSEDED:['جایگزین‌شده','Superseded'], IN_PROGRESS:['در حال انجام','In progress'],
  NOT_APPLICABLE:['نامرتبط','Not applicable'], PENDING:['در انتظار','Pending'],
  FROZEN:['نسخه ثابت','Frozen'], NO_ISSUE:['بدون چالش','No issue'], CAPTURED:['ثبت‌شده','Captured'],
  PROVISIONAL:['موقت','Provisional'], STALE:['کهنه','Stale'], EXPIRED:['منقضی','Expired'], READY:['آماده','Ready'],
  OWNER:['مالک تعهد','Commitment owner'], EXPERT:['کارشناس','Expert'], ASSESSOR:['ارزیاب','Assessor'],
  DECIDER:['تصمیم‌گیر','Decision manager'], EXECUTOR:['مجری','Executor'], REVIEWER:['بازبین','Reviewer'],
  BASELINE:['ثبت خط مبنا','Baseline'], DETECTION:['تشخیص رخداد','Detection'], DECIDE:['تصمیم','Decision'],
  LESSON:['درس‌آموخته','Lesson learned'], CEO_DECISION_REQUIRED:['نیازمند تصمیم مدیرعامل','CEO decision required'],
  DEPUTY_ASSIGNED:['ارجاع به جانشین مجاز','Assigned to authorized deputy'],
  IN_EXECUTION:['در حال اجرا','In execution'], RESULT_VERIFIED:['نتیجه تأییدشده','Result verified'],
  DIFFERENT_PERIOD:['دوره متفاوت','Different period'], DIFFERENT_CURRENCY:['ارز متفاوت','Different currency'],
  INTERNAL_TRANSFER:['گردش داخلی حذف‌شده','Internal transfer eliminated'],
  manufacturing_cost_effect:['اثر بهای ساخت','Manufacturing cost effect'], released_capacity:['ظرفیت آزادشده','Released capacity'],
  M_TOMAN:['میلیون تومان','Million toman'], HOUR:['ساعت','Hour'],
  DRAFT:['پیش‌نویس','Draft'], REPORTED:['ثبت‌شده','Reported'], SCOPED:['دامنه بررسی شده','Scoped'], ASSESSED:['ارزیابی‌شده','Assessed'],
  APPROVED:['مصوب','Approved'], DECLINED:['رد شده','Declined'], EXECUTED:['اجراشده','Executed'], OBSERVED:['مشاهده‌شده','Observed'],
  CLOSED:['بسته','Closed'], FEASIBLE:['امکان‌پذیر','Feasible'], BLOCKED_DONOR:['نقض موعد سفارش اهداکننده','Donor commitment breached'],
  BLOCKED_RESERVATION:['تعارض رزرو','Reservation conflict'], WAIT_EVIDENCE:['در انتظار شاهد','Evidence required'],
  VERIFIED:['تأییدشده','Verified'], PARTIALLY_VERIFIED:['تأیید جزئی','Partially verified'], RESERVED:['رزروشده','Reserved'],
  BLOCKED_CONFLICT:['مسدود با تعارض','Blocked by conflict'], APPROVAL_REQUIRED:['نیازمند مصوبه پیشین','Approval required'],
  BLOCKED:['مسدود','Blocked'], UNKNOWN:['نامشخص','Unknown'],
  UNVERIFIED:['تأییدنشده / باز','Unverified / open'], UNVERIFIED_OPEN:['نامشخص / باز (نیازمند شاهد نتیجه)','Unknown / open (observation required)'],
  LATE_REALIZED:['تأخیر محقق‌شده','Late realized'], MET_VERIFIED:['تعهد محقق و تأییدشده','Met and verified'],
  INTERNAL_SOURCE_REQUIRED:['نیازمند منبع داخلی','Internal source required'],
  DEMO_SIMULATED_ROLE:['نقش نمایشی آموزشی','Simulated demo role'],
  LIVE_SQLITE_TRANSACTION:['موتور زندهٔ تراکنشی SQLite','Live SQLite transaction engine'],
  READ_ONLY_PRECOMPUTED_SCENARIO_BANK:['شواهد فقط‌خواندنی از پیش محاسبه‌شدهٔ بانک','Read-only precomputed bank evidence']
};

function preference(key, fallback, choices) {
  try {
    const value = localStorage.getItem(key);
    return choices.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, value); } catch { /* preferences are optional */ }
}
function t(fa, en) { return state.lang === 'fa' ? fa : en; }
function label(value) { return Object.hasOwn(labels, value) ? t(...labels[value]) : value; }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function show(value) {
  if (value === null || value === undefined || value === '') return '<span class="unknown-val">' + t('نامشخص','Unknown') + '</span>';
  if (typeof value === 'number') return new Intl.NumberFormat(t('fa-IR','en-US'), {maximumFractionDigits:4}).format(value);
  if (typeof value === 'boolean') return value ? t('بله','Yes') : t('خیر','No');
  return esc(label(value));
}
function code(value) {
  if (value === null || value === undefined || value === '') return '<span class="unknown-val">' + t('نامشخص','Unknown') + '</span>';
  return '<bdi dir="ltr"><code>' + esc(value) + '</code></bdi>';
}
function badge(text, kind = '') {
  return '<span class="badge' + (kind ? ' ' + kind : '') + '">' + text + '</span>';
}
function button(text, attrs, primary = false) {
  return '<button type="button" ' + attrs + (primary ? ' class="primary"' : '') + '>' + text + '</button>';
}
function table(headers, rows) {
  if (!rows.length) return '<p class="empty-state">' + t('رکوردی در این نما موجود نیست (وضعیت خالی).','No records available in this view (empty state).') + '</p>';
  return '<div class="table-wrap" tabindex="0"><table><thead><tr>' + headers.map(value => '<th scope="col">' + value + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(value => '<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function card(title, body, attrs = '') { return '<section class="card"' + (attrs ? ' ' + attrs : '') + '><h2>' + title + '</h2>' + body + '</section>'; }
function metrics(values) {
  return '<div class="metrics">' + values.map(([name, value]) => '<div class="metric"><span>' + name +
    '</span><strong>' + value + '</strong></div>').join('') + '</div>';
}
async function api(path, options) {
  const response = await fetch('/api/total-demo/' + path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(String(response.status));
    err.status = response.status;
    err.code = payload.error || String(response.status);
    err.payload = payload;
    throw err;
  }
  return payload;
}
function orderedNav(items, key, selected) {
  return Object.entries(items).map(([value, name]) => button(t(...name), 'data-' + key + '="' + value + '" aria-pressed="' + (selected === value) + '"')).join('');
}
function setView() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = t('rtl','ltr');
  document.documentElement.dataset.theme = state.theme;
  document.title = t('پارس | دموی جامع حفاظت از ارزش','PARS | Value protection demo');
  $('#boundary').textContent = t('سناریوها و مقادیر · داده آموزشی (DEMO_SYNTHETIC) · وضعیت عملیاتی: نیازمند منبع داخلی',
    'Scenarios and figures · Training data (DEMO_SYNTHETIC) · Operational status: Internal source required');
  $('#page-title').textContent = t('حفاظت از ارزش و تعهدات','Value and commitment protection');
  $('#description').textContent = t('پرونده مشترک چهار فضای کار را در سه سطح به زنجیره تعهد، گزینه‌ها، رزرو تراکنشی و شواهد تصمیم پیوند می‌دهد. برای وضعیت عملیاتی، منبع داخلی تأییدشده لازم است.',
    'A shared case connects four workspaces across three levels to commitments, options, transactional reservations, and decision evidence. Operational status requires a verified internal source.');
  document.querySelectorAll('[data-language],[data-theme-choice]').forEach(node => node.setAttribute('aria-pressed',
    String(node.dataset.language === state.lang || node.dataset.themeChoice === state.theme)));
  $('#sections').innerHTML = orderedNav(sectionNames, 'section', state.section);
  $('#notice').textContent = state.notice;
  if (state.loading) {
    screen.innerHTML = '<p role="status">' + t('در حال دریافت اطلاعات از SQLite…','Loading information from SQLite…') + '</p>';
  } else if (state.unavailable) {
    screen.innerHTML = card(t('خطای دسترسی به API یا بانک داده','API or database unavailable'),
      '<p class="error-state">' + t('بانک سناریو یا خدمت پرونده پاسخ نداد. هیچ داده جایگزینی ساخته نشد. کد خطا: ',
        'The scenario bank or case service did not respond. No fallback data was generated. Error code: ') + code(state.errorCode || 'unavailable') + '</p>' +
      button(t('تلاش دوباره','Retry'), 'data-retry', true));
  } else {
    screen.innerHTML = {workspace, scenarios, evidence}[state.section]();
  }
}
function focusAfterRender(selector) { $(selector)?.focus({preventScroll:true}); }
function stageRow(item) {
  return [button(code(item.id), 'data-open-scenario="' + esc(item.id) + '"'), code(item.anchor), show(item.stage), show(item.option), show(item.gate), show(item.execution)];
}
function scenarios() {
  const result = state.cases;
  if (!result) return '';
  const entries = Object.entries(state.overview?.filters ?? {});
  const select = ([key, choices]) => '<label>' + show(key) + '<select name="' + esc(key) + '"><option value="">' +
    t('همه','All') + '</option>' + choices.map(item => {
      const value = typeof item === 'object' ? item.id : item;
      return '<option value="' + esc(value) + '"' + (String(value) === state.filters[key] ? ' selected' : '') + '>' + show(value) + '</option>';
    }).join('') + '</select></label>';
  const count = state.overview?.summary ?? {};
  return card(t('بانک سناریوها (فقط‌خواندنی · پوشش ماتریس آزمایشگاه)','Scenario bank (read-only · lab matrix coverage)'),
    '<p class="muted">' + t('۴۳٬۲۰۰ حالت بانک، پوشش ماتریس تعریف‌شدهٔ آزمایشگاه است و جایگزین آزمون مرورگر یا دادهٔ عملیاتی شرکت نیست.',
      'The 43,200 bank states represent the defined lab parameter matrix and do not replace browser QA or verified operational data.') + '</p>' +
    metrics([[t('سناریو','Scenarios'), show(count.scenarios)], [t('رخداد','Events'), show(count.events)], [t('اثر مرحله‌ای','Stage effects'), show(count.effects)], [t('وضعیت عملیاتی','Operational status'), show(state.overview?.operationalStatus)]]) +
    '<form id="filters"><div class="filters">' + entries.map(select).join('') + '</div><button class="primary" type="submit">' + t('اعمال فیلتر','Apply filters') + '</button></form>' +
    table(['id','anchor','stage','option','gate','execution'].map(show), result.items.map(stageRow)) +
    '<div class="actions pager"><span>' + t('تعداد نتایج: ','Matching records: ') + show(result.total) + '</span>' +
      button(t('قبلی','Previous'), 'data-pagination="prev"' + (state.offset <= 0 ? ' disabled' : '')) +
      button(t('بعدی','Next'), 'data-pagination="next"' + (state.offset + result.limit >= result.total ? ' disabled' : '')) + '</div>');
}
function timeline(items) {
  return table([t('ترتیب','Sequence'), t('عامل','Actor'), t('اقدام','Action'), t('وضعیت','Status'), t('دلیل یا شاهد','Reason or evidence')], items.map(item => [
    show(item.revision ?? item.sequence), show(item.actor), actionNames[item.action] ? t(...actionNames[item.action]) : show(item.action), show(item.status), show(item.reason)
  ]));
}
function effectRowsByNode(list) {
  const map = new Map();
  for (const row of list || []) map.set(row.node, row);
  return map;
}
function effectTable(items, record, { includeTraceLinks = false } = {}) {
  const approvedMap = effectRowsByNode(record?.approvedSnapshot?.effects);
  const latestObservation = (record?.observations || []).at(-1) || null;
  const observedMap = effectRowsByNode(latestObservation?.effects);
  const directItems = items.filter(item => item.node !== 'donor_delivery');
  const sideItems = items.filter(item => item.node === 'donor_delivery');

  const renderGroup = (rows, impactKind) => {
    const headers = [
      t('مرحله تعهد','Commitment stage'),
      t('خط مبنا','Baseline'),
      t('بدون اقدام','Without action'),
      t('گزینه پیشنهادی','Proposed option'),
      t('پیش‌بینی مصوب (نسخه‌دار)','Approved forecast (versioned)'),
      t('پیش‌بینی جاری','Current forecast'),
      t('مشاهده ثبت‌شده','Recorded observation'),
      t('شاهد بانک (از پیش محاسبه‌شده)','Bank reference observed')
    ];
    if (includeTraceLinks) headers.push(t('مسیر پیگیری','Trace link'));
    return table(headers, rows.map(item => {
      // Strictly use explicit versioned approval snapshot; NEVER fall back to proposed!
      const approvedRow = approvedMap.get(item.node);
      const approvedValue = approvedRow ? approvedRow.approved_forecast : null;
      const recordedObsRow = observedMap.get(item.node);
      const recordedObsValue = recordedObsRow ? recordedObsRow.observed : null;
      const cols = [
        show(item.node) + ' ' + badge(impactKind === 'direct' ? t('اثر مستقیم چالش','Direct issue impact') : t('اثر جانبی گزینه','Option side-effect'), impactKind === 'direct' ? '' : 'warn'),
        show(item.baseline),
        show(item.without_action),
        show(item.proposed),
        approvedRow ? show(approvedValue) + ' ' + code('v' + record.approvedSnapshot.decisionRevision) : show(null),
        show(item.current_forecast),
        recordedObsRow ? show(recordedObsValue) + ' ' + code('v' + latestObservation.revision) : show(null),
        show(item.observed)
      ];
      if (includeTraceLinks) {
        cols.push(
          '<div class="inline-actions">' +
          button(t('چالش','Issue'), 'data-role="expert"') +
          button(t('راهکار','Option'), 'data-role="assessor"') +
          '</div>'
        );
      }
      return cols;
    }));
  };

  return (
    '<div class="effect-section" data-effect-group="direct"><h3>' +
      t('۱. اثر مستقیم چالش بر زنجیره تعهدات پرونده','1. Direct issue impact on case commitment chain') +
    '</h3>' + renderGroup(directItems, 'direct') + '</div>' +
    '<div class="effect-section" data-effect-group="donor"><h3>' +
      t('۲. اثر جانبی گزینه بر سفارش اهداکننده (جدا از اثر مستقیم چالش)','2. Option side-effect on donor order (separate from direct issue impact)') +
    '</h3>' + renderGroup(sideItems, 'side') + '</div>'
  );
}
function lifecycleSeparationCard(detail, record) {
  const approved = record.approvedSnapshot;
  const latestObs = (record.observations || []).at(-1) || null;
  const resCount = (record.reservations || []).length;
  return card(t('تفکیک هفت مفهوم مستقل پرونده (مدل و رابط جداگانه)','Seven independent case concepts (separated in model and UI)'),
    metrics([
      [t('۱. گزینه قابل بررسی','1. Reviewable option'), show(detail.option) + ' · ' + show(detail.gate)],
      [t('۲. مصوبه نسخه‌دار','2. Versioned approval'), approved ? code('v' + approved.decisionRevision) + ' · ' + show(approved.actor) : show(null)],
      [t('۳. رزرو ظرفیت (جدا از مصوبه)','3. Capacity reservation (separate)'), show(resCount) + ' · ' + (resCount ? badge(t('رزروشده در SQLite','Reserved in SQLite'), 'good') : badge(t('مصوبه ظرفیت رزرو نمی‌کند','Approval does not reserve'), 'warn'))],
      [t('۴. اجرا (این اجرا / مرجع بانک)','4. Execution (this run / bank)'), (record.history.some(h => h.action === 'EXECUTE') ? show('EXECUTED') : show('NOT_STARTED')) + ' / ' + show(detail.execution)],
      [t('۵. مشاهده نتیجه (این اجرا / بانک)','5. Observation (this run / bank)'), (latestObs ? code('v' + latestObs.revision) + ' · ' + show(latestObs.outcome) : show(null)) + ' / ' + show(detail.outcome)],
      [t('۶. پیش‌بینی مصوب (تغییرناپذیر)','6. Approved forecast (immutable)'), approved ? badge(t('ثابت در نسخه ','Frozen at v') + approved.decisionRevision, 'good') : show(null)],
      [t('۷. ریسک باقیمانده','7. Remaining risk'), badge(show(record.remainingRiskStatus), record.remainingRiskStatus === 'MET_VERIFIED' ? 'good' : 'warn')]
    ]) +
    '<p class="muted">' + t('ثبت مشاهدهٔ جدید پیش‌بینی مصوب را بازنویسی نمی‌کند. در نبود شاهد نتیجه، ریسک باقیمانده «نامشخص / باز» باقی می‌ماند.',
      'Recording a new observation never overwrites the approved forecast snapshot. Without observation evidence, remaining risk remains unknown/open.') + '</p>',
    'data-lifecycle-panel'
  );
}
function caseActions(record) {
  const choices = (record.allowedActions ?? []).filter(item => item.actor === actors[state.role]);
  if (!choices.length) {
    return '<p class="empty-state">' + t('اقدام مجاز برای این نقش نمایشی در وضعیت فعلی پرونده وجود ندارد. تغییر تب مجوز جدید ایجاد نمی‌کند.',
      'No permitted action exists for this simulated role in the current case state. Switching tabs does not grant new authority.') + '</p>';
  }
  const hasObserve = choices.some(item => item.action === 'OBSERVE');
  return '<form id="case-action" data-case-action><div class="form-row">' +
    '<label>' + t('دلیل اقدام (الزامی)','Action reason (required)') +
    ' <input name="reason" type="text" required maxlength="240"></label>' +
    (hasObserve ? '<label>' + t('تأییدکنندهٔ مستقل (اختیاری؛ هم‌نام با ثبت‌کننده رد می‌شود)','Independent verifier (optional; self-verification rejected)') +
      ' <input name="verifier" type="text" maxlength="120" placeholder="REVIEWER"></label>' : '') +
    '</div><div class="actions">' +
    choices.map(({action}) => '<button type="submit" class="primary" data-action="' + esc(action) + '">' + t(...actionNames[action]) + '</button>').join('') +
    '</div></form>';
}
function liveReservationPanel(detail, record) {
  const approved = record?.approvedSnapshot;
  const rows = (record?.reservations || []).map(row => [
    code(row.id), code(row.scenario_id), code('v' + row.decision_revision), show(row.resource),
    code(row.owner), code(row.order_id), show(row.start_min) + ' – ' + show(row.end_min), show(row.expires_at)
  ]);
  const attemptRows = (record?.reservationAttempts || []).map(row => [
    code(row.id), show(row.resource), show(row.start_min) + ' – ' + show(row.end_min), show(row.expires_at),
    badge(show(row.status), row.status === 'RESERVED' ? 'good' : 'warn'),
    row.conflicts?.length ? row.conflicts.map(c => code(c.order_id)).join(', ') : '—'
  ]);
  return card(t('رزرو تراکنشی ظرفیت منبع برای این پرونده (موتور زندهٔ SQLite)','Transactional capacity reservation for this case (live SQLite engine)'),
    '<p>' + badge(show('LIVE_SQLITE_TRANSACTION'), 'good') + ' ' +
      t('بررسی هم‌پوشانی، مجاورت و انقضا در یک تراکنش روی کل سبد فضای کاری انجام می‌شود. تصویب گزینه به‌تنهایی ظرفیت رزرو نمی‌کند.',
        'Overlap, adjacency, and expiry are checked atomically in one transaction across the entire workspace portfolio. Approving an option does not reserve capacity.') + '</p>' +
    '<form id="case-reservation" data-case-reservation class="reservation-form">' +
      '<div class="filters">' +
        '<label>' + t('منبع (از بانک سناریو)','Resource (from bank)') + '<input type="text" value="' + esc(label(detail.resource)) + '" readonly></label>' +
        '<label>' + t('نسخه مصوبه متصل','Linked approval revision') + '<input type="text" value="' + esc(approved ? 'v' + approved.decisionRevision : t('نیازمند مصوبه','Approval required')) + '" readonly></label>' +
        '<label>' + t('مالک رزرو','Reservation owner') + '<input name="owner" type="text" required maxlength="100" value="OWNER"></label>' +
        '<label>' + t('شروع بازه (دقیقه)','Start minute') + '<input name="start_min" type="number" required value="600"></label>' +
        '<label>' + t('پایان بازه نیمه‌باز (دقیقه)','End minute (half-open)') + '<input name="end_min" type="number" required value="780"></label>' +
        '<label>' + t('انقضا (دقیقه)','Expires at minute') + '<input name="expires_at" type="number" required value="1200"></label>' +
        '<label>' + t('زمان فعلی آزمون (now)','Evaluation minute (now)') + '<input name="now" type="number" required value="0"></label>' +
      '</div>' +
      '<button type="submit" class="primary" data-reserve-submit>' + t('درخواست رزرو تراکنشی','Request transactional reservation') + '</button>' +
    '</form>' +
    '<h3>' + t('رزروهای ثبت‌شده این پرونده','Recorded reservations for this case') + '</h3>' +
    table([t('شناسه رزرو','Reservation ID'), t('پرونده','Case'), t('نسخه مصوبه','Decision rev'), t('منبع','Resource'), t('مالک','Owner'), t('سفارش متأثر','Affected order'), t('بازه [شروع، پایان)','Interval [start, end)'), t('انقضا','Expires')], rows) +
    '<h3>' + t('سابقه تلاش‌ها و تعارض‌های رزرو','Reservation attempts and conflicts') + '</h3>' +
    table([t('تلاش','Attempt'), t('منبع','Resource'), t('بازه درخواستی','Requested slot'), t('انقضا','Expires'), t('نتیجه','Result'), t('سفارش متعارض','Conflicting order')], attemptRows),
    'data-live-reservation-panel'
  );
}
function executiveFivePathways(data) {
  if (!data) return '<p class="muted">' + t('شواهد پنج مسیر مدیرعامل بارگذاری نشده است.','Executive 5-pathway evidence is not loaded.') + '</p>';
  const gov = data.governance ?? {};
  const finance = data.finance ?? {};
  const conflict = data.order_conflict;
  const yday = gov.yesterday_directive;
  const promisesHtml = data.promises ? Object.entries(data.promises).map(([period, rows]) =>
    '<h4>' + t('افق ','Horizon ') + code(period) + '</h4>' +
    table([t('تعهد','Commitment'), t('سفارش','Order'), t('شرح','Deliverable'), t('موعد دقیقه','Due min'), t('آمادگی','Readiness'), t('شواهد پیش‌نیاز','Control evidence')],
      rows.map(row => [code(row.id), code(row.order), esc(row.title), show(row.due_minute), badge(show(row.readiness), row.readiness === 'READY' ? 'good' : 'warn'),
        (row.controls ?? []).map(c => esc(c.requirement) + ': ' + show(c.status) + ' (' + code(c.evidence) + ')').join(' · ') || '—']))
  ).join('') : '';

  const ceoQueueHtml = table(
    [t('پرونده صف مدیرعامل','CEO queue case'), t('تعهد','Commitment'), t('موضوع','Issue'), t('مسئول','Owner'), t('مبلغ','Amount'), t('مهلت پذیرش','Accept by'), t('وضعیت معتبر','Latest status')],
    (gov.ceo_queue ?? []).map(row => [
      code(row.id), code(row.promise), esc(row.issue), code(row.owner), show(row.amount),
      show(row.current_assignment?.accept_by), show(row.latest_valid_status?.status)
    ])
  );
  const watchRows = (gov.high_risk_watch ?? []).map(id => gov.cards?.[id]).filter(Boolean).map(row => [
    code(row.id), code(row.promise), esc(row.issue), code(row.current_assignment?.actor),
    show(row.latest_valid_status?.status), show(row.remaining_risk_status)
  ]);
  const watchHtml = '<h4>' + t('نمای پایش پرریسک (خارج از صف تصمیم مدیرعامل؛ اختیار واحد و جانشین)','High-risk watchlist (outside CEO decision queue; unit/deputy authority)') + '</h4>' +
    table([t('پرونده','Case'), t('تعهد','Commitment'), t('موضوع','Issue'), t('تخصیص جاری (شامل جانشین)','Current assignee (incl. deputy)'), t('آخرین وضعیت','Latest status'), t('ریسک باقیمانده','Remaining risk')], watchRows);

  const conflictHtml = conflict ? table(
    [t('درخواست','Request'), t('منبع','Resource'), t('بازه دقیقه','Minute slot'), t('وضعیت','Status'), t('سفارش متعارض','Conflicting order')],
    [
      [t('رزرو موجود (حفاظت‌شده)','Existing (protected)'), code(conflict.resource), conflict.reserved_slot.map(show).join(' – '), badge(show(conflict.existing?.status), 'good'), '—'],
      [t('درخواست هم‌پوشان','Overlapping request'), code(conflict.resource), conflict.incoming_requested_slot.map(show).join(' – '), badge(show(conflict.requested?.status), 'warn'), (conflict.requested?.conflicting_orders ?? []).map(code).join(', ')],
      [t('بازه مجاور جایگزین','Adjacent alternative'), code(conflict.resource), conflict.alternative_slot.map(show).join(' – '), badge(show(conflict.alternative?.status), 'good'), '—']
    ]
  ) : '';

  const fundingHtml = table(
    [t('گزینه','Option'), t('مهلت','Deadline'), t('نیاز نقد','Required'), t('موجود تا مهلت','Available by deadline'), t('کسری تا مهلت','Gap by deadline'), t('امکان مالی تا مهلت','Feasible by deadline'), t('شواهد تأمین','Funding evidence')],
    (finance.funding ?? []).map(row => [
      code(row.option), code(row.deadline), show(row.required), show(row.available_by_deadline), show(row.gap),
      badge(show(row.feasible), row.feasible ? 'good' : 'warn'),
      (row.funding_evidence ?? []).map(f => code(f.reference) + ' (' + show(f.amount) + ')').join(' · ')
    ])
  );

  const changesHtml = table(
    [t('ترتیب','Seq'), t('پرونده','Case'), t('زمان (دقیقه)','At min'), t('عامل','Actor'), t('وضعیت','Status'), t('جزئیات','Detail')],
    (gov.changes_since_visit ?? []).map(row => [show(row.sequence), code(row.case_id), show(row.occurred_at), show(row.actor), show(row.status), esc(row.detail)])
  );
  const ydayHtml = yday ? metrics([
    [t('پرونده دستور دیروز','Yesterday directive case'), code(yday.id) + ' / ' + code(yday.approved_snapshot?.id)],
    [t('پیش‌بینی مصوب (تغییرناپذیر)','Approved forecast (immutable)'), show(yday.approved_snapshot?.approved_forecast)],
    [t('مشاهده واقعی','Observed actual'), show(yday.observed_result?.actual) + ' · ' + code(yday.observed_result?.evidence)],
    [t('خطای پیش‌بینی (دقیقه)','Forecast error (min)'), show(yday.forecast_error_minutes)],
    [t('ریسک باقیمانده (دقیقه / وضعیت)','Residual risk (min / status)'), show(yday.residual_minutes) + ' · ' + show(yday.remaining_risk_status)]
  ]) : '';

  return card(t('پنج مسیر مدیریتی مدیرعامل (شواهد فقط‌خواندنی بانک آموزشی · DEMO_SYNTHETIC)','CEO five traceable pathways (read-only training bank evidence · DEMO_SYNTHETIC)'),
    '<p class="muted">' + badge(show('READ_ONLY_PRECOMPUTED_SCENARIO_BANK')) + ' ' + badge(show('INTERNAL_SOURCE_REQUIRED'), 'warn') + '</p>' +
    '<h3>' + t('۱. تعهدهای افق ۲۴ و ۷۲ ساعت','1. 24h and 72h commitments') + '</h3>' + promisesHtml +
    '<h3>' + t('۲. تصمیم مختص مدیرعامل در برابر صف پایش پرریسک','2. CEO-only decision queue vs high-risk watchlist') + '</h3>' + ceoQueueHtml + watchHtml +
    '<h3>' + t('۳. اثر تصمیم بر قول‌های دیگر (تعارض سفارش‌ها)','3. Decision impact on other promises (order conflict)') + '</h3>' + conflictHtml +
    '<h3>' + t('۴. امکان مالی تا مهلت','4. Financial feasibility by deadline') + '</h3>' + fundingHtml +
    '<h3>' + t('۵. تغییرات پس از مراجعه قبلی و پیگیری دستور روز قبل','5. Changes since previous visit and yesterday directive') + '</h3>' +
      '<p class="muted">' + t('زمان مراجعه قبلی (دقیقه): ','Previous visit (min): ') + show(gov.previous_visit) + '</p>' +
      ydayHtml + changesHtml,
    'data-ceo-pathways'
  );
}
function workspace() {
  const detail = state.detail;
  const record = state.cases;
  if (!detail || !record) return '';
  const levels = {
    owner: t('سطح مدیریت · مالک تعهد','Management level · Commitment owner'),
    expert: t('سطح کارشناس · ثبت رخداد و منبع','Specialist level · Incident and resource'),
    assessor: t('سطح مدیریت · ارزیاب حوزه و گزینه','Management level · Domain assessor'),
    executive: t('سطح مدیر ارشد · تصمیم‌گیر و پیگیری','Executive level · Decision maker')
  };
  const referenceLabel = '<p class="muted">' + badge(show('READ_ONLY_PRECOMPUTED_SCENARIO_BANK')) + ' ' +
    t('مقادیر خط مبنا، بدون اقدام، پیشنهادی و شاهد بانک از سناریوی از پیش محاسبه‌شده خوانده شده‌اند. پیش‌بینی مصوب فقط از رکورد صریح و نسخه‌دار مصوبه در همین فضا پر می‌شود.',
      'Baseline, without-action, proposed, and bank observation values come from the precomputed scenario bank. Approved forecast is populated solely from this workspace’s explicit versioned approval snapshot.') + '</p>';

  const affectedCommitments = (detail.effect ?? []).map(item => [
    show(item.node),
    item.node === 'donor_delivery' ? badge(t('اثر جانبی گزینه بر سفارش اهداکننده','Option side-effect on donor order'), 'warn') : badge(t('اثر مستقیم چالش','Direct issue impact')),
    show(item.baseline),
    show(item.without_action),
    show(item.proposed),
    '<div class="inline-actions">' +
      button(t('نمای تعهد','Commitment view'), 'data-role="owner"') +
      button(t('ارزیابی گزینه','Option view'), 'data-role="assessor"') +
    '</div>'
  ]);

  let context = '';
  if (state.role === 'owner') {
    context = card(t('مسیر تعهد ← چالش و راهکار · روز آموزشی','Path: Commitment → Issue & Option · Training days'),
      referenceLabel + effectTable(detail.effect ?? [], record, { includeTraceLinks: true }) +
      '<div class="actions">' +
        button(t('مشاهده چالش و شاهد (همین پرونده)','Open issue and evidence (same case)'), 'data-role="expert"') +
        button(t('بررسی گزینه پرونده (همین پرونده)','Review case option (same case)'), 'data-role="assessor"') +
      '</div>',
      'data-owner-commitments'
    );
  }
  if (state.role === 'expert') {
    context = card(t('مسیر چالش ← تعهدهای متأثر و شواهد رخداد','Path: Issue → Affected commitments & incident evidence'),
      metrics([
        [t('شناسه پرونده مشترک','Shared case ID'), code(record.scenarioId)],
        [t('منبع رخداد','Incident resource'), show(detail.resource)],
        [t('مرحله اثر','Affected stage'), show(detail.stage)],
        [t('مرجع سناریو','Scenario anchor'), code(detail.anchor) + ' (' + show(detail.anchor_details?.provenance) + ')']
      ]) +
      '<h3>' + t('تعهدهای متأثر از این چالش و اثر جانبی گزینه (از بانک SQLite)','Commitments affected by this issue & option side-effect (from SQLite)') + '</h3>' +
      table([t('تعهد / گره','Commitment / node'), t('نوع ارتباط','Link type'), t('مبنا','Baseline'), t('بدون اقدام','Without action'), t('گزینه پیشنهادی','Proposed'), t('پیگیری با همین شناسه','Follow with same ID')], affectedCommitments) +
      '<h3>' + t('رویدادهای ثبت و بررسی در بانک مرجع','Detection & review events in reference bank') + '</h3>' +
      timeline((detail.event ?? []).filter(item => ['EXPERT','REVIEWER'].includes(item.actor))) +
      '<div class="actions">' +
        button(t('بازگشت به تعهدها (همین پرونده)','Open commitments (same case)'), 'data-role="owner"') +
        button(t('ارسال به ارزیاب حوزه','Open domain assessor'), 'data-role="assessor"') +
      '</div>',
      'data-expert-issue'
    );
  }
  if (state.role === 'assessor') {
    context = card(t('ارزیابی گزینه، قیدها و مقایسه اثر','Option assessment, hard gates, and impact comparison'),
      metrics([[t('گزینه','Option'), show(detail.option)], [t('قید (مرجع بانک)','Gate (bank reference)'), show(detail.gate)], [t('پروفایل','Profile'), show(detail.profile)], [t('منبع','Resource'), show(detail.resource)]]) +
      referenceLabel + effectTable(detail.effect ?? [], record, { includeTraceLinks: true }) +
      '<div class="actions">' +
        button(t('بازگشت به تعهدها','Open commitments'), 'data-role="owner"') +
        button(t('نمای تصمیم‌گیر','Open decision maker'), 'data-role="executive"') +
      '</div>',
      'data-assessor-panel'
    );
  }
  if (state.role === 'executive') {
    context = card(t('تصمیم، اجرا و مشاهده برای پرونده مشترک','Decision, execution, and observation for shared case'),
      metrics([
        [t('تصمیم مرجع سناریو (از پیش محاسبه‌شده)','Precomputed bank decision'), show(detail.decision)],
        [t('اجرای مرجع سناریو (از پیش محاسبه‌شده)','Precomputed bank execution'), show(detail.execution)],
        [t('نتیجه مرجع سناریو (از پیش محاسبه‌شده)','Precomputed bank outcome'), show(detail.outcome)],
        [t('ریسک باقیمانده این اجرا','Remaining risk (this run)'), show(record.remainingRiskStatus)]
      ]) +
      referenceLabel + effectTable(detail.effect ?? [], record) +
      '<div class="actions">' + button(t('نمای کامل رزرو و شواهد مالی','Full reservation and financial evidence'), 'data-section="evidence"') + '</div>'
    ) + executiveFivePathways(state.executive);
  }

  return '<nav class="navigation role-nav" aria-label="' + t('فضاهای کار','Workspaces') + '">' + orderedNav(roleNames, 'role', state.role) + '</nav>' +
    card(levels[state.role],
      '<p class="role-banner">' + badge(show(record.actorMode || 'DEMO_SIMULATED_ROLE'), 'warn') + ' ' +
      badge(t('هویت و اختیار سازمانی: نیازمند منبع داخلی','Enterprise auth/RBAC: Internal source required'), 'warn') + '</p>' +
      metrics([
        [t('پرونده مشترک','Shared case'), code(record.scenarioId)],
        [t('وضعیت این اجرای دمو','Demo run status'), show(record.status)],
        [t('نسخه پرونده','Case revision'), show(record.revision)],
        [t('مرجع سناریو','Scenario anchor'), code(detail.anchor)]
      ]) +
      caseActions(record) +
      '<p class="muted">' + t('نقش‌ها در این محیط آموزشی نمایشی‌اند و از نشست دمو می‌آیند؛ تغییر تب رابط مجوز سازمانی ایجاد نمی‌کند. امکان تصویب و مشاهده به gate/decision/outcome سناریوی از پیش محاسبه‌شدهٔ بانک مقید است.',
        'Roles are simulated in this training environment; switching UI tabs does not grant enterprise permissions. Approve/observe transitions are gated by the precomputed bank scenario’s gate/decision/outcome.') + '</p>') +
    lifecycleSeparationCard(detail, record) +
    context +
    liveReservationPanel(detail, record) +
    card(t('گردش پرونده در این اجرا (ذخیره‌شده در SQLite فضای کاری)','Case history for this run (persisted in workspace SQLite)'), timeline(record.history ?? [])) +
    card(t('گردش از پیش محاسبه‌شده در بانک آموزشی (فقط‌خواندنی)','Precomputed training-bank history (read-only)'), timeline(detail.event ?? []));
}
function evidence() {
  const data = state.executive;
  if (!data) return '';
  const finance = data.finance ?? {};
  const conflict = data.order_conflict;
  const portfolio = state.portfolioReservations;

  const livePortfolio = card(t('۱. موتور زندهٔ تراکنشی رزرو در فضای کاری (SQLite)','1. Live transactional portfolio reservation engine (SQLite)'),
    '<p>' + badge(show('LIVE_SQLITE_TRANSACTION'), 'good') + ' ' +
      t('این جدول مستقیماً از تراکنش‌های زندهٔ SQLite فضای کاری شما (روی کل سبد پرونده‌ها) خوانده می‌شود و در پاسخ به اقدام پرونده تغییر می‌کند.',
        'This table is read live from your writable workspace SQLite transactions across the entire portfolio and responds to case reservation actions.') + '</p>' +
    table(
      [t('شناسه رزرو','Reservation ID'), t('پرونده','Case'), t('نسخه مصوبه','Decision rev'), t('منبع','Resource'), t('مالک','Owner'), t('سفارش','Order'), t('بازه [شروع، پایان)','Slot [start, end)'), t('انقضا','Expires'), t('فعال در now=0','Active at now=0')],
      (portfolio?.reservations ?? []).map(r => [code(r.id), code(r.scenario_id), code('v' + r.decision_revision), show(r.resource), code(r.owner), code(r.order_id), show(r.start_min) + ' – ' + show(r.end_min), show(r.expires_at), show(r.active)])
    ),
    'data-live-portfolio-table'
  );

  const bankNotice = '<p class="muted">' + badge(show(state.executiveMeta?.sourceMode || 'READ_ONLY_PRECOMPUTED_SCENARIO_BANK')) + ' ' +
    badge(show(state.executiveMeta?.operationalStatus || 'INTERNAL_SOURCE_REQUIRED'), 'warn') + ' ' +
    t('بخش‌های زیر شواهد فقط‌خواندنی و از پیش محاسبه‌شدهٔ آزمایشگاه (scenario-lab) هستند. برای اعداد عملیاتی شرکت، سند واقعی SAP FI/CO، ظرفیت تأییدشده و تأیید مالی داخلی الزامی است.',
      'The sections below are read-only precomputed lab evidence (scenario-lab). Operational company figures require verified internal SAP FI/CO documents, capacity calendars, and financial sign-off.') + '</p>';

  const reservation = conflict ? card(t('۲. شاهد آزمایشگاهی مصوبه و رزرو ظرفیت (فقط‌خواندنی)','2. Precomputed lab evidence: approval vs reservation (read-only)'),
    bankNotice +
    '<p>' + t('مصوبه و رزرو دو وضعیت مستقل‌اند. رزرو هم‌پوشان مسدود و رزرو مجاور پذیرفته می‌شود.','Approval and reservation are independent states. Overlapping reservations are blocked while adjacent slots are accepted.') + '</p>' +
    metrics([[t('منبع','Resource'), code(conflict.resource)], [t('سفارش حفاظت‌شده','Protected order'), code(conflict.protected_order)], [t('مصوبه ≠ رزرو','Approval ≠ reservation'), show(conflict.approved_does_not_mean_reserved)]]) +
    table([t('درخواست','Request'), t('بازهٔ دقیقه','Minute interval'), t('وضعیت','Status'), t('سفارش متعارض','Conflicting order')], [
      [t('رزرو موجود','Existing reservation'), conflict.reserved_slot, conflict.existing],
      [t('درخواست هم‌پوشان','Overlapping request'), conflict.incoming_requested_slot, conflict.requested],
      [t('بازه مجاور جایگزین','Adjacent alternative'), conflict.alternative_slot, conflict.alternative]
    ].map(([name, interval, item]) => [name, interval ? interval.map(show).join(' – ') : show(null), show(item?.status),
      item?.conflicting_orders?.length ? item.conflicting_orders.map(code).join(', ') : '—']))) : '';

  const funding = card(t('۳. آمادگی نقد قبل از مهلت · میلیون تومان (فقط‌خواندنی)','3. Funding readiness before deadline · M_TOMAN (read-only)'),
    table([t('گزینه','Option'), t('پروژه','Project'), t('مهلت','Deadline'), t('نیاز','Required'), t('موجود تا مهلت','Available by deadline'), t('جمع نهایی','Eventual'), t('کسری','Gap'), t('امکان اجرا','Feasible'), t('شواهد تأمین','Funding refs')],
      (finance.funding ?? []).map(row => [code(row.option), code(row.project), code(row.deadline), show(row.required), show(row.available_by_deadline), show(row.eventual), show(row.gap), badge(show(row.feasible), row.feasible ? 'good' : 'warn'),
        (row.funding_evidence ?? []).map(f => code(f.reference) + ': ' + show(f.amount)).join(' · ')])));

  const cost = finance.cost ? card(t('۴. کنترل هزینه و پیشرفت (EV/AC/CPI جدا از اثر مداخله · فقط‌خواندنی)','4. Cost & progress control (PV/EV/AC/CPI/CV separate from intervention value · read-only)'),
    '<p class="muted">' + t('تأیید مالی عملیاتی و سند واقعی FI/CO: ','Operational financial sign-off & live FI/CO postings: ') + badge(show('INTERNAL_SOURCE_REQUIRED'), 'warn') + '</p>' +
    metrics([['PV', show(finance.cost.pv)], ['EV', show(finance.cost.ev)], ['AC', show(finance.cost.ac)], ['CPI (EV/AC)', show(finance.cost.cpi)], ['CV (EV-AC)', show(finance.cost.cv)]]) +
    '<p class="muted">' + t('طرح، WBS، اردر، دوره، نسخه خط مبنا و واحد: ','Plan, WBS, Order, period, baseline and currency: ') +
      [finance.cost.id, finance.cost.wbs, finance.cost.order, finance.cost.period, finance.cost.baseline, finance.cost.currency].map(code).join(' · ') + '</p>' +
    table([t('سند','Document'), t('ردیف','Line'), t('دوره','Period'), t('واحد','Currency'), t('مبلغ','Amount'), t('سند متناظر (حذف گردش داخلی)','Matched doc (internal elim.)'), t('شامل در AC','Included'), t('علت حذف','Exclusion reason')],
      (finance.cost.postings ?? []).map(row => [code(row.document), show(row.line), code(row.period), code(row.currency), show(row.amount), code(row.matched_document), show(row.included), show(row.reason)])),
    'data-cost-traceability'
  ) : '';

  const cashStage = (finance.cash?.stages ?? [])[0] || null;
  const indep = finance.cash?.independent_metrics ?? [];
  const mfgMetric = indep.find(m => m.metric === 'manufacturing_cost_effect');
  const capMetric = indep.find(m => m.metric === 'released_capacity');
  const dagRows = Object.entries(finance.cash?.nodes ?? {}).map(([node, pair]) => [
    code(node), show(pair?.[0]), show(pair?.[1]), show(pair ? pair[1] - pair[0] : null)
  ]);

  const cash = card(t('۵. شبکه وابستگی وصول (جلوگیری از دوباره‌شماری) و چهار خروجی مستقل ارزش اقتصادی','5. Collection dependency DAG (single counting) & four independent economic outputs'),
    '<p class="muted">' + t('دو علت موازی پنج‌روزه (PART-A و PART-B) هر دو به FAT متصل‌اند و در شبکه وابستگی یک تأخیر مشترک ۵ روزه (و نه ۱۰ روز) روی مرحله وصول SYN-PAY-01 ایجاد می‌کنند. هر رخداد مالی در هر سناریو فقط یک بار شمرده می‌شود.',
      'Two parallel 5-day causes (PART-A and PART-B) both feed FAT, yielding a single 5-day shared delay (not 10 days) on collection stage SYN-PAY-01. Each cash event is counted once per scenario.') + '</p>' +
    '<h3>' + t('گره‌ها و یال‌های شبکه وابستگی','Dependency network nodes and edges') + '</h3>' +
    '<p class="muted">' + t('یال‌ها: ','Edges: ') + (finance.cash?.edges ?? []).map(([a, b]) => code(a + ' → ' + b)).join(' · ') + '</p>' +
    table([t('گره شبکه','Network node'), t('پایان مبنا (روز)','Baseline finish (d)'), t('پایان با ریسک (روز)','Risk finish (d)'), t('تأخیر خالص (روز)','Net delay (d)')], dagRows) +
    '<h3>' + t('رخداد وصول (شمارش یکتا)','Collection event (counted once)') + '</h3>' +
    table([t('مرحله','Stage'), t('گره','Node'), t('مبنا','Baseline'), t('پیش‌بینی','Forecast'), t('روز تأخیر','Delay days'), t('اصل طلب (جدا)','Principal (separate)'), t('وصول مشاهده‌شده','Observed receipt'), t('اثر زمانی وصول','Timing impact')],
      (finance.cash?.stages ?? []).map(row => [code(row.stage), code(row.node), code(row.date_baseline), code(row.date_forecast), show(row.delay_days),
        show(row.principal), show(row.observed_receipt), show(row.timing_cost_m_toman)])) +
    '<h3>' + t('چهار خروجی مستقل ارزش اقتصادی (واحدهای جداگانه — جمع نمی‌شوند)','Four independent economic outputs (distinct units — never summed)') + '</h3>' +
    table([t('خروجی مستقل','Independent output'), t('مقدار','Value'), t('واحد','Unit'), t('مرجع شاهد / توضیح','Evidence / note')], [
      [t('۱. اثر بهای ساخت','1. Manufacturing cost effect'), show(mfgMetric?.value), show(mfgMetric?.unit || 'M_TOMAN'), code(mfgMetric?.evidence)],
      [t('۲. منفعت/هزینه زمان وصول','2. Collection timing impact'), show(cashStage?.timing_cost_m_toman), show('M_TOMAN'), cashStage ? code(cashStage.stage) + ' · ' + t('اصل طلب اضافه نمی‌شود','Principal not added') : show(null)],
      [t('۳. مبلغ وصول مشاهده‌شده','3. Observed collected cash'), show(cashStage?.observed_receipt), show('M_TOMAN'), cashStage ? code(cashStage.stage) : show(null)],
      [t('۴. ظرفیت آزادشده','4. Released capacity'), show(capMetric?.value), show(capMetric?.unit || 'HOUR'), code(capMetric?.evidence) + ' · ' + t('بدون شاهد مصرف اقتصادی به پول تبدیل نمی‌شود','Not monetized without consumption evidence')]
    ]),
    'data-economic-outputs'
  );

  return livePortfolio + reservation + executiveFivePathways(data) + funding + cost + cash;
}
let loadCounter = 0;
async function load() {
  const request = ++loadCounter;
  const {section, scenario, filters, offset} = state;
  state.loading = true;
  state.unavailable = false;
  state.errorCode = '';
  setView();
  try {
    if (section === 'workspace') {
      const id = encodeURIComponent(scenario);
      const [detail, record, execRes] = await Promise.all([
        api('scenarios/' + id),
        api('cases/' + id),
        api('executive').catch(() => null)
      ]);
      if (request === loadCounter) {
        Object.assign(state, { detail, cases: record });
        if (execRes) {
          state.executive = execRes.executive;
          state.executiveMeta = { sourceMode: execRes.sourceMode, operationalStatus: execRes.operationalStatus };
        }
      }
    } else if (section === 'scenarios') {
      const query = new URLSearchParams({...filters, offset: String(offset), limit: '20'});
      const [overview, result] = await Promise.all([api('summary'), api('scenarios?' + query)]);
      if (request === loadCounter) Object.assign(state, { overview, cases: result });
    } else {
      const [result, reservations] = await Promise.all([api('executive'), api('reservations')]);
      if (request === loadCounter) {
        state.executive = result.executive;
        state.executiveMeta = { sourceMode: result.sourceMode, operationalStatus: result.operationalStatus };
        state.portfolioReservations = reservations;
      }
    }
  } catch (err) {
    if (request === loadCounter) {
      state.unavailable = true;
      state.errorCode = err?.code || err?.message || 'unavailable';
    }
  } finally {
    if (request === loadCounter) {
      state.loading = false;
      setView();
    }
  }
}
function serverNotice(error) {
  const codeValue = error?.code || error?.message;
  if (codeValue === '409' || codeValue === 'revision_conflict') {
    return t('نسخه پرونده تغییر کرده است (تعارض نسخه). وضعیت جدید بارگذاری شد.','The case revision changed (revision conflict). Current state reloaded.');
  }
  if (codeValue === 'self_verification_forbidden') {
    return t('خودتأییدی مجاز نیست؛ تأییدکننده باید متمایز از ثبت‌کننده باشد.','Self-verification is forbidden; verifier must be distinct from the recorder.');
  }
  if (codeValue === 'approval_required') {
    return t('رزرو ظرفیت بدون مصوبهٔ صریح و نسخه‌دار ممکن نیست.','Capacity reservation requires an explicit versioned approval.');
  }
  if (codeValue === 'reservation_conflict') {
    const conflicts = (error?.payload?.conflictingOrders || []).join(', ');
    return t('رزرو هم‌پوشان مسدود شد. سفارش متعارض: ','Overlapping reservation blocked. Conflicting order: ') + conflicts;
  }
  return t('اقدام ثبت نشد. وضعیت و دامنه مجاز پرونده را بررسی کنید.','The action was not recorded. Check the case status and permitted scope.');
}
document.addEventListener('click', event => {
  const control = event.target.closest('button');
  if (!control) return;
  const {language, themeChoice, section, role, openScenario, pagination} = control.dataset;
  if (language && ['fa','en'].includes(language)) {
    state.lang = language;
    state.notice = '';
    savePreference('total-demo-language', language);
    setView();
    focusAfterRender('[data-language="' + language + '"]');
  } else if (themeChoice && ['light','dark'].includes(themeChoice)) {
    state.theme = themeChoice;
    savePreference('total-demo-theme', themeChoice);
    setView();
    focusAfterRender('[data-theme-choice="' + themeChoice + '"]');
  } else if (section && Object.hasOwn(sectionNames, section)) {
    state.section = section;
    state.notice = '';
    load().then(() => focusAfterRender('#sections [data-section="' + section + '"]'));
  } else if (role && Object.hasOwn(roleNames, role)) {
    state.role = role;
    state.notice = '';
    setView();
    focusAfterRender('.role-nav [data-role="' + role + '"]');
  } else if (openScenario && /^S\d{6}$/.test(openScenario)) {
    state.scenario = openScenario;
    state.section = 'workspace';
    state.notice = '';
    const url = new URL(location.href);
    url.searchParams.set('scenario', openScenario);
    history.replaceState(null, '', url.href);
    load();
  } else if (pagination) {
    state.offset += pagination === 'next' ? state.cases.limit : -state.cases.limit;
    load();
  } else if (Object.hasOwn(control.dataset, 'retry')) {
    load();
  }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (form.id === 'filters') {
    event.preventDefault();
    state.offset = 0;
    state.filters = Object.fromEntries(Array.from(new FormData(form)).filter(([, value]) => value !== ''));
    load();
  } else if (form.id === 'case-action') {
    event.preventDefault();
    if (state.saving) return;
    const action = event.submitter?.dataset.action;
    const formData = new FormData(form);
    const reason = formData.get('reason')?.trim();
    const verifier = formData.get('verifier')?.trim();
    const actor = actors[state.role];
    const scenario = state.scenario;
    if (!reason || !state.cases.allowedActions?.some(item => item.actor === actor && item.action === action)) return;
    state.saving = true;
    form.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    try {
      const payload = { revision: state.cases.revision, action, actor, reason };
      if (verifier) payload.verifier = verifier;
      const record = await api('cases/' + encodeURIComponent(scenario) + '/actions', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.cases = record;
        state.notice = t('اقدام در پرونده آموزشی ثبت شد.','The action was recorded in the training case.');
        setView();
      }
    } catch (error) {
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.notice = serverNotice(error);
        await load();
      }
    } finally {
      state.saving = false;
    }
  } else if (form.id === 'case-reservation') {
    event.preventDefault();
    if (state.saving) return;
    const formData = new FormData(form);
    const scenario = state.scenario;
    const body = {
      owner: String(formData.get('owner') || '').trim(),
      start_min: Number(formData.get('start_min')),
      end_min: Number(formData.get('end_min')),
      expires_at: Number(formData.get('expires_at')),
      now: Number(formData.get('now')),
      ...(state.cases?.approvedSnapshot ? { decision_revision: state.cases.approvedSnapshot.decisionRevision } : {})
    };
    state.saving = true;
    form.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    try {
      const result = await api('cases/' + encodeURIComponent(scenario) + '/reservations', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.cases = result.case;
        state.notice = t('رزرو تراکنشی در SQLite ثبت شد: ','Transactional reservation recorded in SQLite: ') + result.id;
        setView();
      }
    } catch (error) {
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.notice = serverNotice(error);
        await load();
      }
    } finally {
      state.saving = false;
    }
  }
});
const selectedScenario = new URLSearchParams(location.search).get('scenario');
if (/^S\d{6}$/.test(selectedScenario ?? '')) state.scenario = selectedScenario;
load();
