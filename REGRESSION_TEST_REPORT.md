# REGRESSION_TEST_REPORT: Automated Test Suite & Regression Verification
**System:** PARS Value Protection Tower (PVPT / MANG_06)  
**Date:** 2026-10-30  
**Test Suite Path:** `tests/`  
**Test Configuration:** `playwright.config.js`  
**Status:** In Progress / Regression Baseline Documented  

---

## 1. Test Suite Coverage Inventory

| Test File | Target Domain | Tests Count | Desktop Profile | Mobile Profile | Execution Command | Result |
|---|---|---|---|---|---|---|
| `scripts/validate-agent-skills.mjs` | Agent Skills Specification & Compliance | 5 Skills | N/A | N/A | `node scripts/validate-agent-skills.mjs` | **PASS (5/5)** |
| `tests/product-project-model.spec.js` | Referential integrity, 6 canonical families, provenance, orphan rejection | 5 Specs | 5 Passed | 5 Passed | `npx playwright test product-project-model.spec.js` | **PASS (10/10)** |
| `tests/demo-smoke.spec.js` | CEO dashboard truth separation, portfolio search, project-cell trace, DEMO-01/02 calculation, storage persistence | 11 Specs | 11 Tests | 11 Tests | `npx playwright test demo-smoke.spec.js` | **PASS** |
| `tests/demo-regression.spec.js` | Uncaught browser errors across all navigation, hard gate rejections, capacity checks, modal Escape handling | 4 Specs | 4 Tests | 4 Tests | `npx playwright test demo-regression.spec.js` | **PASS** |
| `tests/visual-smoke.spec.js` | Viewport rendering without horizontal scroll, mobile viewport integrity | 2 Specs | 2 Tests | 2 Tests | `npx playwright test visual-smoke.spec.js` | **PASS** |

---

## 2. Specific Negative & Boundary Tests Verified
1. **PPOM Referential Integrity:** Prohibits orphan project assignments, enforces unique identifiers, and checks foreign key existence.
2. **Public Catalogue Boundary:** Proves that public product models do not fabricate or imply active project assignments or customer commitments.
3. **Hard Constraint Infeasibility:** Rejects material borrowing when donor schedule is pushed 5 days, and rejects engineering substitute when validation duration (6 days) exceeds commitment window (3 days).
4. **Capacity Deficit Detection:** Proves that a 6-hour capacity deficit is detected, and flags overtime or external testing as the only viable options within budget.
5. **Escape Key Modal Dismissal:** Ensures accessibility and keyboard navigation compliance.
