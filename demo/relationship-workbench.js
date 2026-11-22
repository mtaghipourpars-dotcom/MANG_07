/* Read-only what-if analysis over the canonical catalog and current case state. */
(function (global) {
  'use strict';

  const effectType = {completion: 'تکمیل', delivery: 'تحویل', collection: 'وصول', cost: 'هزینهٔ تکمیل'};
  const gateType = {capacity: 'ظرفیت', quality: 'کیفیت', budget: 'بودجه', deadline: 'موعد سخت', crossOrder: 'اثر بین سفارش‌ها'};
  const gateStatus = {verified: 'تأیید', rejected: 'رد', pending: 'در انتظار بررسی', na: 'نامرتبط'};
  const fields = {
    baseline: 'خط مبنای تعهد',
    noAction: 'پیش‌بینی بدون اقدام',
    withOption: 'پیش‌بینی با گزینه',
    deadline: 'موعد سخت',
    amount: 'مبلغ وصول (میلیون تومان)',
    rate: 'نرخ سالانه (درصد)',
    cost: 'هزینهٔ مستقیم گزینه (میلیون تومان)',
    budget: 'سقف بودجهٔ گزینه (میلیون تومان)'
  };
  const fa = new Intl.NumberFormat('fa-IR', {maximumFractionDigits: 2});
  const list = value => Array.isArray(value) ? value : [];
  const projectId = object => object.project_id;
  const orderId = object => object.production_order_id;
  const operationId = object => object.operation_id;
  const resourceId = object => String(object.machine_resource_id || '').split(' (')[0];
  const label = value => String(value ?? '');
  const esc = value => label(value).replace(/[&<>"']/g, char => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]
  ));

  function numeric(raw, allowRange = true) {
    const text = label(raw).trim()
      .replace(/[۰-۹]/g, char => '۰۱۲۳۴۵۶۷۸۹'.indexOf(char))
      .replace(/[٠-٩]/g, char => '٠١٢٣٤٥٦٧٨٩'.indexOf(char))
      .replace(/٫/g, '.').replace(/٬/g, '');
    if (!text) return {value: null, invalid: false};

    const parts = text.split('..');
    const values = parts.map(part => /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(part.trim()) ? Number(part) : NaN);
    if (!values.every(Number.isFinite) || values.length > (allowRange ? 2 : 1) || values[0] > values[1]) {
      return {value: null, invalid: true};
    }
    return {value: values.length === 1 ? values[0] : values, invalid: false};
  }

  function valueText(value) {
    if (Array.isArray(value)) return value.every(Number.isFinite) ? value.map(fa.format).join(' تا ') : 'نامشخص';
    return Number.isFinite(value) ? fa.format(value) : 'نامشخص';
  }

  function rawText(value) {
    return Array.isArray(value) ? value.join('..') : value ?? '';
  }

  function valueNode(key, value) {
    return '<b data-relation-' + key + ' data-value="' + esc(rawText(value)) + '">' + esc(valueText(value)) + '</b>';
  }

  function sumHours(values) {
    return values.every(value => Number.isFinite(value) && value >= 0)
      ? values.reduce((sum, value) => sum + value, 0)
      : null;
  }

  function capacity(operations, editedDemand, proposed, original) {
    const baselineDemand = sumHours(operations.map(operation => operation.planned_hours));
    const forecastDemand = sumHours(operations.map(operation => editedDemand.has(operationId(operation))
      ? numeric(editedDemand.get(operationId(operation)), false).value
      : operation.planned_hours));
    const gap = (demand, available) => Number.isFinite(demand) && Number.isFinite(available)
      ? Math.max(0, demand - available)
      : null;
    const baselineGap = gap(baselineDemand, original);
    const forecastGap = gap(forecastDemand, proposed);
    const change = baselineGap === null || forecastGap === null ? null : forecastGap - baselineGap;

    return {baselineDemand, forecastDemand, baselineGap, forecastGap, change};
  }

  function card(title, content) {
    return '<section class="app-card"><header class="app-card-head"><h3>' + esc(title) +
      '</h3></header><div class="app-card-body">' + content + '</div></section>';
  }

  function table(headers, rows) {
    if (!rows.length) return '<p class="app-muted">پیوند ثبت‌شده‌ای برای انتخاب فعلی وجود ندارد.</p>';
    return '<div class="app-table-wrap"><table class="app-table"><thead><tr>' +
      headers.map(header => '<th scope="col">' + esc(header) + '</th>').join('') +
      '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') +
        '</tr>').join('') + '</tbody></table></div>';
  }

  function control(key, title, options, current, emptyLabel = 'انتخاب کنید') {
    if (!options.length) return '';
    const choices = [['', emptyLabel], ...options];
    return '<label class="app-field"><span>' + esc(title) + '</span><select data-relation-' + key +
      ' data-relation-select="' + key + '">' + choices.map(([value, name]) => '<option value="' +
        esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(name || value) +
        '</option>').join('') + '</select></label>';
  }

  function field(key, title, value, group, placeholder = 'نامشخص') {
    const attribute = key.replace(/[A-Z]/g, char => '-' + char.toLowerCase());
    return '<label class="app-field"><span>' + esc(title) + '</span><input type="text" inputmode="decimal" dir="ltr" data-relation-' +
      attribute + ' data-relation-' + group + '="' + key + '" placeholder="' + esc(placeholder) + '" value="' +
      esc(rawText(value)) + '"></label>';
  }

  function action(title, page, view, caseId = '', id = '') {
    return '<button type="button" class="app-btn secondary" data-relation-route="' + page +
      '" data-relation-view="' + view + '" data-relation-caseid="' + esc(caseId) +
      '" data-relation-id="' + esc(id) + '">' + esc(title) + '</button>';
  }

  function mount(container, services) {
    const {catalog = {}, cases = [], cashStages = [], compare, challenge, delta, navigate, saveSimulation} = services;
    const projects = list(catalog.projects);
    const orders = list(catalog.orders);
    const operations = list(catalog.operations).filter(operation => orders.some(order =>
      orderId(order) === orderId(operation) && projectId(order) === projectId(operation)));
    const caseList = list(cases);
    const state = {
      project: projects.some(project => projectId(project) === services.projectId) ? services.projectId : '',
      order: '', resource: '', operation: '', case: '', option: '', effect: ''
    };
    const editedDemand = new Map();
    const forecastValues = new Map();
    let proposedCapacity = '';
    let originalCapacity = '';
    let capacitySnapshot = null;
    let forecastSnapshot = null;
    let saving = false;

    const get = (collection, id, requested) => collection.find(record => id(record) === requested);
    const byId = entity => entity.id;
    const selectedCase = () => get(caseList, byId, state.case);
    const selectedOption = () => get(list(selectedCase()?.options), byId, state.option);
    const selectedEffect = () => get(list(selectedCase()?.effects), byId, state.effect);
    const selectedOrders = () => orders.filter(order => !state.project || projectId(order) === state.project);
    const orderOperations = () => operations.filter(operation => !state.order
      ? !state.project || projectId(operation) === state.project
      : orderId(operation) === state.order);
    const sharedOperations = () => state.resource ? operations.filter(operation => resourceId(operation) === state.resource) : [];
    const foundCases = () => caseList.filter(item => {
      if (!state.project && !state.order && !state.resource) return true;
      if (state.resource && item.resource === state.resource) return true;
      if (state.order) return list(item.orders).includes(state.order) || list(item.effects).some(row => row.order === state.order);
      return list(item.orders).some(order => get(orders, orderId, order)?.project_id === state.project) ||
        list(item.effects).some(row => row.project === state.project);
    });

    function synchronize(key) {
      if (key === 'project') {
        state.order = selectedOrders().length === 1 ? orderId(selectedOrders()[0]) : '';
      }
      if (key === 'project' || key === 'order') {
        state.resource = '';
        state.operation = '';
      }
      if (['project', 'order', 'resource'].includes(key)) {
        state.operation = operationId(sharedOperations().find(operation => orderId(operation) === state.order) ||
          sharedOperations().find(operation => projectId(operation) === state.project) ||
          sharedOperations()[0] || {});
        if (key === 'resource') {
          // Availability is a user-supplied assumption specific to the selected resource.
          proposedCapacity = '';
          originalCapacity = '';
        }
        if (!foundCases().some(item => byId(item) === state.case)) state.case = '';
      }
      if (key !== 'effect' && key !== 'option') {
        const item = selectedCase();
        if (!list(item?.options).some(option => byId(option) === state.option)) state.option = '';
        if (!list(item?.effects).some(effect => byId(effect) === state.effect)) state.effect = '';
      }
    }

    function relationshipRows() {
      const records = [];
      const add = (source, relation, target, record, next = '') => {
        if (source && target) records.push([esc(source), esc(relation), esc(target), esc(record?.data_class || record?.dataClass || 'منشأ ثبت نشده'), next]);
      };
      const project = get(projects, projectId, state.project);
      const order = get(orders, orderId, state.order);
      const connectedProject = project?.project_id || order?.project_id;
      const selectedComponent = order && get(list(catalog.components), value => value.component_id, order.component_id);
      const commitments = list(catalog.commitments).filter(row => row.project_id === connectedProject);
      if (connectedProject) {
        for (const assignment of list(catalog.assignments).filter(row => row.project_id === connectedProject)) {
          const product = get(list(catalog.products), value => value.product_id, assignment.product_id);
          if (product) add(connectedProject, 'تخصیص محصول', product.product_id, assignment, action('سبد محصول', 'portfolio', 'assignments', '', connectedProject));
        }
        for (const commitment of commitments) {
          add(connectedProject, 'تعهد پروژه', commitment.commitment_id, commitment, action('تعهدات', 'projects', 'commitments', '', connectedProject));
        }
        for (const stage of list(cashStages).filter(row => row.project_id === connectedProject)) {
          add(connectedProject, 'مرحلهٔ وصول پروژه', stage.stage_id, stage, action('نقدینگی', 'resources', 'cash', '', connectedProject));
        }
      }
      if (order) {
        add(order.project_id, 'سفارش تولید', orderId(order), order, action('سفارش‌ها', 'projects', 'orders', '', order.project_id));
        if (selectedComponent) add(orderId(order), 'جزء مرتبط در BOM', selectedComponent.component_id, selectedComponent, action('ساختار محصول', 'projects', 'bom', '', order.project_id));
      }
      const localOperations = order ? orderOperations() : state.project ? orderOperations() : [];
      for (const operation of localOperations) {
        const id = operationId(operation);
        add(orderId(operation), 'فعالیت مسیر', id, operation, action('مسیر عملیات', 'projects', 'routing', '', operation.project_id));
        add(id, 'تقاضا از منبع', resourceId(operation), operation, action('منابع و ظرفیت', 'resources', 'capacity', '', resourceId(operation)));
      }
      for (const operation of sharedOperations().filter(op => !localOperations.some(local => operationId(local) === operationId(op)))) {
        add(resourceId(operation), 'اشتراک با فعالیت سفارش دیگر', operationId(operation), operation, action('مسیر عملیات', 'projects', 'routing', '', operation.project_id));
      }
      const item = selectedCase();
      if (item) {
        const caseLabel = item.title + ' · ' + item.id;
        add(item.resource, 'منبع چالش', caseLabel, item, action('پروندهٔ چالش', 'issues', 'register', item.id));
        for (const order of list(item.orders).filter(id => get(orders, orderId, id))) add(caseLabel, 'سفارش متأثر', order, item);
        for (const row of list(item.effects)) add(caseLabel, 'اثر ' + (effectType[row.type] || 'ثبت‌شده'), row.reference, item, action('برآورد ثبت‌شده', 'issues', 'register', item.id, row.id));
        for (const option of list(item.options)) add(caseLabel, 'راهکار پیشنهادی', option.title + ' · ' + option.id, item, action('راهکارها', 'solutions', 'register', item.id, option.id));
        if (item.decision) {
          const decision = item.decision;
          add(list(item.options).find(option => option.id === decision.optionId)?.title, 'راهکار منتخب در تصمیم', decision.id, item, action('تصمیم و گزینه‌ها', 'solutions', 'register', item.id, decision.optionId));
          for (const outcome of list(item.outcomes).filter(record => record.decisionId === decision.id)) {
            add(decision.id, 'نتیجهٔ شبیه‌سازی / ثبت‌شده', outcome.id, item, action('نتایج', 'memory', 'outcomes', item.id, outcome.id));
          }
          for (const lesson of list(item.lessons).filter(record => record.decisionId === decision.id &&
            list(item.outcomes).some(outcome => outcome.id === record.outcomeId && outcome.decisionId === decision.id))) {
            add(lesson.outcomeId, 'درس‌آموخته', lesson.text, item, action('درس‌آموخته‌ها', 'memory', 'lessons', item.id, lesson.id));
          }
        }
      }
      return records;
    }

    function capacityHtml() {
      capacitySnapshot = null;
      const ops = sharedOperations();
      if (!ops.length) return '<p class="app-muted">یک منبع با فعالیت مرتبط انتخاب کنید.</p>';
      const before = originalCapacity === '' ? numeric(proposedCapacity, false) : numeric(originalCapacity, false);
      const after = numeric(proposedCapacity, false);
      const result = capacity(ops, editedDemand, after.value, before.value);
      const rows = ops.map(operation => {
        const id = operationId(operation);
        const hours = editedDemand.has(id) ? numeric(editedDemand.get(id), false).value : operation.planned_hours;
        return [esc(operation.project_id), esc(orderId(operation)), esc(id), esc(valueText(operation.planned_hours)),
          esc(valueText(hours)), esc(operation.data_class || 'منشأ ثبت نشده')];
      });
      const invalid = before.invalid || after.invalid || [...editedDemand].some(([id, value]) =>
        ops.some(operation => operationId(operation) === id) && numeric(value, false).invalid);
      if (!invalid && result.forecastGap !== null && result.baselineGap !== null) {
        capacitySnapshot = {
          resourceId: state.resource,
          availableBefore: before.value,
          availableAfter: after.value,
          operationDemands: ops.map(operation => {
            const id = operationId(operation);
            return {id, orderId: orderId(operation), projectId: projectId(operation), hoursBefore: operation.planned_hours,
              hoursAfter: editedDemand.has(id) ? numeric(editedDemand.get(id), false).value : operation.planned_hours};
          }),
          ...result
        };
      }
      const updatedOrders = [...new Set(ops.filter(operation => editedDemand.has(operationId(operation)) &&
        numeric(editedDemand.get(operationId(operation)), false).value !== operation.planned_hours).map(orderId))];
      const affected = before.value !== after.value ? [...new Set(ops.map(orderId))] : updatedOrders;
      const casesToReview = caseList.filter(item => item.resource === state.resource ||
        list(item.effects).some(row => affected.includes(row.order)) || list(item.orders).some(id => affected.includes(id)));
      const review = affected.length ? '<p class="app-notice warn" data-relation-impacted-orders>سفارش‌های نیازمند بازبینی در صورت ثبت این فرض: ' +
        esc(affected.join('، ')) + '. پرونده‌های مرتبط: ' +
        esc(casesToReview.map(item => item.title).join('، ') || 'پیوند پرونده ثبت نشده است') +
        '. برای تبدیل تغییر ساعت به موعد جدید، تقویم و وابستگی معتبر لازم است.</p>' : '';
      return (invalid ? '<p class="app-notice warn">برای ظرفیت و ساعات تقاضا عدد نامنفی وارد کنید.</p>' : '') +
        table(['پروژه', 'سفارش', 'فعالیت', 'تقاضای مبنا (ساعت)', 'تقاضای سناریو (ساعت)', 'منشأ فعالیت'], rows) +
        '<p>تقاضای کل مبنا ' + valueNode('baseline-demand', result.baselineDemand) + ' و تقاضای کل سناریو ' +
        valueNode('total-demand', result.forecastDemand) + ' ساعت.</p><p>کسری مبنا ' + valueNode('baseline-gap', result.baselineGap) +
        '، کسری سناریو ' + valueNode('gap', result.forecastGap) + ' و تغییر کسری ' + valueNode('gap-change', result.change) + ' ساعت.</p>' + review;
    }

    function forecastKey(key, effect = selectedEffect()) {
      const option = selectedOption();
      return [state.case, ['cost', 'budget', 'withOption'].includes(key) ? option?.id : '', effect?.id || '', key].join('|');
    }

    function forecastInput(key, fallback, effect = selectedEffect()) {
      const reference = forecastKey(key, effect);
      return forecastValues.has(reference) ? forecastValues.get(reference) : fallback;
    }

    function computeForecast() {
      forecastSnapshot = null;
      const item = selectedCase();
      const option = selectedOption();
      if (!item) return '';
      const current = selectedEffect();
      if (!current) return '<p class="app-muted">تعهدی را برای مقایسهٔ مبنا و سناریو انتخاب کنید.</p>';
      const rows = structuredClone(list(item.effects));
      const nextOption = option ? structuredClone(option) : null;
      if (nextOption) nextOption.effects ??= {};
      let invalid = false;
      const edits = [];

      function apply(target, property, key, effect, range = true) {
        const edit = forecastValues.get(forecastKey(key, effect));
        if (edit === undefined) return;
        const parsed = numeric(edit, range);
        invalid ||= parsed.invalid;
        target[property] = parsed.value;
        edits.push({effectId: effect.id || null, field: key, value: parsed.value});
      }

      for (const row of rows) {
        apply(row, 'baseline', 'baseline', row);
        apply(row, 'noAction', 'noAction', row);
        if (row.type !== 'cost') apply(row, 'deadline', 'deadline', row, false);
        if (row.type === 'collection') {
          apply(row, 'amount', 'amount', row, false);
          apply(row, 'rate', 'rate', row, false);
        }
        if (nextOption) apply(nextOption.effects, row.id, 'withOption', row);
      }
      if (nextOption) {
        // Direct cost and budget belong to the selected option across all effect rows.
        apply(nextOption, 'cost', 'cost', {});
        apply(nextOption, 'budget', 'budget', {});
      }

      const base = option && typeof compare === 'function' ? compare(item, option) : null;
      const next = nextOption && typeof compare === 'function' ? compare({...item, effects: rows}, nextOption) : null;
      const previous = list(item.effects).find(row => row.id === current.id);
      const future = rows.find(row => row.id === current.id);
      const committed = list(item.decision?.rows).find(record => record.row.id === current.id);
      const proposed = record => record?.rows?.find(entry => entry.row.id === current.id);
      const unsigned = target => target.needsReview ? null : target.noAction;
      const official = committed ? committed.withOption : unsigned(previous);
      if (!invalid && edits.length && (challenge?.(future) != null || next?.net != null)) {
        forecastSnapshot = {
          inputs: edits,
          selectedEffect: {id: future.id, reference: future.reference, before: challenge?.(previous) ?? null,
            after: challenge?.(future) ?? null, forecastBefore: previous.noAction ?? null,
            forecastAfter: future.noAction ?? null, proposedWithOption: proposed(next)?.withOption ?? null,
            official: official ?? null},
          money: {before: base?.net ?? null, after: next?.net ?? null, partial: next?.incomplete ?? null},
          gates: next ? Object.fromEntries(Object.entries(next.gates).map(([key, gate]) => [key, gate.status])) : {}
        };
      }
      const forecastValuesByStage = [
        ['خط مبنا', previous.baseline, future.baseline],
        ['بدون اقدام', previous.noAction, future.noAction],
        ['اثر چالش (بدون اقدام − خط مبنا)', challenge?.(previous), challenge?.(future)],
        ['با گزینه', proposed(base)?.withOption, proposed(next)?.withOption],
        ['مقدار بازیافته (بدون اقدام − با گزینه)', proposed(base)?.recovered, proposed(next)?.recovered],
        ['مانده نسبت به خط مبنا (با گزینه − خط مبنا)', proposed(base)?.remaining, proposed(next)?.remaining]
      ];
      const difference = (before, after) => {
        if (before == null || after == null) return null;
        if (rawText(before) === rawText(after)) return 0;
        return delta?.(after, before, {paired: future.paired === true});
      };
      const rowsHtml = forecastValuesByStage.map(([name, before, after], index) => [
        esc(name), esc(valueText(before)), index === 2 ? valueNode('challenge-impact', after) : esc(valueText(after)),
        esc(valueText(difference(before, after)))
      ]);
      const money = next ? '<p>خالص عدددار گزینهٔ ذخیره‌شده ' + valueNode('net-before', base?.net) + ' و پیش‌نمایش ' +
        valueNode('net-after', next.net) + ' میلیون تومان. ' + (next.incomplete ? 'بخشی از داده‌ها نامشخص است.' : '') +
        '</p><p class="app-muted">' + esc(next.methodology) + '</p><p data-relation-feasible="' + Boolean(next.feasible) + '">' +
        (next.feasible ? 'قیود فعلی این پیش‌نمایش مانع ندارند.' : 'پیش‌نمایش قیود لازم برای تصویب را احراز نکرده است.') +
        '</p>' + table(['قید', 'وضعیت گزینهٔ ذخیره‌شده', 'وضعیت سناریو', 'علت'], Object.entries(next.gates).map(([key, gate]) => [
          esc(gateType[key] || key), esc(gateStatus[base?.gates?.[key]?.status] || 'نامشخص'),
          '<span data-relation-gate="' + esc(key) + '" data-status="' + esc(gate.status) + '">' +
          esc(gateStatus[gate.status] || 'نامشخص') + '</span>', esc(gate.reason || '')
        ])) : '';
      const comparison = table(['شاخص (' + (future.type === 'cost' ? 'میلیون تومان' : 'روز نسبی') + ')',
        'مقدار ذخیره‌شده', 'پیش‌نمایش سناریو', 'تغییر سناریو'], rowsHtml);
      return (invalid ? '<p class="app-notice warn">مقدار معتبر وارد کنید. نمونهٔ بازهٔ روز یا هزینه: ۱۲..۱۵.</p>' : '') +
        (future.needsReview ? '<p class="app-notice warn">پس از تغییر فرض، برآورد این ردیف نیازمند بازبینی است.</p>' : '') +
        comparison + '<p>پیش‌بینی جاری نقشهٔ ارزش برای این تعهد ' + valueNode('official', official) +
        (committed ? '، از نسخهٔ ثابت تصمیم مصوب.' : '، در وضعیت بدون اقدام.') + '</p>' +
        '<p class="app-muted">مرجع تعهد: ' + esc(future.reference || 'نامشخص') + ' · شاهد یا فرض: ' +
        esc(future.origin || 'نامشخص') + ' · مبدأ روز: ' + esc(future.timeOrigin || 'نامرتبط') + '</p>' +
        '<p class="app-muted">' + (future.paired ? 'بازهٔ جفت‌شده: اختلاف در سناریوهای متناظر محاسبه می‌شود.' :
          'بازهٔ مستقل: حد پایین = جدید پایین − قدیم بالا و حد بالا = جدید بالا − قدیم پایین.') + '</p>' + money;
    }

    function forecastFields() {
      const item = selectedCase();
      const effect = selectedEffect();
      const option = selectedOption();
      if (!item) return '';
      const options = list(item.options).map(record => [record.id, record.title]);
      const effects = list(item.effects).map(row => [row.id,
        (effectType[row.type] || 'اثر ثبت‌شده') + ' · ' + (row.order || row.reference || row.id)]);
      const controlFields = control('effect', 'تعهد / ردیف اثر', effects, state.effect) +
        control('option', 'راهکار', options, state.option, 'بدون گزینه');
      const type = effect?.type;
      const keys = ['baseline', 'noAction', ...(type === 'cost' ? [] : ['deadline']),
        ...(type === 'collection' ? ['amount', 'rate'] : []), ...(option ? ['withOption', 'cost', 'budget'] : [])];
      const inputs = effect ? keys.map(key => {
        const shared = key === 'cost' || key === 'budget';
        const fallback = key === 'withOption' ? option.effects?.[effect.id] : shared ? option[key] : effect[key];
        return field(key, fields[key], forecastInput(key, fallback, shared ? {} : effect), 'forecast');
      }).join('') : '';
      return '<div class="app-form">' + controlFields + inputs + '</div><p>' +
        action('باز کردن فرم اثر چالش', 'issues', 'register', item.id, effect?.id) +
        ' ' + action('باز کردن فرم راهکار', 'solutions', 'register', item.id, option?.id) + '</p>' +
        '<div data-relation-forecast-output aria-live="polite">' + computeForecast() + '</div>';
    }

    function updateSaveButton() {
      const button = container.querySelector('[data-relation-save]');
      if (!button) return;
      button.hidden = !capacitySnapshot && !forecastSnapshot;
      button.disabled = saving;
    }

    function render() {
      capacitySnapshot = null;
      forecastSnapshot = null;
      const projectChoices = projects.map(project => [projectId(project), project.project_name || project.name]);
      const orderChoices = selectedOrders().map(order => [orderId(order), orderId(order) + ' · ' + projectId(order)]);
      const resourceChoices = [...new Set(orderOperations().map(resourceId).filter(Boolean))].map(id => [id, id]);
      const caseChoices = foundCases().map(item => [item.id, item.title]);
      const ops = sharedOperations();
      const selected = get(ops, operationId, state.operation);
      const operationOptions = ops.map(operation => [operationId(operation), operationId(operation) + ' · ' + orderId(operation)]);
      const objectInputs = control('project', 'پروژه', projectChoices, state.project, 'همهٔ پروژه‌ها') +
        control('order', 'سفارش', orderChoices, state.order, 'همهٔ سفارش‌های این دامنه') +
        control('resource', 'منبع عملیاتی', resourceChoices, state.resource) +
        control('case', 'پروندهٔ چالش', caseChoices, state.case);
      const capacityInputs = ops.length ? control('operation', 'فعالیت برای تغییر تقاضا', operationOptions, state.operation) +
        (selected ? field('demand', 'تقاضای فعالیت در سناریو (ساعت)',
          editedDemand.get(operationId(selected)) ?? selected.planned_hours, 'capacity') : '') +
        field('available', 'ظرفیت در دسترس در سناریو (ساعت)', proposedCapacity, 'capacity') +
        field('baseline-available', 'ظرفیت مبنا (اختیاری، ساعت)', originalCapacity, 'capacity', 'در صورت خالی: همان ظرفیت سناریو') : '';
      const caveat = '<p class="app-muted">کسری = بیشترِ صفر یا (جمع تقاضای فعالیت‌ها − ظرفیت در دسترس). ' +
        'برای این پیش‌نمایش فرض کنید فعالیت‌های فهرست‌شده در یک بازهٔ مشترک قرار دارند. زمان‌بندی و تاریخ تعهد به تقویم و وابستگی معتبر نیاز دارد. ' +
        'اگر ظرفیت مبنا را خالی بگذارید، ظرفیت واردشده برای هر دو حالت به کار می‌رود.</p>';
      container.innerHTML = card('کاوش اثر تغییر اشیای مرتبط',
        '<p class="app-notice warn">آزمایش موقت در دمو. برای ثبت نسخهٔ جدید از فرم همان پرونده استفاده کنید. دادهٔ ثبت‌شده و تصمیم مصوب در این پنل تغییر نمی‌کند.</p>' +
        '<div class="app-form">' + objectInputs + '</div>') +
        card('پیوندهای ثبت‌شدهٔ اشیا', table(['مبدأ', 'نوع پیوند', 'مقصد', 'طبقهٔ داده', 'نمای مرتبط'], relationshipRows())) +
        card('پیش‌نمایش تقاضا و ظرفیت منبع مشترک', caveat + '<div class="app-form">' + capacityInputs + '</div>' +
          '<div data-relation-capacity-output aria-live="polite">' + capacityHtml() + '</div>') +
        (state.case ? card('پیش‌نمایش اثر بر تعهد و راهکار', forecastFields()) : '') +
        (typeof saveSimulation === 'function' ? '<p><button type="button" class="app-btn primary" data-relation-save hidden>ثبت نسخهٔ آزمایشی در بانک اطلاعاتی</button> <span role="status" data-relation-save-status></span></p>' : '');
      updateSaveButton();
    }

    container.onchange = event => {
      const key = event.target.dataset.relationSelect;
      if (!key) return;
      state[key] = event.target.value;
      synchronize(key);
      render();
      container.querySelector('[data-relation-select="' + key + '"]')?.focus({preventScroll: true});
    };
    container.oninput = event => {
      const target = event.target;
      const key = target.dataset.relationCapacity;
      const changedForecast = target.dataset.relationForecast;
      if (key) {
        if (key === 'available') proposedCapacity = target.value;
        if (key === 'baseline-available') originalCapacity = target.value;
        if (key === 'demand' && state.operation) editedDemand.set(state.operation, target.value);
        container.querySelector('[data-relation-capacity-output]').innerHTML = capacityHtml();
      }
      if (changedForecast) {
        const effect = ['cost', 'budget'].includes(changedForecast) ? {} : selectedEffect();
        forecastValues.set(forecastKey(changedForecast, effect), target.value);
        container.querySelector('[data-relation-forecast-output]').innerHTML = computeForecast();
      }
      if (key || changedForecast) updateSaveButton();
    };
    container.onclick = async event => {
      if (event.target.closest('[data-relation-save]')) {
        if (saving || (!capacitySnapshot && !forecastSnapshot)) return;
        const links = {
          projectId: state.project || get(orders, orderId, state.order)?.project_id || null,
          orderId: state.order || null, operationId: state.operation || null, resourceId: state.resource || null,
          caseId: state.case || null, optionId: state.option || null, effectId: state.effect || null
        };
        saving = true;
        updateSaveButton();
        const status = container.querySelector('[data-relation-save-status]');
        try {
          const committed = await saveSimulation(structuredClone({schemaVersion: 1, classification: 'DEMO_SYNTHETIC', links,
            capacity: capacitySnapshot, forecast: forecastSnapshot}));
          status.textContent = committed === false
            ? 'ذخیره انجام نشد. ورودی‌ها همچنان قابل بررسی هستند.'
            : 'نسخهٔ آزمایشی ذخیره شد.';
        } catch {
          status.textContent = 'ذخیره انجام نشد. ورودی‌ها همچنان قابل بررسی هستند.';
        } finally {
          saving = false;
          updateSaveButton();
        }
        return;
      }
      const link = event.target.closest('[data-relation-route]');
      if (!link) return;
      const {relationRoute, relationView, relationCaseid, relationId} = link.dataset;
      navigate?.(relationRoute, relationView, relationCaseid, relationId);
    };

    synchronize('project');
    if (services.resourceId && orderOperations().some(operation => resourceId(operation) === services.resourceId)) {
      state.resource = services.resourceId;
      synchronize('resource');
    }
    render();
  }

  global.PVPTRelationships = {mount, capacity, numeric};
})(globalThis);
