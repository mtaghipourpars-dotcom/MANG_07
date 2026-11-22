# DATA_MODEL_AUDIT: Canonical Data Model & Schema Audit
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Authority Reference:** `docs/04_DATA/PVPT_CANONICAL_DATA_MODEL_V0.1.md`, `PRODUCT_PROJECT_OBJECT_MODEL.md`

---

## 1. Canonical Entities & Schema Specifications

### 1.1 Enterprise Context Domain

#### `ProductFamily`
- `family_id` (PK, string, enum): One of the 6 canonical values:
  - `THERMAL_GENERATORS`
  - `HYDRO_GENERATORS`
  - `WIND_TURBINES`
  - `INDUSTRIAL_GENERATORS`
  - `MOTORS`
  - `BUSDuct`
- `label_fa` (string, required): Persian display name.
- `display_order` (integer, 1..6): Fixed presentation order.
- `data_class` (enum): `PUBLIC_VERIFIED`.

#### `Product`
- `product_id` (PK, string): Stable product model code (e.g., `PUB-THERMAL-MGG72-SH2`).
- `family_id` (FK -> `ProductFamily.family_id`, required).
- `name` / `model_code` (string, required): e.g., `MGG72-SH2`.
- `active_power_mw` (float, nullable): Sourced technical spec (e.g., 376 MW).
- `apparent_power_mva` (float, nullable).
- `source_reference` (string, required): e.g., `https://mapnagenerator.com/Fa/Products`.
- `data_class` (enum): `PUBLIC_VERIFIED`.

#### `Project`
- `project_id` (PK, string): Authoritative internal identifier (e.g., `P-1405`, `P-1398`).
- `project_name` (string, required).
- `family_id` (FK -> `ProductFamily.family_id`, required).
- `product_id` (FK -> `Product.product_id`, required).
- `progress` (float, 0..100, nullable).
- `status_code` (enum): `CRITICAL` | `HIGH_RISK` | `ATTENTION` | `HEALTHY`.
- `var_billion` (float, nullable): Value at Risk in billion IRR / Tomans.
- `days_to_pnr` (integer, nullable): Days to Point of No Return.
- `customer_at_risk` (boolean, required).
- `cash_delay_billion` (float, nullable).
- `data_class` (enum): `INTERNAL_VERIFIED` (when confirmed by owner) or `DEMO_SYNTHETIC`.

#### `ProjectProductAssignment`
- `assignment_id` (PK, string): e.g., `ASN-CEO-1`.
- `project_id` (FK -> `Project.project_id`, required).
- `product_id` (FK -> `Product.product_id`, required).
- `relationship_status` (enum): `CONFIRMED` | `PLANNED` | `UNKNOWN`.
- `source_owner` (string, required).
- `as_of` (date, required).
- `data_class` (enum).

#### `Commitment`
- `commitment_id` (PK, string): e.g., `COM-1405-DEL`.
- `project_id` (FK -> `Project.project_id`, required).
- `type` (enum): `CUSTOMER_DELIVERY` | `MILESTONE_PAYMENT` | `SERVICE_OVERHAUL`.
- `commitment_type` (string, required): Description of customer obligation.
- `due_date` (string/date, required).
- `var_billion` (float, required).
- `status_code` (enum): `CUSTOMER_AT_RISK` | `AT_RISK` | `ATTENTION` | `ON_TRACK`.
- `data_class` (enum).

---

### 1.2 Shop-Floor & Execution Domain

#### `BOMComponent` (Cell)
- `component_id` (PK, string): e.g., `CELL-1405-STATOR`.
- `project_id` (FK -> `Project.project_id`, required).
- `product_id` (FK -> `Product.product_id`, required).
- `production_order_id` (string, nullable).
- `critical_part_code` (string, nullable): e.g., `C-117`.
- `data_class` (enum): `DEMO_SYNTHETIC` | `INTERNAL_VERIFIED`.

#### `ProductionOrder`
- `production_order_id` (PK, string): e.g., `PO-1405-01`.
- `component_id` (FK -> `BOMComponent.component_id`, required).
- `project_id` (FK -> `Project.project_id`, required).
- `status` (enum): `RUNNING` | `BLOCKED_MATERIAL` | `TEST_QUEUE_CONFLICT` | `TECO`.
- `data_class` (enum).

#### `RoutingOperation`
- `operation_id` (PK, string): e.g., `OP-1405-30`.
- `production_order_id` (FK -> `ProductionOrder.production_order_id`, required).
- `sequence_no` (integer, required): e.g., 30.
- `work_center_id` (string, required): e.g., `MACH-TEST-01`.
- `planned_hours` (float, required).
- `data_class` (enum).

---

### 1.3 Issue & Bottleneck Domain (MANG_05 / MANG_03)

#### `IssueIntake` & `IssueCase`
- `id` (PK, string): e.g., `ISS-1405-01`.
- `project_id` (FK -> `Project.project_id`, required).
- `title` (string, required).
- `type` (enum): `MATERIAL` | `MACHINE` | `MANPOWER` | `METHOD` | `TREASURY` | `COPQ`.
- `severity` (enum): `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`.
- `qualification_status` (enum): `READY` | `INFORMATION_NEEDED` | `DUPLICATE` | `OUT_OF_SCOPE` | `NOT_SURE`.
- `var_billion` (float, required): Value at Risk.
- `wip_cost_million` (float, required): WIP Holding Cost (calculated at 36% annual cost of capital).
- `copq_million` (float, required): Cost of Poor Quality.
- `treasury_lag_days` (integer, required): Lag days between technical sign-off and cash pool disbursement.
- `days_to_pnr` (integer, required): Days to Point of No Return.
- `status` (enum): `OPEN` | `SOLUTION_PROPOSED` | `UNDER_REVIEW` | `RESOLVED`.
- `evidence_tripartite` (object, required):
  - `warehouse_doc` (boolean + ref).
  - `machine_power_log` (boolean + ref).
  - `overhead_crane_telemetry` (boolean + ref).
- `data_class` (enum): `DEMO_SYNTHETIC` | `INTERNAL_VERIFIED`.

---

### 1.4 Solution & Decision Domain (MANG_05 / MANG_03)

#### `SolutionCandidate`
- `id` (PK, string): e.g., `SOL-1405-A`.
- `issue_id` (FK -> `IssueCase.id`, required).
- `project_id` (FK -> `Project.project_id`, required).
- `title` (string, required).
- `strategy_type` (enum): `EXPEDITE_PROCUREMENT` | `CAPACITY_OVERTIME` | `EXTERNAL_OUTSOURCING` | `MATERIAL_BORROW` | `TREASURY_EXPEDITE` | `EMERGENCY_OVERTIME`.
- `feasibility` (enum): `FEASIBLE` | `CONDITIONAL` | `INFEASIBLE`.
- `cost_million` (float, required).
- `exec_days` (integer, required).
- `protected_var_billion` (float, required).
- `saved_wip_million` (float, required).
- `status` (enum): `PROPOSED` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `EXECUTING` | `COMPLETED`.
- `owner` (string, required).
- `approved_at` (string, nullable).
- `cannibalization_guard` (object, required):
  - `metallurgy_match_100pct` (boolean).
  - `replacement_order_in_donor_lrm` (boolean).
- `data_class` (enum).

#### `DecisionRecord`
- `decision_id` (PK, string).
- `scenario_key` / `issue_id` (string).
- `selected_option_id` (string).
- `approver_name` (string, required).
- `approver_role` (string, required): Must be authorized manager/CEO.
- `decision_timestamp` (ISO timestamp).
- `rationale` (string, required).
- `feasibility_snapshot` (object, immutable).
- `status` (enum): `APPROVED` | `REJECTED`.
- `data_class` (enum).

---

### 1.5 Knowledge & Learning Domain

#### `OutcomeObservation`
- `outcome_id` (PK, string).
- `decision_id` (FK -> `DecisionRecord.decision_id`).
- `expected_outcome` (string).
- `observed_actual` (string).
- `variance` (string).
- `verified_by` (string).
- `data_class` (enum).

#### `LessonLearned`
- `lesson_id` (PK, string).
- `title` (string).
- `root_cause` (string).
- `preventative_rule` (string).
- `review_status` (enum): `PROPOSED` | `REVIEWED` | `APPROVED` | `RETIRED`.
- `approved_by` (string, nullable).
- `data_class` (enum).

---

## 2. Integrity & Relational Verification Rules
1. **Zero-Guess Rule:** If a foreign key or numeric value is absent, it remains `null` or `UNKNOWN`; it is never defaulted to `0` or a hardcoded project like `P-1405`.
2. **Tripartite Floor Evidence Verification:** Paper claims of physical progress without warehouse docs, power logs, and crane telemetry are flagged as unverified.
3. **Guardrail Cannibalization Verification:** Inter-project material borrowing is flagged `INFEASIBLE` unless metallurgy matches 100% and donor LRM safety margin is preserved.
4. **Feasibility Precedence:** Hard gates (Dependency, Material, Machine, Labor, Method, Cash, Shared Conflicts) must all pass before an option is eligible for management approval.
