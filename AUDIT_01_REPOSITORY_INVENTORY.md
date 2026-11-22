# AUDIT 01: Repository Inventory — PVPT (MANG_06)
**Date:** 2026-10-30  
**Audit Phase:** Stage 1 — Discovery & Repository Inventory (G0)  
**System Name:** PARS Value Protection Tower (PVPT / MANG_06)  
**Authority Reference:** `AGENTS.md`, `MASTER_PROTOCOL.md`, `IMPLEMENTATION_SEQUENCE.md`, `docs/06_AI_STUDIO/`

---

## 1. File Tree & Code Inventory

### 1.1 Root Configuration & Infrastructure
- `/package.json`: NPM package definition. Scripts: `dev`, `start`, `build`, `lint`, `test`, `test:demo`, `validate:skills`. Runtime dependency: `express` (^5.3.0). Dev dependency: `@playwright/test` (^1.55.0).
- `/server.js`: Express static asset server on port 3000 (0.0.0.0). Serves `/demo`, `/data`, `/docs`, and `/`. Provides `/api/health`.
- `/playwright.config.js`: Playwright E2E configuration for `chromium-desktop` (1440x1000) and `chromium-mobile` (iPhone 13). Runs local web server (`python3 -m http.server 4173`).
- `/metadata.json`: AI Studio applet metadata.
- `/AGENTS.md`: Mandatory instructions for coding agents.
- `/README.md`: Project summary.
- `/bun.lock`: Lockfile.
- `/.env.example`: Environment template (`PORT=3000`, `DATABASE_URL=`).
- `/.github/workflows/pvpt-demo-smoke.yml`: GitHub Actions CI workflow running `validate-agent-skills.mjs` and Playwright tests.

### 1.2 Scripts
- `/scripts/validate-agent-skills.mjs`: Node.js script enforcing YAML frontmatter, naming, and references across all 5 Agent Skills.

### 1.3 Agent Skills (`/.agents/skills/`)
1. `pvpt-build-orchestrator`: Discovery, gated prompts, checkpoint recovery, ledger updates.
   - Ref: `references/phase-checklist.md`
2. `pvpt-data-integrity`: Truth classes (`PUBLIC_VERIFIED`, `INTERNAL_VERIFIED`, `USER_APPROVED_ASSUMPTION`, `DEMO_SYNTHETIC`, `UNKNOWN`), synthetic data isolation, absence of zero-defaults.
   - Ref: `references/provenance-contract.md`
3. `pvpt-domain-engine`: Hard feasibility gate sequence (dependency, material, machine, manpower, method, cash, shared conflicts), no-feasible escalation.
   - Ref: `references/feasibility-contract.md`
4. `pvpt-quality-gates`: Verification checklist before completing gates.
5. `pvpt-reference-ui`: Pixel-fidelity audit against `demo/main.png`, Persian RTL, and responsive viewports.
   - Ref: `references/visual-audit.md`

### 1.4 Application Runtime & Assets (`/demo/`)
- `/demo/index.html`: Main HTML entry point containing Topbar (theme/lang controls, clock, notifications, user profile), Sidebar, Workspace, CEO Home Page (`#homePage`), Entity Workbench (`#entityPage`), Modal dialog (`#modal`), and Decision Brief Overlay.
- `/demo/app-engine.js`: Core client application script. Handles routing, data initialization, event delegation, forms, simulation, and rendering for all operational domains.
- `/demo/app-engine.css`: Base stylesheet for interactive workbench components, tables, buttons, metrics, and flows.
- `/demo/ui-redesign.css`: Redesign layout rules and responsive styling.
- `/demo/main.png`: The mandatory 1536x1024 visual reference for the CEO Dashboard.
- `/demo/assets/`:
  - `thermal.png`, `hydro.png`, `wind.png`, `industrial.png`, `motors.png`, `busduct.png`
  - `prod-thermal.png`, `prod-hydro.png`, `prod-wind.png`, `prod-industrial.png`, `prod-motors.png`, `prod-busduct.png`
  - `portfolio_section.rgba`, `test_portfolio.rgba`

### 1.5 Data Contracts & Fixtures (`/data/`, `/docs/04_DATA/`)
- `/data/product-project-fixture.json`: Sourced product catalogue (6 canonical families, verified models) and synthetic demo assignments/commitments/orders.
- `/docs/04_DATA/mvp_master_data_seed.json`: Master schema and seed definition.
- `/docs/04_DATA/PARS_PRODUCT_PORTFOLIO_BASELINE.md`: Sourced public baseline from `https://mapnagenerator.com/Fa/Products`.
- `/docs/04_DATA/PARS_REAL_DATA_BOUNDARY.md`: Truth boundary documentation prohibiting fabrication of unverified project actuals.
- `/docs/04_DATA/PRODUCT_PROJECT_OBJECT_MODEL.md`: PPOM contract defining relationships between product families, products, assignments, and projects.
- `/docs/04_DATA/PVPT_CANONICAL_DATA_MODEL_V0.1.md`: Canonical database entities, constraints, and data provenance requirements.

### 1.6 Architectural & Governance Documentation (`/docs/`)
- `01_PRODUCT/`: `PVPT_PRODUCT_MODEL.md`, `DEMO_EXPERIENCE_BLUEPRINT.md`
- `02_DEMO/`: `EXECUTIVE_WALKTHROUGH_AND_QA.md`
- `02_UI/`: `CEO_HOME_PAGE.md`, `PVPT_SIDEBAR_AND_PAGE_CONTRACT.md`, `SIDEBAR_AND_PRODUCT_ENGINES.md`, `INTERACTIVE_DOMAIN_IMPLEMENTATION.md`
- `03_ARCHITECTURE/`: `PVPT_MVP_ARCHITECTURE.md`
- `05_FLOW/`: `PVPT_VALUE_CHAIN.svg`
- `06_AI_STUDIO/`: `README.md`, `MASTER_PROTOCOL.md`, `IMPLEMENTATION_SEQUENCE.md`, `ACCEPTANCE_GATES.md`, `WORK_PACKAGES.md`, `IMPLEMENTATION_LEDGER.md`, `PROMPT_PACK.md`, `SCREEN_REFERENCE_CONTRACT.md`, `SECURITY_AND_DEPLOYMENT.md`, `SOURCE_INDEX_AND_HISTORY.md`, `DECISION_LOG.md`

### 1.7 Test Suite (`/tests/`)
- `tests/product-project-model.spec.js`: Referential integrity, canonical 6 families, orphan prevention, and provenance tests (10 test cases across desktop & mobile).
- `tests/demo-smoke.spec.js`: Smoke tests for CEO home truth separation, 6-family portfolio, project tracking, DEMO-01/DEMO-02 calculation, and localStorage persistence.
- `tests/demo-regression.spec.js`: Navigation error-freedom, infeasible option rejection, capacity check, and modal Escape key closing.
- `tests/visual-smoke.spec.js`: Viewport overflow audits for desktop (1440x1000) and mobile (iPhone 13).

---

## 2. Inventory of Current Pages & Navigation Paths

### Current Navigation Structure (11 Items in Sidebar):
1. `home`: صفحه اصلی (CEO Cockpit)
2. `projects`: پروژه، تعهد و تولید (Subviews: `projects`, `commitments`, `milestones`, `chain`, `bom`, `routing`, `orders`)
3. `decisions`: فرصت‌های تصمیم (Subviews: `queue`, `cases`, `council`, `register`)
4. `risk`: نقشه ارزش و ریسک (Subviews: `map`, `issues`, `impact`, `conflicts`, `evidence`)
5. `portfolio`: سبد محصولات (Subviews: `families`, `catalog`, `assignments`)
6. `issues`: مدیریت چالش‌ها (Issues) (Subviews: `overview`, `active`, `bottlenecks`, `register`)
7. `solutions`: راهکارها و مصوبات (Solutions) (Subviews: `overview`, `pipeline`, `approved`, `impact`, `register`)
8. `memory`: دانش و تجربه (Subviews: `decisions`, `outcomes`, `lessons`, `indicators`, `trend`)
9. `interventions`: فرصت‌های مداخله (Subviews: `windows`, `compare`, `simulate`)
10. `resources`: منابع و ظرفیت‌ها (Subviews: `overview`, `materials`, `machines`, `labor`, `capacity`, `suppliers`, `cash`)
11. `sources`: منشأ و آمادگی داده (Subviews: `readiness`, `provenance`, `assumptions`, `registry`, `access`, `config`)

### Target 8-Area Navigation Structure Mandated by MANG_06:
1. **HOME**: Executive Cockpit, Macro Indicators, Top Priority Decisions, Urgent Interventions, Active Issues/Solutions Summary.
2. **PROJECTS**: Projects, Commitments, Milestones, Traceability Chain, BOM / Cell, Routing / Operations, Production Orders.
3. **PRODUCTS**: Canonical 6 Families, Product Catalog, Specifications, Product-Project Assignments.
4. **VALUE MAP**: Value & Risk Map, Impact Chains, Resources (Materials, Machines, Labor, Cash), Capacity & Load, Shared Resource Conflicts, Intervention Windows, Option Comparison, and Simulation.
5. **ISSUES**: Issue Intake & Qualification Gate (Ready, Info Needed, Duplicate, Out of Scope), 5M Bottleneck Classification, WIP Holding Cost, COPQ, Treasury Lag, and Evidence.
6. **SOLUTIONS**: Solution Catalog & Intake, Candidate Proposals, Multi-Constraint Feasibility, Guardrail Cannibalization (Metallurgy & LRM), and CEO Approval Flow.
7. **KNOWLEDGE & LEARNING**: Decision Memory, Observed Outcomes, Lessons Learned, Executive Trends, and Decision Council History.
8. **SETTINGS**: Data Readiness, Provenance Registry, Source Catalog, Roles & Permissions, Model Configuration, Language (Fa/En), and Theme (Light/Dark/Factory).

---

## 3. Inventory of Modals & Dialogs
- `#modal`: General application modal for detailed views (Decision Briefs, Product Details, Issue Details, Assumptions, Outcomes).
- `#decisionBriefOverlay`: Specialized Decision Brief evaluation overlay for DEMO-01 (Part Shortage) and DEMO-02 (Test Station Capacity Conflict).

---

## 4. Inventory of Form Handlers (`submitForm(f)`)
- `type='issue'`: Registers an issue with 5M classification, VaR, WIP cost, COPQ, and PNR days.
- `type='solution'`: Registers a solution with cost, execution days, protected VaR, and feasibility.
- `type='resource'`: Creates a resource record (Material, Machine, Labor, Method, Cash).
- `type='decision'`: Records a management decision for a scenario option.
- `type='outcome'`: Records an observed actual outcome and variance.
- `type='lesson'`: Records an organizational lesson learned.
- `type='assumption'`: Registers a user-approved assumption.
- `type='source'`: Adds a data source into the registry.
- `type='project'`: Creates a synthetic demo project.
- `type='commitment'`: Creates a customer commitment.
- `type='execution'`: Logs production execution notes.
- `type='supplier'`: Logs supplier promise updates.
- `type='simulation'`: Runs client-side time-phased constraint simulation.

---

## 5. Summary of Findings
- **Discovery Status:** COMPLETED (G0).
- **Execution Readiness:** Proceeding to Control Inventory (`AUDIT_02_PAGE_AND_CONTROL_INVENTORY.md`), Architecture Assessment (`AUDIT_03_CURRENT_ARCHITECTURE.md`), and Contract Reconciliations (`AUDIT_04_REQUIREMENTS_CONFLICTS.md`).
