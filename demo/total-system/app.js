'use strict';

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const state = {
  lang: preference('total-demo-language', 'fa', ['fa', 'en']),
  theme: preference('total-demo-theme', 'light', ['light', 'dark']),
  section: 'workspace', role: 'owner', scenario: 'S000013', offset: 0, filters: {}, overview: null,
  cases: null, detail: null, executive: null, notice: '', loading: false, unavailable: false, saving: false
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
  DIFFERENT_PERIOD:['دوره متفاوت','Different period'], INTERNAL_TRANSFER:['گردش داخلی','Internal transfer'],
  manufacturing_cost_effect:['اثر بهای ساخت','Manufacturing cost effect'], released_capacity:['ظرفیت آزادشده','Released capacity'],
  M_TOMAN:['میلیون تومان','Million toman'], HOUR:['ساعت','Hour'],
  DRAFT:['پیش‌نویس','Draft'], REPORTED:['ثبت‌شده','Reported'], SCOPED:['دامنه بررسی شده','Scoped'], ASSESSED:['ارزیابی‌شده','Assessed'],
  APPROVED:['مصوب','Approved'], DECLINED:['رد شده','Declined'], EXECUTED:['اجراشده','Executed'], OBSERVED:['مشاهده‌شده','Observed'],
  CLOSED:['بسته','Closed'], FEASIBLE:['امکان‌پذیر','Feasible'], BLOCKED_DONOR:['نقض موعد سفارش اهداکننده','Donor commitment breached'],
  BLOCKED_RESERVATION:['تعارض رزرو','Reservation conflict'], WAIT_EVIDENCE:['در انتظار شاهد','Evidence required'],
  VERIFIED:['تأییدشده','Verified'], PARTIALLY_VERIFIED:['تأیید جزئی','Partially verified'], RESERVED:['رزروشده','Reserved'],
  BLOCKED_CONFLICT:['مسدود با تعارض','Blocked by conflict'], INTERNAL_SOURCE_REQUIRED:['منبع داخلی لازم است','Internal source required']
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
function label(value) { return Object.hasOwn(labels,value) ? t(...labels[value]) : value; }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function show(value) {
  if (value === null || value === undefined || value === '') return t('نامشخص','Unknown');
  if (typeof value === 'number') return new Intl.NumberFormat(t('fa-IR','en-US'),{maximumFractionDigits:2}).format(value);
  if (typeof value === 'boolean') return value ? t('بله','Yes') : t('خیر','No');
  return esc(label(value));
}
function code(value) { return '<bdi dir="ltr"><code>' + esc(value) + '</code></bdi>'; }
function button(text, attrs, primary = false) {
  return '<button type="button" ' + attrs + (primary ? ' class="primary"' : '') + '>' + text + '</button>';
}
function table(headers, rows) {
  if (!rows.length) return '<p class="muted">' + t('رکوردی در این نما نیست.','No records in this view.') + '</p>';
  return '<div class="table-wrap" tabindex="0"><table><thead><tr>' + headers.map(value => '<th scope="col">' + value + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(value => '<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function card(title, body) { return '<section class="card"><h2>' + title + '</h2>' + body + '</section>'; }
function metrics(values) {
  return '<div class="metrics">' + values.map(([name,value]) => '<div class="metric"><span>' + name +
    '</span><strong>' + value + '</strong></div>').join('') + '</div>';
}
async function api(path, options) {
  const response = await fetch('/api/total-demo/' + path, options);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
function orderedNav(items, key, selected) {
  return Object.entries(items).map(([value,name]) => button(t(...name), 'data-' + key + '="' + value + '" aria-pressed="' + (selected === value) + '"')).join('');
}
function setView() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = t('rtl','ltr');
  document.documentElement.dataset.theme = state.theme;
  document.title = t('پارس | دموی جامع حفاظت از ارزش','PARS | Value protection demo');
  $('#boundary').textContent = t('سناریوها و مقادیر · داده آموزشی','Scenarios and figures · Training data');
  $('#page-title').textContent = t('حفاظت از ارزش و تعهدات','Value and commitment protection');
  $('#description').textContent = t('پرونده مشترک چهار فضای کار را به زنجیره تعهد، گزینه‌ها و شواهد تصمیم پیوند می‌دهد. برای وضعیت عملیاتی، منبع داخلی تأییدشده لازم است.',
    'A shared case connects four workspaces to commitments, options and decision evidence. Operational status requires a verified internal source.');
  document.querySelectorAll('[data-language],[data-theme-choice]').forEach(node => node.setAttribute('aria-pressed',
    String(node.dataset.language === state.lang || node.dataset.themeChoice === state.theme)));
  $('#sections').innerHTML = orderedNav(sectionNames,'section',state.section);
  $('#notice').textContent = state.notice;
  if (state.loading) {
    screen.innerHTML = '<p role="status">' + t('در حال دریافت اطلاعات…','Loading information…') + '</p>';
  } else if (state.unavailable) {
    screen.innerHTML = card(t('منبع در دسترس نیست','Source unavailable'),
      '<p>' + t('بانک سناریو یا خدمت پرونده پاسخ نداد.','The scenario bank or case service did not respond.') + '</p>' +
      button(t('تلاش دوباره','Retry'),'data-retry',true));
  } else {
    screen.innerHTML = {workspace, scenarios, evidence}[state.section]();
  }
}
function focusAfterRender(selector) { $(selector)?.focus({preventScroll:true}); }
function stageRow(item) {
  return [button(code(item.id),'data-open-scenario="' + esc(item.id) + '"'),code(item.anchor),show(item.stage),show(item.option),show(item.gate),show(item.execution)];
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
  return card(t('بانک سناریوها','Scenario bank'),
    metrics([[t('سناریو','Scenarios'),show(count.scenarios)],[t('رخداد','Events'),show(count.events)],[t('اثر مرحله‌ای','Stage effects'),show(count.effects)]]) +
    '<form id="filters"><div class="filters">' + entries.map(select).join('') + '</div><button class="primary" type="submit">' + t('اعمال فیلتر','Apply filters') + '</button></form>' +
    table(['id','anchor','stage','option','gate','execution'].map(show),result.items.map(stageRow)) +
    '<div class="actions pager"><span>' + t('تعداد نتایج: ','Matching records: ') + show(result.total) + '</span>' +
      button(t('قبلی','Previous'),'data-pagination="prev"' + (state.offset <= 0 ? ' disabled' : '')) +
      button(t('بعدی','Next'),'data-pagination="next"' + (state.offset + result.limit >= result.total ? ' disabled' : '')) + '</div>');
}
function timeline(items) {
  return table([t('ترتیب','Sequence'),t('عامل','Actor'),t('اقدام','Action'),t('وضعیت','Status'),t('دلیل یا شاهد','Reason or evidence')],items.map(item => [
    show(item.revision ?? item.sequence),show(item.actor), actionNames[item.action] ? t(...actionNames[item.action]) : show(item.action),show(item.status),show(item.reason)
  ]));
}
function effectTable(items) {
  return table([t('مرحله تعهد','Commitment stage'),t('خط مبنا','Baseline'),t('بدون اقدام','Without action'),
    t('گزینه پیشنهادی','Proposed option'),t('پیش‌بینی مصوب','Approved forecast'),t('وضع جاری','Current forecast'),t('مشاهده','Observed')],
    items.map(item => [show(item.node),show(item.baseline),show(item.without_action),show(item.proposed),
      show(item.approved_forecast ?? (state.detail?.decision === 'APPROVED' ? item.proposed : null)),show(item.current_forecast),show(item.observed)]));
}
function caseActions(record) {
  const choices = (record.allowedActions ?? []).filter(item => item.actor === actors[state.role]);
  if (!choices.length) return '<p class="muted">' + t('اقدام مجاز برای این نقش و مرحله وجود ندارد.','There is no permitted action for this role and stage.') + '</p>';
  return '<form id="case-action" data-case-action><label>' + t('دلیل اقدام','Action reason') +
    ' <input name="reason" type="text" required maxlength="240"></label><div class="actions">' +
    choices.map(({action}) => '<button type="submit" class="primary" data-action="' + esc(action) + '">' + t(...actionNames[action]) + '</button>').join('') +
    '</div></form>';
}
function workspace() {
  const detail = state.detail;
  const record = state.cases;
  if (!detail || !record) return '';
  const levels = {
    owner: t('مدیر · مالک تعهد','Management · Commitment owner'),
    expert: t('کارشناس · ثبت شاهد و اثر','Expert · Reporting and evidence'),
    assessor: t('مدیر · ارزیابی گزینه','Management · Option assessment'),
    executive: t('مدیر ارشد · تصمیم و پیگیری','Executive · Decision and follow-up')
  };
  const referenceLabel = '<p class="muted">' + t('این مقادیر از مرجع ثابت بانک سناریو خوانده شده‌اند. وضعیت این اجرای دمو در گردش پرونده جدا ثبت می‌شود.',
    'These figures come from the fixed scenario bank. This training run has its own case history.') + '</p>';
  const effects = card(t('تعهدات و زنجیره اثر · روز آموزشی','Commitments and impact chain · Training days'),
    referenceLabel + effectTable(detail.effect ?? []) + button(t('مشاهده چالش و شاهد','Open issue and evidence'),'data-role="expert"') +
    button(t('بررسی گزینه پرونده','Review case option'),'data-role="assessor"'));
  let context = '';
  if (state.role === 'owner') context = effects;
  if (state.role === 'expert') context = card(t('مشاهده، چالش و شواهد','Observation, issue and evidence'),
    metrics([[t('منبع','Resource'),show(detail.resource)],[t('مرحله اثر','Affected stage'),show(detail.stage)]]) +
    timeline((detail.event ?? []).filter(item => ['EXPERT','REVIEWER'].includes(item.actor))) +
    button(t('مشاهده تعهدها','Open commitments'),'data-role="owner"'));
  if (state.role === 'assessor') context = card(t('ارزیابی گزینه و قیدها','Option assessment and constraints'),
    metrics([[t('گزینه','Option'),show(detail.option)],[t('قید','Gate'),show(detail.gate)],[t('پروفایل','Profile'),show(detail.profile)]]) + referenceLabel + effectTable(detail.effect ?? []));
  if (state.role === 'executive') context = card(t('تصمیم، اجرا و مشاهده','Decision, execution and observation'),
    metrics([[t('نتیجه مرجع سناریو','Scenario reference outcome'),show(detail.outcome)],[t('تصمیم مرجع سناریو','Scenario reference decision'),show(detail.decision)],
      [t('اجرای مرجع سناریو','Scenario reference execution'),show(detail.execution)]]) + referenceLabel + effectTable(detail.effect ?? []) +
    button(t('شواهد رزرو و مالی','Reservation and finance evidence'),'data-section="evidence"'));
  return '<nav class="navigation role-nav" aria-label="' + t('فضاهای کار','Workspaces') + '">' + orderedNav(roleNames,'role',state.role) + '</nav>' +
    card(levels[state.role], metrics([[t('پرونده مشترک','Shared case'),code(record.scenarioId)],[t('وضعیت این اجرای دمو','Demo run status'),show(record.status)],
        [t('نسخه','Revision'),show(record.revision)],
        [t('مرجع سناریو','Scenario anchor'),code(detail.anchor)]]) + caseActions(record) +
      '<p class="muted">' + t('نقش‌ها در این محیط آموزشی نمایشی‌اند.','Workspace roles are simulated in this training environment.') + '</p>') +
    context + card(t('گردش پرونده در این اجرا','Case history for this run'),timeline(record.history ?? [])) +
    card(t('گردش از پیش محاسبه‌شده در بانک آموزشی','Precomputed training-bank history'),timeline(detail.event ?? []));
}
function evidence() {
  const data = state.executive;
  if (!data) return '';
  const finance = data.finance ?? {};
  const conflict = data.order_conflict;
  const reservation = conflict ? card(t('مصوبه و رزرو ظرفیت','Approval and capacity reservation'),
    '<p>' + t('مصوبه و رزرو دو وضعیت مستقل‌اند. رزرو هم‌پوشان مسدود می‌شود.','Approval and reservation have separate states. Overlapping reservations are blocked.') + '</p>' +
    metrics([[t('منبع','Resource'),code(conflict.resource)],[t('سفارش حفاظت‌شده','Protected order'),code(conflict.protected_order)]]) +
    table([t('درخواست','Request'),t('بازهٔ دقیقه','Minute interval'),t('وضعیت','Status'),t('سفارش متعارض','Conflicting order')], [
      [t('رزرو موجود','Existing reservation'),conflict.reserved_slot,conflict.existing],
      [t('درخواست جدید','New request'),conflict.incoming_requested_slot,conflict.requested],
      [t('بازه جایگزین','Alternative slot'),conflict.alternative_slot,conflict.alternative]
    ].map(([name,interval,item]) => [name, interval ? interval.map(show).join(' – ') : show(null), show(item?.status),
      item?.conflicting_orders?.length ? item.conflicting_orders.map(code).join(', ') : '—']))) : '';
  const funding = card(t('آمادگی نقد قبل از مهلت · میلیون تومان','Funding readiness before deadline · million toman'),
    table([t('گزینه','Option'),t('مهلت','Deadline'),t('نیاز','Required'),t('موجود تا مهلت','Available by deadline'),t('کسری','Gap'),t('امکان اجرا','Feasibility')],
      (finance.funding ?? []).map(row => [code(row.option),code(row.deadline),show(row.required),show(row.available_by_deadline),show(row.gap),show(row.feasible)])));
  const cost = finance.cost ? card(t('کنترل هزینه و پیشرفت','Cost and progress controls'),
    metrics([['PV',show(finance.cost.pv)],['EV',show(finance.cost.ev)],['AC',show(finance.cost.ac)],['CPI',show(finance.cost.cpi)],['CV',show(finance.cost.cv)]]) +
    '<p class="muted">' + t('دوره، خط مبنا و واحد: ','Period, baseline and unit: ') +
      [finance.cost.period,finance.cost.baseline,finance.cost.currency].map(code).join(' · ') + '</p>' +
    table([t('سند','Document'),t('ردیف','Line'),t('مبلغ','Amount'),t('شامل شده','Included'),t('علت','Reason')],
      (finance.cost.postings ?? []).map(row=>[code(row.document),show(row.line),show(row.amount),show(row.included),show(row.reason)]))) : '';
  const cash = card(t('وصول و ارزش زمانی پول','Collections and time value of money'),
    table([t('مرحله','Stage'),t('خط مبنا','Baseline'),t('پیش‌بینی','Forecast'),t('روز تأخیر','Delay in days'),t('اصل طلب','Principal'),
      t('وصول مشاهده‌شده','Observed receipt'),t('هزینه زمانی','Timing cost')],
      (finance.cash?.stages ?? []).map(row=>[code(row.stage),code(row.date_baseline),code(row.date_forecast),show(row.delay_days),
        show(row.principal),show(row.observed_receipt),show(row.timing_cost_m_toman)])) +
    table([t('شاخص مستقل','Separate metric'),t('مقدار','Value'),t('واحد','Unit'),t('شاهد','Evidence')],
      (finance.cash?.independent_metrics ?? []).map(row=>[show(row.metric),show(row.value),show(row.unit),code(row.evidence)])));
  const governance = data.governance ? card(t('صف تصمیم و پایش مدیرعامل','CEO decision queue and watchlist'),
    table([t('پرونده','Case'),t('تعهد','Commitment'),t('مسئول','Owner'),t('وضعیت','Status')],(data.governance.ceo_queue ?? []).map(row=>
      [code(row.id),code(row.promise),code(row.owner),show(row.latest_valid_status?.status)])) +
    '<p>' + t('پرونده‌های پرریسک جداگانه در پایش: ','High-risk cases tracked separately: ') +
    (data.governance.high_risk_watch ?? []).map(code).join(' · ') + '</p>') : '';
  const commitments = data.promises ? card(t('تعهدات افق ۲۴ و ۷۲ ساعت','Commitments in 24 and 72 hours'),
    Object.entries(data.promises).map(([period,rows]) =>
      '<h3>' + code(period) + '</h3>' + table([t('تعهد','Commitment'),t('سفارش','Order'),t('موعد دقیقه','Due minute'),
        t('آمادگی','Readiness'),t('شاهد','Evidence')],rows.map(row=>[code(row.id),code(row.order),show(row.due_minute),show(row.readiness),
        (row.controls ?? []).map(control=>code(control.evidence)).join(' · ') || '—']))).join('')) : '';
  return reservation + commitments + governance + funding + cost + cash;
}
let loadCounter = 0;
async function load() {
  const request = ++loadCounter;
  const {section, scenario, filters, offset} = state;
  state.loading = true;
  state.unavailable = false;
  setView();
  try {
    if (section === 'workspace') {
      const id = encodeURIComponent(scenario);
      const [detail, record] = await Promise.all([api('scenarios/' + id),api('cases/' + id)]);
      if (request === loadCounter) Object.assign(state,{detail,cases:record});
    } else if (section === 'scenarios') {
      const query = new URLSearchParams({...filters,offset:String(offset),limit:'20'});
      const [overview, result] = await Promise.all([api('summary'),api('scenarios?' + query)]);
      if (request === loadCounter) Object.assign(state,{overview,cases:result});
    } else {
      const result = await api('executive');
      if (request === loadCounter) state.executive = result.executive;
    }
  } catch {
    if (request === loadCounter) state.unavailable = true;
  } finally {
    if (request === loadCounter) {
      state.loading = false;
      setView();
    }
  }
}
function serverNotice(status) {
  return status === '409'
    ? t('نسخه پرونده تغییر کرده است. وضعیت جدید بارگذاری شد.','The case version changed. Its current state has been loaded.')
    : t('اقدام ثبت نشد. وضعیت و دامنه مجاز پرونده را بررسی کنید.','The action was not recorded. Check the case status and permitted scope.');
}
document.addEventListener('click', event => {
  const control = event.target.closest('button');
  if (!control) return;
  const {language, themeChoice, section, role, openScenario, pagination} = control.dataset;
  if (language && ['fa','en'].includes(language)) {
    state.lang = language;
    state.notice = '';
    savePreference('total-demo-language',language);
    setView();
    focusAfterRender('[data-language="' + language + '"]');
  } else if (themeChoice && ['light','dark'].includes(themeChoice)) {
    state.theme = themeChoice;
    savePreference('total-demo-theme',themeChoice);
    setView();
    focusAfterRender('[data-theme-choice="' + themeChoice + '"]');
  } else if (section && Object.hasOwn(sectionNames,section)) {
    state.section = section;
    state.notice = '';
    load().then(()=>focusAfterRender('#sections [data-section="' + section + '"]'));
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
    url.searchParams.set('scenario',openScenario);
    history.replaceState(null,'',url.href);
    load();
  } else if (pagination) {
    state.offset += pagination === 'next' ? state.cases.limit : -state.cases.limit;
    load();
  } else if (Object.hasOwn(control.dataset,'retry')) {
    load();
  }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (form.id === 'filters') {
    event.preventDefault();
    state.offset = 0;
    state.filters = Object.fromEntries(Array.from(new FormData(form)).filter(([,value])=>value !== ''));
    load();
  } else if (form.id === 'case-action') {
    event.preventDefault();
    if (state.saving) return;
    const action = event.submitter?.dataset.action;
    const reason = new FormData(form).get('reason')?.trim();
    const actor = actors[state.role];
    const scenario = state.scenario;
    if (!reason || !state.cases.allowedActions?.some(item => item.actor === actor && item.action === action)) return;
    state.saving = true;
    form.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const record = await api('cases/' + encodeURIComponent(scenario) + '/actions',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({revision:state.cases.revision,action,actor,reason})
      });
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.cases = record;
        state.notice = t('اقدام در پرونده آموزشی ثبت شد.','The action was recorded in the training case.');
        setView();
      }
    } catch(error) {
      if (state.section === 'workspace' && state.scenario === scenario) {
        state.notice = serverNotice(error.message);
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
