# قرارداد رابط دموی جامع

[api-contract.json](api-contract.json) قرارداد ماشینی نسخه ۲ را ثبت می‌کند. پیاده‌سازی مرجع در `server/total-demo.js` و `server/workspace-db.js` است.

| مسیر نسبت به `/api/total-demo` | ماهیت داده / موتور | نتیجه در پاسخ موفق |
|---|---|---|
| GET `/summary` | بانک خواندنی سناریو | شمار بانک و مقادیر فیلتر، به همراه `actorMode` و `enterpriseAuthStatus` |
| GET `/scenarios` | بانک خواندنی سناریو | سطرهای سناریو به ترتیب شناسه پس از فیلتر و صفحه‌بندی |
| GET `/scenarios/:id` | بانک خواندنی + لینک‌های فضای کار | سناریو، مرجع، رویدادهای بانک، اثرهای مستقیم و جانبی و پیوندهای تعهد↔چالش↔گزینه |
| GET `/executive` | `READ_ONLY_PRECOMPUTED_SCENARIO_BANK` | نمای تلفیقی از پیش محاسبه‌شده بانک آموزشی درباره قول‌ها، تعارض، حاکمیت و مالی |
| GET `/finance/trace` | `LIVE_SQLITE_BANK_QUERY` | پرس‌وجوی زنده از جدول‌های `finance_*` (کنترل هزینه با ردیابی سند، DAG ضددوباره‌شماری و ۴ خروجی اقتصادی مستقل) |
| POST `/finance/verify-posting` | `LIVE_SQLITE_BANK_QUERY` | اعتبارسنجی سند مالی نسبت به دوره، ارز، حذف انتقال داخلی و تأیید مالی |
| GET `/governance/queue` | `LIVE_SQLITE_BANK_QUERY` | پرس‌وجوی زنده از جدول‌های `gov_*` (تفکیک صف مدیرعامل از فهرست ریسک بالا و تاریخچه انتقال به جانشین) |
| POST `/governance/evaluate` | `LIVE_SQLITE_BANK_QUERY` | ارزیابی سقف اختیار، سیاست مدیرعامل و مهلت پذیرش در سطح نقش نمایشی |
| GET `/cases/:id/links` و POST `/cases/:id/links` | چندبه‌چند SQLite | پیوند نسخه‌دار تعهد، چالش و گزینه با `effectType`، `reviewStatus` و `evidenceRef` |
| GET `/commitments/:commitmentId/links` | پرس‌وجوی چندبه‌چند SQLite | بازیابی همه چالش‌ها، گزینه‌ها، اثرهای جانبی اهداکننده و درس‌آموخته‌های یک تعهد |
| GET `/issues/:id/commitments` | پرس‌وجوی چندبه‌چند SQLite | بازیابی همه تعهدهای مستقیم و جانبی اهداکننده متأثر از یک چالش و درس‌آموخته‌های آن |
| GET `/clock` و POST `/clock/advance` | ساعت شبیه‌سازی کنترل‌شده در سرور | خواندن و پیشروی یکنواخت ساعت هر پرتفوی در SQLite (`now` کلاینت رد می‌شود) |
| GET `/reservations` و POST `/cases/:id/reservations` | `LIVE_SQLITE_TRANSACTION` | رزرو اتمی ظرفیت در محدوده `portfolio_id` با جلوگیری از تداخل هم‌زمان و آزادسازی پس از انقضا |
| GET `/cases/:id` و POST `/cases/:id/actions` | تاریخچه پیوست‌فقط در SQLite | وضعیت پرونده، مصوبه تغییرناپذیر، ریسک تفکیک‌شده (`primaryChainRiskStatus` و `donorSideEffectRiskStatus`) و ثبت اقدام |
| POST `/cases/:id/verifications` | بازبینی مستقل وابسته به نسخه | تأیید مستقل عملیاتی/مالی/نتیجه؛ خودتأییدی (`403`) و نسخه کهنه (`409`) رد می‌شود |
| GET `/lessons` و POST `/cases/:id/lessons` | جدول ساختاریافته `total_demo_lessons` | بازیابی درس‌آموخته مبتنی بر نتیجه (`OUTCOME_BASED_LESSON`) و تفکیک آن از یادداشت بستن پس از رد (`DECLINED_CLOSURE_NOTE`) |

## قواعد حاکمیتی و مرزهای غیرقابل‌نقض

1. **مرز نقش نمایشی و هویت سازمانی**: همه نقش‌های این رابط در حالت `DEMO_SIMULATED_ROLE` اجرا می‌شوند. وضعیت احراز هویت سازمانی به صراحت `BLOCKED_INTERNAL_SOURCE_REQUIRED` است و هر درخواست در حالت `mode=enterprise` با کد `503` (`enterprise_authority_required`) مسدود می‌شود.
2. **استخراج ثبت‌کننده فقط از تاریخچه سرور (`SERVER_DERIVED_NEVER_TRUST_CLIENT`)**: ارسال فیلد `recorder` از سمت کلاینت به مسیرهای `/actions` و `/verifications` با خطای `400` (`client_recorder_forbidden`) رد می‌شود. سرور ثبت‌کننده واقعی را فقط از تاریخچه ذخیره‌شده پرونده در SQLite استخراج می‌کند و خودتأییدی را با `403` (`self_verification_forbidden`) مسدود می‌سازد.
3. **ساعت تحت کنترل سرور (`SERVER_CONTROLLED_SIMULATION_CLOCK`)**: ارسال `now` از کلاینت به `/reservations` یا `/cases/:id/reservations` با خطای `400` (`client_time_forbidden`) رد می‌شود. زمان مبنا از جدول `total_demo_clocks` به تفکیک `portfolio_id` خوانده می‌شود و بازگشت به عقب (`clock_cannot_rewind`) مجاز نیست.
4. **مرجع داده و نبود داده عملیاتی**: داده سناریو فقط از بانک SQLite خواندنی و داده فضای کار از SQLite قابل‌نوشتن عرضه می‌شود. نبود داده با `null` و وضعیت داده عملیاتی سازمان با `INTERNAL_SOURCE_REQUIRED` نمایش داده می‌شود. هیچ داده کسب‌وکار جدیدی در رابط یا از متن تولید نمی‌شود.
