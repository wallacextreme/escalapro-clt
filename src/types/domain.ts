export type StatusCode = 'T' | 'F' | 'FE' | 'LM' | 'LP' | 'FA' | 'AT' | 'BH' | 'TR';

export type ScaleCode =
  | '5x2_40'
  | '5x2_42'
  | '5x2_44'
  | '6x1_44'
  | '12x36'
  | '12x48'
  | '4x3'
  | '6x2'
  | '5x1'
  | '4x2'
  | '24x48'
  | 'CUSTOM';

export type WorkRegime = 'FIXO' | 'ROTATIVO';

export type Gender = 'F' | 'M';

export type SundayRuleType =
  | 'EC141_PREFERENTIAL'
  | 'ART386_BIWEEKLY_15D'
  | 'COMMERCE_3WEEKS'
  | 'MTP671_7WEEKS'
  | 'ALTERNATING';

export type LunchWindowId = 'W1_12_13' | 'W2_13_14' | 'NIGHT_W1_00_01' | 'NIGHT_W2_01_02' | 'NONE';

export type LeaveType = 'F' | 'FE' | 'LM' | 'LP';

export type BradfordRiskLevel = 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';

export interface Sector {
  id: string;
  name: string;
  minCriticalPresence: number;
  isCommerce: boolean;
  operatingStartHour: number;
  operatingEndHour: number;
  historicalAbsenceRateByWeekday: Record<number, number>; // 0=Dom .. 6=Sab (0.0 to 1.0)
}

export interface ScaleTemplate {
  id: string;
  code: ScaleCode;
  name: string;
  description: string;
  workDays: number;
  restDays: number;
  dailyHours: number;
  weeklyHours: number;
  divisor: number;
  sundayRule: SundayRuleType;
  requiresUnionAgreement: boolean;
  extraMonthlyRest12x36?: boolean;
  legalReference: string;
}

export interface ShiftDefinition {
  id: string;
  code: string;
  label: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationHours: number;
  isOvernight: boolean;
}

export interface Employee {
  id: string;
  registration: string;
  name: string;
  sectorId: string;
  role: string;
  scaleCode: ScaleCode;
  regime: WorkRegime;
  defaultShiftCode: string;
  gender: Gender;
  hourlySalaryBase: number;
  monthlySalary: number;
  admissionDate: string; // YYYY-MM-DD
  active: boolean;
  unionRuleId?: string;
}

export interface ScheduleAssignment {
  id: string;
  employeeId: string;
  sectorId: string;
  date: string; // YYYY-MM-DD
  statusCode: StatusCode;
  shiftCode: string;
  lunchWindow: LunchWindowId;
  hoursWorked: number;
  overtimeHours?: number;
  notes?: string;
}

export interface LeaveOrVacation {
  id: string;
  employeeId: string;
  sectorId: string;
  date: string; // YYYY-MM-DD
  type: LeaveType;
  substituteEmployeeId?: string;
  approved: boolean;
  reason: string;
  createdAt: string;
}

export interface ShiftSwapRecord {
  id: string;
  date: string; // YYYY-MM-DD
  sectorId: string;
  absentEmployeeId: string;
  substituteEmployeeId: string;
  reason: string;
  interjornadaHours: number;
  dsrIntervalHours: number;
  weeklyHoursAfterSwap: number;
  sundayRuleCompliant: boolean;
  createdAt: string;
}

export interface PunchVariation {
  entryDiffMin: number;
  lunchOutDiffMin: number;
  lunchInDiffMin: number;
  exitDiffMin: number;
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  lateMinutes: number;
  earlyLeaveMinutes: number;
  punchVariations?: PunchVariation;
  unjustifiedAbsence: boolean;
  justifiedAbsence: boolean;
  medicalCertificateDays: number;
  notes?: string;
}

export interface UnionRule {
  id: string;
  instrumentType: 'ACT' | 'CCT';
  code: string;
  unionName: string;
  description: string;
  validUntil: string; // YYYY-MM-DD
  authorizes12x36: boolean;
  authorizes12x48: boolean;
  sundayFrequencyWeeks: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  payloadHash: string;
}

export interface SyncQueueItem {
  id: string;
  entity: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  payloadJson: string;
  payloadHash: string;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
  createdAt: string;
  syncedAt?: string;
}

/* =========================================================
 * Interfaces de Retorno dos 6 Motores
 * ========================================================= */

export interface CustomScaleParams {
  name: string;
  workDays: number;
  dailyHours: number;
  restDays: number;
  divisor: number;
  sundayRule: SundayRuleType;
  requiresUnionAgreement: boolean;
  extraMonthlyRest12x36?: boolean;
}

export interface Migration6x1To5x2Result {
  employeeCount: number;
  currentScale: ScaleCode;
  targetScale: '5x2_42' | '5x2_40';
  currentWeeklyHours: number;
  targetWeeklyHours: number;
  currentDivisor: number;
  targetDivisor: number;
  hourlyRateBefore: number;
  hourlyRateAfter: number;
  hourlyRateIncreasePct: number;
  weeklyHoursReducedTotal: number;
  additionalHeadcountNeeded: number;
  legalNote: string;
}

export interface LunchStaggerResult {
  date: string;
  sectorId: string;
  window1Count: number;
  window2Count: number;
  updatedAssignments: ScheduleAssignment[];
  coverageGuaranteed: boolean;
}

export interface LeaveCollisionValidationResult {
  allowed: boolean;
  blocked: boolean;
  code:
    | 'OK'
    | 'SECTOR_COLLISION_GE_2'
    | 'ART_134_PAR_3_CLT_DSR_OR_HOLIDAY'
    | 'DUPLICATE_EMPLOYEE_DATE';
  message: string;
  conflictingEmployees: string[];
}

export interface HourlyCoverageCell {
  hour: number; // 8..19
  label: string;
  scheduledCount: number;
  onLunchCount: number;
  onLeaveOrAbsenceCount: number;
  activeCount: number;
  minRequired: number;
  deficit: number;
  isDeficit: boolean;
}

export interface CriticalWindowSummary {
  id:
    | 'OPENING_08_10'
    | 'MORNING_PEAK_10_12'
    | 'LUNCH_12_14'
    | 'AFTERNOON_PEAK_14_17'
    | 'CLOSING_17_20'
    | 'SATURDAY'
    | 'SUNDAY';
  label: string;
  minActiveCount: number;
  requiredPresence: number;
  isDeficit: boolean;
  activeEmployees: string[];
}

export interface SectorCoverageMatrixResult {
  sectorId: string;
  sectorName: string;
  date: string;
  minCriticalPresence: number;
  hourlyCells: HourlyCoverageCell[];
  criticalWindows: CriticalWindowSummary[];
  hasAnyDeficit: boolean;
}

export interface HeadcountSimulationRow {
  scaleCode: ScaleCode;
  scaleName: string;
  weeklyHours: number;
  divisor: number;
  requiredTotalHeadcount: number;
  dailyCapacityRatio: number;
  notes: string;
}

export interface SwapCandidateEvaluation {
  candidate: Employee;
  approved: boolean;
  suitabilityScore: number;
  lastShiftEndedAt: string | null;
  interjornadaHours: number;
  dsrIntervalHours: number;
  weeklyHoursCurrent: number;
  weeklyHoursProjected: number;
  weeklyLimitHours: number;
  consecutiveSundaysWorked: number;
  sundayLimitWeeks: number;
  checks: {
    interjornadaArt66Ok: boolean;
    dsrArt67Ok: boolean;
    weeklyAndOvertimeArt59Ok: boolean;
    sundayRotationOk: boolean;
  };
  reasons: string[];
}

export interface MonthlyPayrollLedgerRow {
  employeeId: string;
  employeeName: string;
  sectorId: string;
  scaleCode: ScaleCode;
  divisor: number;
  month: string;
  plannedDays: number;
  workedDays: number;
  unjustifiedAbsences: number;
  justifiedAbsences: number;
  medicalDaysInMonth: number;
  medicalDaysRolling60Days: number;
  inssReferralAlert: boolean;
  rawLateMinutes: number;
  exemptToleranceMinutes: number;
  discountableLateMinutes: number;
  dsrLostCount: number;
  vacationDaysEntitledArt130: number;
  hourlyRate: number;
  dsrDeductionValue: number;
}

export interface AnalyticsFilter {
  periodMonth: string; // 'ALL' or 'YYYY-MM'
  sectorId: string; // 'ALL' or sector.id
  role: string; // 'ALL' or role
  scaleCode: 'ALL' | ScaleCode;
  regime: 'ALL' | WorkRegime;
  shiftCode: 'ALL' | string;
  gender: 'ALL' | Gender;
  employeeId: string; // 'ALL' or employee.id
}

export interface EmployeeBradfordScore {
  employeeId: string;
  employeeName: string;
  sectorId: string;
  role: string;
  scaleCode: ScaleCode;
  episodesS: number;
  daysLostD: number;
  bradfordScore: number;
  riskLevel: BradfordRiskLevel;
}

export interface WeekdaySectorHeatmapCell {
  sectorId: string;
  sectorName: string;
  weekday: number; // 0..6
  weekdayLabel: string;
  absenceRatePct: number;
  absenceCount: number;
}

export interface CrisisPredictionAlert {
  date: string;
  weekdayLabel: string;
  sectorId: string;
  sectorName: string;
  scheduledCount: number;
  minRequired: number;
  coverageMargin: number;
  historicalAbsenceProbabilityPct: number;
  expectedAbsentHeadcount: number;
  projectedNetCoverage: number;
  crisisRisk: boolean;
  alertMessage: string;
}

export interface WorkforceAnalyticsResult {
  plannedHours: number;
  lostHours: number;
  absenteeismRatePct: number;
  filteredEmployeesCount: number;
  bradfordRanking: EmployeeBradfordScore[];
  weekdayHeatmap: WeekdaySectorHeatmapCell[];
  crisisAlerts: CrisisPredictionAlert[];
}

