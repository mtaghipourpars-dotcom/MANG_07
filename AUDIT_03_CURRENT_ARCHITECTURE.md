# AUDIT 03: Current Architecture & Gap Analysis — PVPT (MANG_06)
**Date:** 2026-10-30  
**Audit Phase:** Stage 2 — Architecture Inspection & Gap Analysis (G0/G3)  
**System Name:** PARS Value Protection Tower (PVPT / MANG_06)  

---

## 1. Current Architecture Evaluation

### 1.1 Data Model Uniformity & Duplication
- **Observation:** The application currently maintains state across several data stores:
  1. `data/product-project-fixture.json`: Static JSON loaded via `fetch('../data/product-project-fixture.json')`.
  2. In-memory seed arrays: `seedProducts`, `seedFamilies`, `ceoProjects`, `ceoCommitments`, `ceoCashStages`, `ceoIssues`, `ceoDetailedIssues`, `ceoDetailedSolutions`, `scenarios`.
  3. Runtime `catalog` object: Concatenates seed data with loaded fixture items.
  4. LocalStorage `db` object (`KEY = 'pvpt-interactive-workspace-v1'`): Persists user mutations (decisions, custom issues, custom solutions, outcomes, lessons, resources).
- **Issue Identified:** While `catalog.projects` and `ceoProjects` share identifiers (`P-1405`, `P-1398`, etc.), some early synthetic fixtures used legacy identifiers (`PRJ-DEMO-101`, `PRJ-DEMO-102`), and some issue records had alternating formats (`ISS-P1405-01` vs `ISS-1405-01`).
- **Correction Required:** Standardize canonical entity identifiers across all tables (`P-1405`, `ISS-1405-01`, `SOL-1405-A`, `COM-1405-DEL`, `CELL-1405-STATOR`, `PO-1405-01`, `OP-1405-30`).

### 1.2 Cross-Page Traceability & Reactivity
- **Observation:** When a user navigates from the CEO Home dashboard (e.g., clicking on a project or an issue), `navigateFromHome` sets `db.activeFilter` and renders an active filter banner on the destination page with a button to return to the CEO Home.
- **Traceability Chain:**
  `Product (PUB-THERMAL-MGG72-SH2) → Project (P-1405) → Component/Cell (CELL-1405-STATOR) → Production Order (PO-1405-01) → Issue (ISS-1405-01) → Solution Candidate (SOL-1405-A) → Decision → Execution Action → Outcome Observation`
- **Correction Required:** Ensure bidirectional navigation. Viewing an Issue must show all affected Projects and proposed Solutions; viewing a Solution must show all addressed Issues and affected Commitments.

### 1.3 Business Logic Separation
- **Observation:** Currently, constraint evaluation and hard-gate feasibility logic live partly inside event listeners in `demo/app-engine.js`.
- **Target Architecture:** Deterministic business logic must be isolated into pure functions:
  1. `evaluateHardGates(option, context)`
  2. `calculateWipHoldingCost(varBillion, annualRate)`
  3. `validateNonCannibalization(materialBorrowProposal)`
  4. `verifyTripartiteFloorEvidence(warehouseDoc, powerLog, craneTelemetry)`

### 1.4 Persistence & Database
- **Observation:** Currently, state mutations rely on browser `localStorage`.
- **Target Architecture:**
  - Node.js server (`server.js`) must expose REST endpoints (`/api/projects`, `/api/issues`, `/api/solutions`, `/api/decisions`, `/api/outcomes`) with in-memory or SQLite/PostgreSQL backing so mutations survive cross-browser tests and reboots.
  - Client state synchronizes with server endpoints, while maintaining clear `DEMO_SYNTHETIC` vs `INTERNAL_VERIFIED` labels.

---

## 2. Target 8-Menu Information Architecture

| Menu Number | Canonical Area | Included Modules & Views |
|---|---|---|
| **1** | **HOME** (صفحه اصلی) | Executive Cockpit, Macro Indicators, Top Priority Decisions, Urgent Interventions, Active Issues/Solutions Summary |
| **2** | **PROJECTS** (پروژه‌ها) | Projects, Customer Commitments, Milestones, Traceability Chain, BOM / Cell, Routing / Operations, Production Orders |
| **3** | **PRODUCTS** (سبد محصولات) | 6 Canonical Families, Sourced Product Catalog, Specifications, Product-Project Assignments |
| **4** | **VALUE MAP** (نقشه ریسک و ارزش) | Value & Risk Map, Impact Chains, Resources (Materials, Machines, Labor, Cash), Capacity & Load, Shared Resource Conflicts, Intervention Windows, Option Comparison, Simulation |
| **5** | **ISSUES** (مدیریت چالش‌ها) | Issue Intake, Qualification Gate (Ready, Info Needed, Duplicate, Out of Scope), 5M Bottlenecks, WIP Holding Cost, COPQ, Treasury Lag, Floor Evidence |
| **6** | **SOLUTIONS** (راهکارها و مصوبات) | Solution Catalog & Intake, Solution Candidates, Multi-Constraint Feasibility, Guardrail Cannibalization (Metallurgy & LRM), CEO Decision & Approval Flow |
| **7** | **KNOWLEDGE & LEARNING** (دانش و تجربه) | Decision Memory, Council Records, Observed Outcomes, Lessons Learned, Macro Indicators & VaR Trend |
| **8** | **SETTINGS** (تنظیمات و منشأ داده) | Data Readiness, Provenance Registry, Source Catalog, Assumptions, Roles & Permissions, Model Configuration, Language & Theme |

---

## 3. Immediate Architectural Directives
1. Restructure the sidebar in `demo/index.html` and `demo/app-engine.js` into exactly the 8 canonical menus.
2. Nest existing subviews cleanly under the appropriate parent menus (e.g. `interventions` and `resources` nested under `VALUE MAP`).
3. Add server API routes in `server.js` for persistent storage of issues, solutions, decisions, and audit events.
4. Remove all hardcoded default fallbacks in form submission to enforce strict data validation.
