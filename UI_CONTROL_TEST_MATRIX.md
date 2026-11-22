# UI_CONTROL_TEST_MATRIX: Interactive Controls & Component Test Matrix
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Status:** Audited  

---

## 1. Topbar & Header Controls Matrix

| Control | Selector / ID | Test Scenarios | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|
| Brand Logo | `.brand[data-nav-page="home"]` | Click from any page | Returns to CEO Home (`#homePage`) | Returned to `#homePage` | **PASS** |
| User Profile | `.user[data-nav-page="sources"]` | Click user block | Navigates to `sources/access` | Navigates to Access subpage | **PASS** |
| Notification Bell | `.notif-bell` | Click notification bell | Navigates to `decisions/queue` | Navigates to Decision Queue | **PASS** |
| Live Clock | `.top-clock` | Click date/clock | Navigates to `memory/decisions` | Navigates to Decision Memory | **PASS** |
| Demo Pill | `.demo-pill` | Click demo mode tag | Navigates to `sources/readiness` | Navigates to Data Readiness | **PASS** |
| Theme Selector | `#themeSelector` | Select `light`, `dark`, `factory` | Body receives `data-theme` attribute | Themes applied instantly | **PASS** |
| Language Selector | `#langSelector` | Select `fa` (RTL) or `en` (LTR) | HTML receives `lang` and `dir` attributes | Direction & labels updated | **PASS** |

---

## 2. Primary Navigation Menus (8 Canonical Areas)

| Menu Area | Key | Subviews | Test Action | Expected Result | Status |
|---|---|---|---|---|---|
| **HOME** | `home` | `overview`, `priority` | Click sidebar `home` button | Displays CEO Cockpit with zero horizontal overflow | **PASS** |
| **PROJECTS** | `projects` | `projects`, `commitments`, `milestones`, `chain`, `bom`, `routing`, `orders` | Click sidebar `projects` + subnav tabs | Subnav switches views smoothly | **PASS** |
| **PRODUCTS** | `portfolio` | `families`, `catalog`, `assignments` | Click sidebar `portfolio` + subnav tabs | Renders 6 families & product catalogue search | **PASS** |
| **VALUE MAP** | `risk` | `map`, `impact`, `resources`, `capacity`, `conflicts`, `windows`, `compare`, `simulate` | Click sidebar `risk` + subnav tabs | Renders scatter chart, 5M resources, and simulation engine | **PASS** |
| **ISSUES** | `issues` | `overview`, `active`, `bottlenecks`, `register` | Click sidebar `issues` + subnav tabs | Renders 5M breakdowns and issue intake form | **PASS** |
| **SOLUTIONS** | `solutions` | `overview`, `pipeline`, `approved`, `impact`, `register` | Click sidebar `solutions` + subnav tabs | Renders approval pipeline and solution form | **PASS** |
| **KNOWLEDGE** | `memory` | `decisions`, `outcomes`, `lessons`, `indicators`, `trend` | Click sidebar `memory` + subnav tabs | Renders decision history and outcome log | **PASS** |
| **SETTINGS** | `sources` | `readiness`, `provenance`, `assumptions`, `registry`, `access`, `config` | Click sidebar `sources` + subnav tabs | Renders truth labels and configuration | **PASS** |

---

## 3. Interactive Forms & Validation Controls

| Form | Fields | Validation Rules | Empty Field Behavior | Valid Input Behavior | Status |
|---|---|---|---|---|---|
| **Issue Submission** | `title`, `project_id`, `type`, `severity`, `var_billion`, `wip_cost_million`, `copq_million`, `treasury_lag_days`, `days_to_pnr`, `description` | Mandatory fields: title, project, type, severity, VaR. Numeric fields must be $> 0$. | Aborts submission with error toast; no synthetic fallback | Appends issue to `db.issues`, prepends event, updates home count | **PASS** |
| **Solution Proposal** | `title`, `issue_id`, `project_id`, `strategy_type`, `feasibility`, `cost_million`, `exec_days`, `protected_var_billion`, `saved_wip_million`, `owner`, `note` | Mandatory fields: title, issue_id, cost, days, protected_var. | Aborts submission with error toast; no synthetic fallback | Appends candidate to `db.solutions`, notifies manager queue | **PASS** |
| **Option Simulation** | `scenario`, `window`, `budget`, `capacity` | Numeric bounds testing against scenario constraints | Evaluates feasibility in real time | Displays feasibility verdict (good/bad badge) | **PASS** |
| **Decision Register** | `scenario`, `option`, `owner`, `rationale` | Requires valid feasible option selection | Infeasible options cannot be recorded | Records human decision snapshot | **PASS** |
| **Outcome Logging** | `decision`, `title`, `actual`, `variance`, `verified_by` | Must link to decision or specify standalone | Aborts if title is empty | Logs outcome observation with provenance badge | **PASS** |

---

## 4. Modal Dialogs & Keypress Controls

| Component | Trigger | Interaction Tested | Expected Result | Status |
|---|---|---|---|---|
| `#modal` | Decision card click (`[data-detail="1"]`) | Click open, click evaluation buttons | Opens modal with scenario details and feasibility logic | **PASS** |
| `#modal` Close | Escape key press (`page.keyboard.press('Escape')`) | Press Escape | Modal immediately closes (`aria-hidden: true`) | **PASS** |
| `#modal` Backdrop | Click outside modal container | Click backdrop | Closes modal | **PASS** |

---

## 5. Responsive Viewport Audits

| Viewport Resolution | Device Profile | Horizontal Overflow Checked | Layout Integrity | Status |
|---|---|---|---|---|
| **1536 × 1024** | Mandatory Reference Baseline (`main.png`) | ScrollWidth == ClientWidth (0 overflow) | Side-by-side exact layout matching `main.png` | **PASS** |
| **1440 × 1000** | Desktop Chrome Baseline | ScrollWidth == ClientWidth (0 overflow) | Full 2-column grid, 5 KPI cards in 1 row | **PASS** |
| **1280 × 800** | Compact Laptop | ScrollWidth == ClientWidth (0 overflow) | Top KPI grid wraps to 3 columns; panels stack | **PASS** |
| **1024 × 768** | Tablet Landscape | ScrollWidth == ClientWidth (0 overflow) | Sidebar stays fixed; panels stack cleanly | **PASS** |
| **768 × 1024** | Tablet Portrait | ScrollWidth == ClientWidth (0 overflow) | Sidebar switches to top bar; single-column body | **PASS** |
| **390 × 844** | Mobile Device (iPhone 13) | ScrollWidth == ClientWidth (0 overflow) | Touch-friendly navigation, wrapped KPI cards | **PASS** |
