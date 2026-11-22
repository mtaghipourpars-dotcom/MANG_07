# AUDIT 04: Requirements Conflicts & Reconciliation Log — PVPT (MANG_06)
**Date:** 2026-10-30  
**Audit Phase:** Stage 1 — Requirements Reconciliation (G0/G2)  
**System Name:** PARS Value Protection Tower (PVPT / MANG_06)  

---

## 1. Discovered Conflicts & Resolution Strategy

### Conflict 1: Number of Sidebar Navigation Menus
- **Source A (Early newmodel1 & current UI):** Contains 11 navigation buttons in the sidebar (`home`, `projects`, `decisions`, `risk`, `portfolio`, `issues`, `solutions`, `memory`, `interventions`, `resources`, `sources`).
- **Source B (MANG_06 Master Prompt & Architecture):** Mandates exactly 8 primary navigation areas:
  1. `HOME`
  2. `PROJECTS`
  3. `PRODUCTS`
  4. `VALUE MAP`
  5. `ISSUES`
  6. `SOLUTIONS`
  7. `KNOWLEDGE & LEARNING`
  8. `SETTINGS`
- **Reconciliation Decision:** Unify into exactly the 8 canonical menus. All existing subpages and capabilities from `decisions`, `interventions`, and `resources` are preserved and nested into their respective logical parents:
  - `interventions` and `resources` subviews become subviews of `VALUE MAP` (`risk`).
  - `decisions` becomes a subview of `KNOWLEDGE & LEARNING` (`memory`) and `HOME`.
  - `portfolio` is mapped to canonical `PRODUCTS`.
  - `sources` is mapped to canonical `SETTINGS`.
  - Existing automated tests expecting navigation to `portfolio` or `risk` will be updated to reflect the canonical 8-menu routes while preserving 100% test coverage.

---

### Conflict 2: Form Defaults vs Strict Validation
- **Current Behavior in `demo/app-engine.js`:**
  - `submitForm` for issue had default fallbacks: `v.var_billion || 500`, `v.wip_cost_million || 15`, `v.copq_million || 50`, `v.days_to_pnr || 15`, `v.project_id || 'P-1405'`.
  - `submitForm` for solution had default fallbacks: `v.cost_million || 100`, `v.protected_var_billion || 600`, `v.saved_wip_million || 20`.
- **MANG_06 Mandate (Section 7.1):**
  - "حذف مقادیر پیش‌فرض ساختگی: در `demo/app-engine.js` و به‌خصوص تابع `submitForm` بررسی کن که برای Issue و Solution مقادیر پیش‌فرض غیرمجاز وارد نشوند. اگر فیلد ضروری خالی است، ثبت را متوقف کن، فیلد ناقص را مشخص کن، پیام دقیق نمایش بده، هیچ مقدار جایگزینی تولید نکن."
- **Reconciliation Decision:** Strip all synthetic fallback numbers. Enforce client and server validation requiring exact user-entered figures. If any mandatory field is empty, abort submission and display a visible error notification.

---

### Conflict 3: Solution Approval Flow and Audit Trail
- **Current Behavior:**
  - Clicking `approve-solution` directly mutated the client array and set `s.approved_at = '۱۴۰۳/۰۹/۲۷'`.
- **MANG_06 Mandate (Section 7.2):**
  - "تصویب یا رد نباید صرفاً با کلیک روی یک دکمه و تغییر مقدار در مرورگر انجام شود. باید موارد زیر کنترل شوند: هویت کاربر، نقش و اختیار، وضعیت فعلی رکورد، شرایط لازم برای تصویب، ثبت دلیل، تاریخ و زمان واقعی، سابقه قبلی، نتیجه عملیات سمت سرور، Audit Trail. اگر احراز اختیار و تأیید سمت سرور وجود ندارد، عملیات تصویب واقعی را غیرفعال کن و وضعیت را به‌صورت شفاف NOT IMPLEMENTED یا DEMO ONLY نمایش بده."
- **Reconciliation Decision:**
  - Implement a formal Approval Modal requiring:
    1. Executive Approver Name & Role confirmation.
    2. Formal Approval / Rejection Rationale.
    3. Live ISO timestamp.
    4. Explicit `DEMO_SYNTHETIC` confirmation badge.
    5. Append record to immutable `audit_trail` and send POST to `/api/decisions`.

---

### Conflict 4: Inconsistent Issue Identifiers
- **Current Behavior:**
  - Some fixtures used `ISS-P1405-01` while detailed datasets used `ISS-1405-01`.
- **Reconciliation Decision:** Standardize canonical identifier format to `ISS-1405-01` and provide alias compatibility lookup so neither breaks existing references or automated test assertions.

---

### Conflict 5: Persistence Boundary
- **Current Behavior:**
  - Mutations are saved solely to browser `localStorage`.
- **MANG_06 Mandate (Section 8):**
  - "localStorage منبع حقیقت اطلاعات سازمانی نیست. PostgreSQL معماری هدف سامانه است. اگر پایگاه‌داده در محیط فعلی موجود نیست، وضعیت اتصال را مشخص کن، معماری و Schema را طراحی کن، API و Repository را پیاده‌سازی کن."
- **Reconciliation Decision:**
  - Add REST API endpoints to `server.js` (`/api/projects`, `/api/issues`, `/api/solutions`, `/api/decisions`, `/api/audit`).
  - Provide server-side in-memory repository with file persistence fallback (`data/persisted_db.json`) so state persists across server restarts and multiple browser contexts.
  - Transparently display database connection status (`PostgreSQL: Not Connected / LOCAL DEMO ACTIVE`).

---

## 2. Gate Status
- **G0 / G2 Discovery and Reconciliation:** Complete.
- **Proceeding to G3 (Consolidated Architecture & Plan)**.
