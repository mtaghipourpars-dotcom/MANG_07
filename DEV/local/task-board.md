# Task board اجرای محلی

مبنای بررسی `a7b6a8a` است. دامنه، دموی PVPT با داده‌های آموزشی موجود در مخزن است. تعامل این اجزا طبق [قرارداد ماشینی](contracts.json) و [نقشه معماری](architecture.md) بررسی می‌شود.

| کار | مالک | وابستگی | تحویل و شاهد |
|---|---|---|---|
| تثبیت معماری و ADRها | A1 | مبنای منتشرشده | architecture.md، baseline-files.txt |
| تثبیت قرارداد | A1 و A6 | G0 | contracts.json، DEV/api-contract.json، scripts/validate-local-contract.mjs |
| تحلیل ریسک و شاهد اهداکننده | A2 | G1 | server/residual-risk.js، unit/، analytics.md |
| گردش پرونده و درس‌آموخته | A3 | G1، قرارداد تحلیل A2 | server/total-demo.js، server/workspace-db.js |
| فرم و نمایش درس در چهار فضای کار | A4 | قرارداد API | demo/total-system/app.js |
| آزمون مرحله‌ای و پذیرش محلی | A5 | آماده شدن هر جزء | tests/، DEV/local/qa/ |
| یکپارچه‌سازی و نسخه قابل اجرا | A6 | شواهد A1 تا A5 | scripts/localhost.mjs، README.md، handoffs.jsonl |

برای بازبینی هر مرحله، رکورد JSON در handoffs.jsonl شامل فرستنده، گیرنده، نوع، اثر، وضعیت، شاهد، مانع و اقدام بعدی است. شواهد آزمون عددی در qa ذخیره می‌شوند. پذیرش انسانی و اتصال منابع داخلی در گزارش محلی فقط با شواهد همان محیط قابل تأیید هستند.
