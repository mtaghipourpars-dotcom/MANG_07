# CROSS_PAGE_RELATIONSHIP_TESTS: Cross-Page Entity Relational Verification
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Status:** Audited & Verified  

---

## 1. Bidirectional Relational Test Matrix

| Source Entity | Target Entity | Relationship Type | Key Junction / Foreign Key | Bidirectional Navigation Test | Verification Status |
|---|---|---|---|---|---|
| `Product` | `Project` | Many-to-Many | `ProjectProductAssignment.assignment_id` | Clicking product card in `portfolio/catalog` filters `ceoProjects` for that family/model. | **PASS** |
| `Project` | `Commitment` | One-to-Many | `Commitment.project_id == Project.project_id` | Opening `projects/commitments` for `P-1405` displays `COM-P1405-DEL`. | **PASS** |
| `Project` | `BOM Component (Cell)` | One-to-Many | `BOMComponent.project_id == Project.project_id` | Opening `projects/bom` for `P-1405` displays `CELL-P1405-STATOR (C-117)`. | **PASS** |
| `Cell` | `ProductionOrder` | One-to-Many | `ProductionOrder.component_id` | Opening `projects/orders` displays `PO-P1405-01` linked to Stator cell. | **PASS** |
| `ProductionOrder` | `RoutingOperation` | One-to-Many | `RoutingOperation.production_order_id` | Opening `projects/routing` displays sequence operations `OP-P1405-30` and `OP-P1405-40`. | **PASS** |
| `RoutingOperation` | `Resource (Machine)` | Many-to-One | `RoutingOperation.machine_resource_id` | Maps operation to `MACH-WIND-01` and `MACH-TEST-01`. | **PASS** |
| `Project` | `Issue` | One-to-Many | `Issue.project_id == Project.project_id` | Opening `issues` filtered by `P-1405` shows `ISS-1405-01`. | **PASS** |
| `Issue` | `Commitment` | Many-to-Many | `Commitment.project_id == Issue.project_id` | Issue detail displays customer commitment `COM-P1405-DEL` with 5 days to PNR. | **PASS** |
| `Issue` | `SolutionCandidate` | Many-to-Many | `SolutionCandidate.issue_id == Issue.id` | Proposing solution from `issues` pre-fills `issue_id` and `project_id` in `solutions/register`. | **PASS** |
| `Solution` | `Issue` | Many-to-Many | `Solution.issue_id` | Solution pipeline and register tables link directly to `ISS-1405-01`. | **PASS** |
| `Solution` | `Feasibility` | One-to-One | `Solution.feasibility` | Feasibility engine evaluates hard gates before allowing CEO approval. | **PASS** |
| `Decision` | `Option` | One-to-One | `Decision.optionId == Option.id` | Decision record snapshots selected option parameters, cost, and time. | **PASS** |
| `Decision` | `Action` | One-to-Many | `ExecutionAction.decision_id` | Approved decision creates actionable tasks with assigned owner. | **PASS** |
| `Action` | `Floor Evidence` | One-to-Many | `ExecutionEvidence.action_id` | Requires tripartite floor proof (Warehouse doc, power log, crane telemetry). | **PASS** |
| `Action` | `Outcome` | One-to-One | `OutcomeObservation.action_id` | Compares expected vs observed physical/financial outcome. | **PASS** |
| `Outcome` | `Protected Value` | Derived | Evidenced realization | Protected VaR is recognized only when observed outcome proves non-delayed delivery. | **PASS** |
| `Outcome` | `Learning` | One-to-Many | `LessonLearned.outcome_id` | Feeds post-mortem lesson proposals to Management Council. | **PASS** |

---

## 2. Navigational Consistency Test
- **State Preservation:** When navigating from CEO Home to an operational view via a KPI card or table row, `db.activeFilter` is populated and an active filter banner renders across all subpages.
- **Return Action:** The "بازگشت به صفحه اصلی" button clears active filters and returns to `#homePage` cleanly without uncaught browser errors.
- **Refresh Resilience:** Local filter state and decision entries persist in `localStorage` across page reloads.
