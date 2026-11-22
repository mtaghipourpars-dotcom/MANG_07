# DATA_INTEGRITY_REPORT: Truth Governance & Anti-Fabrication Audit
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Authority Reference:** `AGENTS.md`, `docs/04_DATA/PARS_REAL_DATA_BOUNDARY.md`, `.agents/skills/pvpt-data-integrity/SKILL.md`

---

## 1. Truth Classification & Provenance Enforcement

Every data record in PVPT carries a strict `data_class` label. The five canonical classifications are:

1. `PUBLIC_VERIFIED`: Sourced strictly from the official MAPNA Pars Generator public catalogue (`https://mapnagenerator.com/Fa/Products`). Confirms product model existence, nominal active/apparent power ratings, and family definitions. Proves **NO** project commitments, backlog, costs, margins, or schedules.
2. `INTERNAL_VERIFIED`: Confirmed by an accountable named source owner from enterprise systems (SAP ERP, Primavera P6, MES, PLM) with an explicit `as_of` date. No internal source has yet been connected to the demo instance.
3. `USER_APPROVED_ASSUMPTION`: Explicitly reviewed and approved management assumptions for hypothetical sensitivity analysis. Must be distinctly labelled in UI.
4. `DEMO_SYNTHETIC`: All current operational project instances (`P-1405`, `P-1398`, `P-1412`, `P-1395`, `P-1401`), commitments, BOM Cells, production orders, and decision cases. They exist solely to test and demonstrate system capabilities and must **never** be presented as real PARS operational facts.
5. `UNKNOWN`: The mandatory representation when a fact, connection, status, or date is absent.

---

## 2. Prohibition of Default Zeroes and Synthetic Guesses

The core zero-trust rule states: **Missing is not zero.**
- If capacity or machine calendar is unrecorded: Marked as `UNKNOWN` or `DATA REQUIRED`; it is **not** assumed to be infinite or zero.
- If cash flow timing is missing: Marked as `INTERNAL SOURCE REQUIRED`; it is **not** assumed to be zero cash or unlimited liquidity.
- If financial exposure is uncalculated: Displays `NOT YET QUANTIFIED`.
- If an entity link is unverified: Preserved as `null` with `relationship_status: 'UNKNOWN'`.

### Audit of Form Handlers & Fallbacks:
- `submitForm` has been audited to eliminate automatic numeric defaults (`500`, `15`, `50`, `100`, `600`) and project ID defaulting (`P-1405`).
- Required inputs must be validated with explicit rejection if left blank.

---

## 3. Financial & Operational Concept Separation

The following concepts are maintained as strictly independent dimensions:

| Concept | Definition | Rule |
|---|---|---|
| **PLAN** | Initial contractual or baseline schedule and budget | Immutable once baseline snapshot is frozen |
| **FORECAST** | Current projected timeline and costs based on active shop-floor realities | Time-phased projection updated with new observations |
| **ACTUAL** | Evidenced historical reality (actual spend, actual completion) | Evidenced only by formal documentation; cannot be overwritten by scenarios |
| **ASSUMPTION** | Explicit working hypothesis used for scenario comparison | Tagged `USER_APPROVED_ASSUMPTION` |
| **VALUE AT RISK (VaR)** | Maximum financial, contractual, or operational exposure if no intervention occurs | Calculated from delayed milestones, liquid damages, and customer claims |
| **REALIZED LOSS** | Actual financial damage that occurred when an unmitigated risk materialized | Recorded only after post-mortem outcome review |
| **PROTECTED VALUE** | Value preserved by an authorized management intervention | **Never displayed as actual until verified by reviewed outcome evidence.** |

---

## 4. Specific Shop-Floor Truth Auditor Guardrails (MANG_03 / MANG_05)

### 4.1 Tripartite Shop-Floor Evidence
Paper progress claims and verbal reports are strictly rejected unless supported by tripartite shop-floor evidence:
1. **Warehouse Receipt / Material Issue Document** (proving physical stock movement).
2. **Machine Power Log** (proving actual spindle/work center operation).
3. **Overhead Crane Telemetry** (proving actual heavy component relocation across bays).

### 4.2 Monetary Translation of 5M Bottlenecks
All shop-floor bottlenecks are translated into executive monetary terms:
- **WIP Holding Cost:** Calculated at **36% annual cost of capital** (`WIP Cost = (Value * 0.36) / 12` per month).
- **Cost of Poor Quality (COPQ):** Rework labor, scrap materials, and penalty costs.
- **Holding Treasury Friction:** Days of lag between technical milestone sign-off and actual cash-pool disbursement.

### 4.3 Guardrail Cannibalization Policy
Inter-project material borrowing is strictly prohibited unless:
1. **Metallurgy Match:** 100% material grade and mill certificate match confirmed by Engineering.
2. **Donor LRM Safety Margin:** Replacement purchase order must be locked within the donor project's Last Responsible Moment (LRM) safety margin so the donor project is not penalized.

### 4.4 National Urgency Ledger
In national grid curtailment or ministerial override events, forced overtime and diesel generation costs are isolated into the **National Urgency Ledger** so plant operational efficiency indicators are not distorted.
