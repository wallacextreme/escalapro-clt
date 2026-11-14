# AI_CONTEXT.md — EscalaPro CLT (v2.0)

## Visão Geral da Arquitetura
O **EscalaPro CLT** é uma aplicação **Offline-First** (PWA + Desktop Nativo Tauri v2) construída com:
- **Frontend**: React 19 + TypeScript 5 (`strict: true`, `noUncheckedIndexedAccess: true`) + Vite 6 (`build.target: "chrome100"`) + Tailwind CSS v3 (cores em Hex/RGB/HSL, sem `oklch()`).
- **Persistência Local Primária**: `Dexie.js` (IndexedDB `EscalaProCLT_v2`) operando com 11 object stores:
  - `employees`
  - `sectors`
  - `scaleTemplates`
  - `shifts`
  - `scheduleAssignments` (índice composto `[sectorId+date]`, `[employeeId+date]`)
  - `leavesAndVacations` (índice composto `[sectorId+date]`, `[employeeId+date]`)
  - `shiftSwaps`
  - `attendanceLogs` (índice composto `[employeeId+month]`)
  - `unionRules`
  - `auditLogs`
  - `syncQueue`
- **Dual-Write Sync Opcional**: Toda mutação grava no IndexedDB e enfileira registro assinado com hash SHA-256 em `syncQueue` e `auditLogs` (`src/db/syncEngine.ts`), pronto para envio autenticado ao Firebase Realtime Database respeitando `database.rules.json`.

## Mapa dos 6 Motores em `src/core/laborRulesEngine.ts`
1. `LunchWindowStaggerEngine` (`staggerSectorLunchWindows`) → View `#view-shift-mapping`
2. `SectorCollisionDetector` (`validateLeaveOrVacationRequest`) → View `#view-leave-planner`
3. `CriticalHourHeatmapEngine` (`calculateSectorCoverageMatrix` & `simulateHeadcountComparison`) → View `#view-coverage-matrix`
4. `SingleScreenSwapResolver` (`evaluateShiftSwapCandidates`) → View `#view-agile-swap`
5. `HrPayrollLedgerEngine` (`calculateEmployeeMonthlyLedger`) → View `#view-absence-history`
6. `BradfordAndCrisisPredictor` (`calculateWorkforceAnalytics`) → View `#view-analytics-dashboard`

## Motor de Escalas & Simulação
- Presets: `5x2_40` (divisor 200), `5x2_42` (divisor 210), `5x2_44` (divisor 220), `6x1_44` (divisor 220), `12x36`, `12x48` (ACT/CCT, divisor 180), `4x3`, `6x2`, `5x1`, `4x2`, `24x48`.
- Construtor Customizado: `buildCustomScale()`.
- Assistente de Transição: `simulateMigration6x1To5x2()`.

