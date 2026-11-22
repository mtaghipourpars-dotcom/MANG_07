# ARCHITECTURE_FINAL: Unified Enterprise Value Protection & Decision Management System
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Status:** Approved Target Architecture Specification  

---

## 1. Operating Chain & Information Architecture

The unified system implements a single, unbroken enterprise operating chain:

```
PRODUCT PORTFOLIO (6 Canonical Families)
  └── PRODUCT (Catalogued Model / Variant)
        └── PROJECT (Commitment-Bearing Execution Instance)
              └── PROJECT STATUS & MILESTONES (Plan vs Forecast vs Actual)
                    └── RISK / DEVIATION (5M Floor Bottlenecks)
                          └── ISSUE INTAKE & QUALIFICATION (Ready / Info Needed / Duplicate / Out of Scope)
                                └── IMPACTED COMMITMENTS (Delivery & Milestone Cash Inflows)
                                      └── VALUE AT RISK (VaR + WIP Cost @ 36% + COPQ + Treasury Lag)
                                            └── SOLUTION CANDIDATES (Multi-Constraint Alternatives)
                                                  └── FEASIBILITY SEQUENCE (Hard Gates: Dependency → Material → Machine → Labor → Method → Cash → Shared Conflicts)
                                                        └── DECISION PRIORITY (Human Management Authority)
                                                              └── HUMAN DECISION RECORD (Immutable Snapshot & Audit Trail)
                                                                    └── EXECUTION ACTION (Assigned Owner & Due Date)
                                                                          └── PROGRESS EVIDENCE (Tripartite Floor Evidence: Warehouse + Power Log + Crane Telemetry)
                                                                                └── VERIFIED OUTCOME (Observed Variance Review)
                                                                                      └── PROTECTED VALUE (Evidenced Realization)
                                                                                            └── ORGANIZATIONAL LEARNING (Reviewed & Human-Approved Lessons)
```

---

## 2. Primary Navigation Architecture (Exactly 8 Areas)

### Area 1: HOME (صفحه اصلی)
- **Scope:** Executive decision cockpit for CEO.
- **Components:**
  - Macro Executive Indicators (Delivery, Margin, Key Capacity, Liquidity).
  - 5 Top Executive KPI Cards (VaR, Customer Commitments, Cash Delay, Decisions Required, Urgent Windows).
  - Project Value & Risk Map (Interactive Scatter Quadrants).
  - Product Portfolio Summary (6 Canonical Families with Active Risk Badges).
  - Urgent Intervention Windows (< 5 days to Point of No Return).
  - Critical Decision Briefs (P-1405 Part Shortage, P-1398 Test Station Capacity Conflict).
  - Projects Requiring Attention Table.
  - Latest Material Developments Timeline.
  - Active Critical Issues Panel & Approved Solutions Summary Panel.

### Area 2: PROJECTS (پروژه‌ها)
- **Scope:** Discrete manufacturing commitments and shop-floor execution tracking.
- **Subviews:**
  - `projects`: Project roster with progress, status, VaR, and PNR countdown.
  - `commitments`: Customer contractual delivery commitments and milestone dates.
  - `milestones`: Baseline Plan vs Current Forecast vs Actuals (Primavera P6 truth boundary).
  - `chain`: End-to-end visual traceability chain from project to cell to operation.
  - `bom`: Bill of Materials components (Cells).
  - `routing`: Work centers, operations sequence, and standard hours.
  - `orders`: Production orders and execution confirmations (PCNF/CNF/TECO).

### Area 3: PRODUCTS (سبد محصولات)
- **Scope:** Official product catalog baseline and project allocations.
- **Subviews:**
  - `families`: Exactly six canonical families:
    1. `THERMAL_GENERATORS` (ژنراتورهای حرارتی)
    2. `HYDRO_GENERATORS` (ژنراتورهای برق‌آبی)
    3. `WIND_TURBINES` (توربین‌های بادی)
    4. `INDUSTRIAL_GENERATORS` (ژنراتورهای صنعتی)
    5. `MOTORS` (موتورها)
    6. `BUSDuct` (باس‌داکت)
  - `catalog`: Sourced product models, active/apparent power specifications, and official source links.
  - `assignments`: Governed Project-Product Assignment records with source owner provenance.

### Area 4: VALUE MAP (نقشه ریسک و ارزش)
- **Scope:** Impact propagation, constrained key resources, intervention opportunities, and simulation.
- **Subviews:**
  - `map`: Detailed value & risk scatter matrix with filterable quadrants.
  - `impact`: Impact propagation chain from root causes to commitments and cash.
  - `resources`: Key resource allocations across 5M (Material, Machine, Manpower, Method, Money).
  - `capacity`: Time-phased capacity vs demand loading and deficit detection.
  - `conflicts`: Shared resource conflicts between competing projects.
  - `windows`: Last Responsible Moment (LRM) intervention countdowns.
  - `compare`: Option comparison engine evaluating hard feasibility gates.
  - `simulate`: Interactive parameter simulation testing lead times, budgets, and extra capacity.

### Area 5: ISSUES (مدیریت چالش‌ها)
- **Scope:** Governed Issue lifecycle from intake to impact assessment.
- **Subviews:**
  - `intake`: Issue submission with qualification gate (`READY`, `INFORMATION NEEDED`, `DUPLICATE`, `OUT OF SCOPE`, `NOT SURE / OTHER`).
  - `register`: Formal qualified issues register with linked projects and commitments.
  - `bottlenecks`: 5M classification, WIP holding cost (36% annual cost of capital), COPQ, and Treasury lag.
  - `evidence`: Tripartite shop-floor evidence records (Warehouse receipt, machine power log, crane telemetry).

### Area 6: SOLUTIONS (راهکارها و مصوبات)
- **Scope:** Solution candidates, constraint evaluation, cannibalization guardrails, and CEO approval.
- **Subviews:**
  - `candidates`: Case-specific solution proposals addressing qualified issues.
  - `pipeline`: CEO Solution Approval Pipeline with formal justification, role verification, and audit logging.
  - `approved`: Active approved solutions under execution with assigned owners and deadlines.
  - `guardrails`: Guardrail Cannibalization rules (100% metallurgy match verification and donor LRM safety margin).
  - `impact`: Financial ROI ratio (Protected VaR vs implementation cost).

### Area 7: KNOWLEDGE & LEARNING (دانش و تجربه)
- **Scope:** Organizational memory, outcome verification, and lessons learned.
- **Subviews:**
  - `decisions`: Executive decision memory and Council history with immutable snapshots.
  - `outcomes`: Observed outcome observations vs baseline expectations.
  - `lessons`: Human-reviewed lessons learned preventing future recurrence.
  - `trends`: Historical Value at Risk trends and management indicators.

### Area 8: SETTINGS (تنظیمات و منشأ داده)
- **Scope:** Data governance, truth boundaries, roles, theme, and language.
- **Subviews:**
  - `readiness`: Source system connection status (SAP ERP, Primavera P6, MES, PLM).
  - `provenance`: Five canonical truth labels (`PUBLIC_VERIFIED`, `INTERNAL_VERIFIED`, `USER_APPROVED_ASSUMPTION`, `DEMO_SYNTHETIC`, `UNKNOWN`).
  - `access`: Role-Based Access Control matrix (Submitter, Manager, CEO).
  - `theme`: 3-Theme Switcher (Light Executive, Dark Night Mode, High-Contrast Factory Amber).
  - `language`: Dual-Language Switcher (Persian RTL / English LTR).

---

## 3. Server-Side Persistence & API Contract

Express backend (`server.js`) exposes RESTful endpoints:
- `GET /api/health`: Health status and connection readiness.
- `GET /api/projects`: Returns active projects and commitments.
- `GET /api/issues`: Returns qualified issues list.
- `POST /api/issues`: Registers new qualified issue (with server-side validation).
- `GET /api/solutions`: Returns solution candidates and approved solutions.
- `POST /api/solutions`: Submits new solution proposal.
- `POST /api/solutions/:id/approve`: CEO decision approval endpoint recording timestamp, reviewer role, and audit trail.
- `GET /api/decisions`: Returns decision history and audit trail.
- `POST /api/outcomes`: Records observed actual outcomes.

All authoritative mutations are persisted server-side in `data/persisted_db.json` when PostgreSQL is not attached, ensuring persistence survives browser context restarts.
