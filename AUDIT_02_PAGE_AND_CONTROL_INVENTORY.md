# AUDIT 02: Page & Control Inventory — PVPT (MANG_06)
**Date:** 2026-10-30  
**Audit Phase:** Stage 1 — Discovery & Page/Control Inventory (G0)  
**System Name:** PARS Value Protection Tower (PVPT / MANG_06)  

---

## 1. Topbar & Global Navigation Controls

| Control ID / Selector | Expected Function | Current Behavior | Data Source | Data Storage | Cross-Page Link | Operational Mode | Independent Test | Verifiability |
|---|---|---|---|---|---|---|---|---|
| `.brand[data-nav-page="home"]` | Return to CEO Home | Navigates to `#homePage` | Client state | None | `home` | Real client nav | Yes (`demo-smoke`) | Provable in DOM |
| `.user[data-nav-page="sources"]` | View roles & permissions | Navigates to `sources/access` | Client state | None | `sources` | Real client nav | Yes (`demo-smoke`) | Provable in DOM |
| `#liveNotifBadge` | Show active urgent alerts count | Displays count (3 + issues count) | `db.issues` + fixture | Client memory | `decisions/queue` | Real client nav | Yes (`demo-smoke`) | Provable in DOM |
| `.top-clock` | Open Decision Memory | Navigates to `memory/decisions` | System date | Client memory | `memory` | Real client nav | Yes (`demo-smoke`) | Provable in DOM |
| `.demo-pill` | View Data Readiness & Truth Boundary | Navigates to `sources/readiness` | Static label | None | `sources` | Real client nav | Yes (`demo-smoke`) | Provable in DOM |
| `#themeSelector` | Switch Theme (Light / Dark / Factory) | Toggles `data-theme` on `html` & `body` | `localStorage` | `localStorage('pvpt_theme')` | Global UI | Real client state | Yes (`test:demo`) | Provable in DOM attribute |
| `#langSelector` | Switch Language (Fa RTL / En LTR) | Toggles `lang` and `dir`, updates nav text | `localStorage` | `localStorage('pvpt_lang')` | Global UI | Real client state | Yes (`test:demo`) | Provable in DOM attribute |

---

## 2. CEO Home Page Controls (`#homePage`)

| Control ID / Selector | Expected Function | Current Behavior | Data Source | Data Storage | Cross-Page Link | Operational Mode | Independent Test | Verifiability |
|---|---|---|---|---|---|---|---|---|
| KPI Card 1 (`.kpi-var-highlight`) | Filter Risk Map by AT_RISK projects | Navigates to `risk/map` with filter | `ceoProjects` | `db.activeFilter` | `risk` | Filtered nav | Yes (`demo-smoke`) | Provable |
| KPI Card 2 (`.kpi-orange-tint`) | Filter commitments by customer risk | Navigates to `projects/commitments` | `ceoCommitments` | `db.activeFilter` | `projects` | Filtered nav | Yes (`demo-smoke`) | Provable |
| KPI Card 3 (`.kpi-amber-tint`) | View delayed cash stages | Navigates to `resources/cash` | `ceoCashStages` | `db.activeFilter` | `resources` | Filtered nav | Yes (`demo-smoke`) | Provable |
| KPI Card 4 (`.kpi-blue-tint`) | Open urgent decision cases | Navigates to `decisions/queue` | `scenarios` | None | `decisions` | Direct nav | Yes (`demo-smoke`) | Provable |
| KPI Card 5 (`.kpi-purple-tint`) | View urgent intervention windows (<5d) | Navigates to `interventions/windows` | `scenarios.part` | None | `interventions` | Direct nav | Yes (`demo-smoke`) | Provable |
| SVG Scatter Chart Circles | Click project circle to open project chain | Sets project filter & opens `projects/chain` | `ceoProjects` | `db.selectedProject` | `projects` | Filtered nav | Yes (`demo-smoke`) | Provable |
| 6 Product Cards (`.product[data-nav-page]`) | Filter portfolio catalogue by family | Navigates to `portfolio/catalog` by family | `catalog.families` | `db.activeFilter` | `portfolio` | Filtered nav | Yes (`demo-smoke`) | Provable |
| 4 Executive Macro Metrics | Open corresponding operational views | Navigates to `projects`, `risk`, `resources` | Client metrics | None | Specific views | Direct nav | Yes (`demo-smoke`) | Provable |
| Decision Cards (P-1405 / P-1398) | Open Decision Brief modal | Opens `#modal` with scenario details | `scenarios` | Modal state | None | Modal interaction | Yes (`demo-regression`) | Provable |
| Projects Table Rows | Click project row to open project chain | Navigates to `projects/projects` for project | `ceoProjects` | `db.selectedProject` | `projects` | Filtered nav | Yes (`demo-smoke`) | Provable |
| Timeline Events | Click event to open related operational view | Navigates to `risk/issues` or `resources` | `ceoIssues` | None | Specific views | Direct nav | Yes (`demo-smoke`) | Provable |
| Home Issues Table Actions | Propose solution for specific issue | Opens `solutions/register` prefilled with Issue ID | `ceoDetailedIssues` | Pre-filled form | `solutions` | Form prefill | Yes (`compile/lint`) | Provable |
| Home Solutions Table Actions | Approve solution directly as CEO | Sets status to `APPROVED` with timestamp | `ceoDetailedSolutions`| `localStorage` | `solutions` | Client mutation | Yes (`compile/lint`) | Provable |

---

## 3. Sidebar Navigation & Sub-views

### 3.1 `projects` (پروژه‌ها)
- `projects` table: Shows projects list with status, VaR, days to PNR.
- `commitments` table: Shows customer commitments, due dates, and truth boundaries.
- `milestones` table: Compares baseline plan vs forecast vs actuals with missing P6 connection notice.
- `chain` view: Vertical flow diagram tracking Project → Commitment → BOM Component → Production Order → Routing.
- `bom` view: Lists BOM components (Cells) and production order links.
- `routing` view: Operations sequence, work centers, standard hours.
- `orders` view: Production orders and PCNF/CNF/TECO status.
- Forms: Project creation, commitment registration, execution note logging.

### 3.2 `portfolio` (سبد محصولات)
- `families` view: Displays official 6 canonical families with badge for demo risks.
- `catalog` view: Interactive search by model name, family dropdown filter, and data class filter (`PUBLIC_VERIFIED`, `DEMO_SYNTHETIC`, `UNKNOWN`).
- `assignments` view: Product-to-project assignment junction table with strict truth boundary.

### 3.3 `risk` (نقشه ارزش و ریسک)
- `map` view: Detailed value & risk table with quadrant classification.
- `issues` view: Operational issues list with 5M bottleneck categories.
- `impact` view: Propagation flow from component failure to financial margin risk.
- `conflicts` view: Shared resource conflicts (e.g., test station deficit).
- `evidence` view: Quality & provenance checklist.

### 3.4 `interventions` (فرصت‌های مداخله)
- `windows` view: PNR windows and critical shortage countdowns.
- `compare` view: Side-by-side comparison of options with hard feasibility gates.
- `simulate` view: Time-phased constraint simulation testing lead time, budget, and capacity.

### 3.5 `resources` (منابع و ظرفیت)
- `overview`: 5M baseline resource table (Machine, Manpower, Material, Method, Money).
- `materials`: Critical components stock, reservations, and lead times.
- `machines`: Work centers and test station capacity.
- `labor`: Skilled labor and assembly teams.
- `capacity`: Time-bucketed demand vs capacity.
- `suppliers`: Supplier promise tracking.
- `cash`: Payment milestones at risk and intervention budget caps.

### 3.6 `issues` (مدیریت چالش‌ها)
- `overview`: Summary statistics (Open issues, total VaR, monthly WIP cost, COPQ).
- `active`: Critical issues table with 5M categorization, WIP cost, and PNR days.
- `bottlenecks`: 5M breakdown, annual cost of capital (36%), and Treasury lag.
- `register`: Form to submit new issue with tripartite evidence verification notes.

### 3.7 `solutions` (راهکارها و مصوبات)
- `overview`: Pipeline summary, approved count, and protected value metrics.
- `pipeline`: Candidate solutions waiting for CEO approval.
- `approved`: Approved solutions under execution.
- `impact`: Financial ROI ratio (Protected VaR vs implementation cost).
- `register`: Form to propose solution with Guardrail Cannibalization verification.

### 3.8 `memory` / `decisions` (دانش، تجربه و تصمیم‌ها)
- `decisions`: Management council decision records and audit history.
- `outcomes`: Observed outcome observations vs expected results.
- `lessons`: Human-approved organizational lessons.
- `indicators`: Macro operational trends.
- `trend`: Historical VaR trend.

### 3.9 `sources` (تنظیمات و منشأ داده)
- `readiness`: Data connection health across ERP, P6, MES, PLM.
- `provenance`: Truth class breakdown.
- `assumptions`: User-approved assumptions register.
- `registry`: System adapter registry.
- `access`: Role-based authority matrix.
- `config`: Model parameters, theme, and language controls.

---

## 4. Audit Findings for G0
1. All core views exist in code, but are distributed across 11 primary sidebar destinations instead of the unified 8-menu structure.
2. Form handlers currently write to `localStorage` or in-memory arrays; server-side REST API persistence endpoints need to be wired to `server.js` for true persistence.
3. Form validation in `submitForm` must be hardened to prevent synthetic fallback values (e.g. default 500, default 15) when required fields are missing.
4. CEO Approval flow must verify role and record real audit timestamps rather than hardcoded mock strings.
