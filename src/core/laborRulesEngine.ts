import type {
  AnalyticsFilter,
  AttendanceLog,
  BradfordRiskLevel,
  CrisisPredictionAlert,
  CriticalWindowSummary,
  CustomScaleParams,
  Employee,
  EmployeeBradfordScore,
  HeadcountSimulationRow,
  HourlyCoverageCell,
  LeaveCollisionValidationResult,
  LeaveOrVacation,
  LunchStaggerResult,
  LunchWindowId,
  Migration6x1To5x2Result,
  MonthlyPayrollLedgerRow,
  ScaleCode,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  SectorCoverageMatrixResult,
  ShiftDefinition,
  SwapCandidateEvaluation,
  UnionRule,
  WeekdaySectorHeatmapCell,
  WorkforceAnalyticsResult
} from '../types/domain';

/* =========================================================
 * Utilitários de Data (UTC puro — imune a fuso horário)
 * ========================================================= */

export function parseIsoDateUtc(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function formatIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const dt = parseIsoDateUtc(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDateUtc(dt);
}

export function getWeekdayUtc(isoDate: string): number {
  return parseIsoDateUtc(isoDate).getUTCDay(); // 0=Dom .. 6=Sab
}

export function diffDaysIso(startIso: string, endIso: string): number {
  const start = parseIsoDateUtc(startIso).getTime();
  const end = parseIsoDateUtc(endIso).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function getMondayOfWeekIso(isoDate: string): string {
  const wd = getWeekdayUtc(isoDate);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDaysIso(isoDate, offset);
}

export function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const WEEKDAY_LABELS_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
};

export const WEEKDAY_SHORT_PT: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb'
};

/* =========================================================
 * Feriados Nacionais (2026–2027) para Trava Art. 134 § 3º CLT
 * ========================================================= */

export const BRAZIL_NATIONAL_HOLIDAYS_2026_2027: readonly string[] = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-06-04',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-25',
  '2027-01-01',
  '2027-03-26',
  '2027-04-21',
  '2027-05-01',
  '2027-05-27',
  '2027-09-07',
  '2027-10-12',
  '2027-11-02',
  '2027-11-15',
  '2027-11-20',
  '2027-12-25'
];

/* =========================================================
 * Catálogo Parametrizável de Escalas (CLT & EC 141/2026)
 * ========================================================= */

export const SCALE_PRESETS: Record<Exclude<ScaleCode, 'CUSTOM'>, ScaleTemplate> = {
  '5x2_40': {
    id: 'scale-5x2-40',
    code: '5x2_40',
    name: '5x2 Constitucional (40h)',
    description: '5 dias trabalhados x 2 DSRs (1 preferencialmente no domingo).',
    workDays: 5,
    restDays: 2,
    dailyHours: 8,
    weeklyHours: 40,
    divisor: 200,
    sundayRule: 'EC141_PREFERENTIAL',
    requiresUnionAgreement: false,
    legalReference: 'EC nº 141/2026 & Art. 7º XIII CF'
  },
  '5x2_42': {
    id: 'scale-5x2-42',
    code: '5x2_42',
    name: '5x2 Transição (42h)',
    description: '8h24/dia em regime de transição constitucional até 15/12/2027.',
    workDays: 5,
    restDays: 2,
    dailyHours: 8.4,
    weeklyHours: 42,
    divisor: 210,
    sundayRule: 'EC141_PREFERENTIAL',
    requiresUnionAgreement: false,
    legalReference: 'EC nº 141/2026 (Regra de Transição até 15/12/2027)'
  },
  '5x2_44': {
    id: 'scale-5x2-44',
    code: '5x2_44',
    name: '5x2 Compensada (44h)',
    description: '8h48/dia de segunda a sexta-feira compensando o sábado.',
    workDays: 5,
    restDays: 2,
    dailyHours: 8.8,
    weeklyHours: 44,
    divisor: 220,
    sundayRule: 'EC141_PREFERENTIAL',
    requiresUnionAgreement: false,
    legalReference: 'CLT Art. 59 § 2º & Súmula 85 TST'
  },
  '6x1_44': {
    id: 'scale-6x1-44',
    code: '6x1_44',
    name: '6x1 Tradicional / Em Transição (44h)',
    description: '6 dias trabalhados (7h20/dia ou 8h seg-sex + 4h sáb) x 1 DSR.',
    workDays: 6,
    restDays: 1,
    dailyHours: 7.33,
    weeklyHours: 44,
    divisor: 220,
    sundayRule: 'COMMERCE_3WEEKS',
    requiresUnionAgreement: false,
    legalReference: 'CLT Art. 58 / Lei 10.101/2000 / Portaria MTP 671/2021'
  },
  '12x36': {
    id: 'scale-12x36',
    code: '12x36',
    name: '12x36 (Art. 59-A CLT)',
    description:
      '12h de trabalho por 36h ininterruptas de descanso; opção de 1 folga extra mensal (EC 141/2026).',
    workDays: 1,
    restDays: 1,
    dailyHours: 12,
    weeklyHours: 42,
    divisor: 200,
    sundayRule: 'ALTERNATING',
    requiresUnionAgreement: false,
    extraMonthlyRest12x36: true,
    legalReference: 'CLT Art. 59-A & EC nº 141/2026'
  },
  '12x48': {
    id: 'scale-12x48',
    code: '12x48',
    name: '12x48 (Regime Sindical ACT/CCT)',
    description:
      '12h de trabalho por 48h de descanso (ciclo 60h = 2,5 dias; média 33,6h/semana).',
    workDays: 1,
    restDays: 2,
    dailyHours: 12,
    weeklyHours: 33.6,
    divisor: 180,
    sundayRule: 'ALTERNATING',
    requiresUnionAgreement: true,
    legalReference: 'ACT/CCT Sindical & Art. 611-A CLT'
  },
  '4x3': {
    id: 'scale-4x3',
    code: '4x3',
    name: '4x3 Compacta (40h)',
    description: '4 dias de 10h trabalhadas por 3 dias de descanso.',
    workDays: 4,
    restDays: 3,
    dailyHours: 10,
    weeklyHours: 40,
    divisor: 200,
    sundayRule: 'EC141_PREFERENTIAL',
    requiresUnionAgreement: true,
    legalReference: 'ACT/CCT & CLT Art. 611-A'
  },
  '6x2': {
    id: 'scale-6x2',
    code: '6x2',
    name: '6x2 Revezamento Contínuo',
    description: '6 dias trabalhados seguidos de 2 dias consecutivos de folga.',
    workDays: 6,
    restDays: 2,
    dailyHours: 7.33,
    weeklyHours: 38.5,
    divisor: 220,
    sundayRule: 'MTP671_7WEEKS',
    requiresUnionAgreement: true,
    legalReference: 'Portaria MTP 671/2021 & CCT'
  },
  '5x1': {
    id: 'scale-5x1',
    code: '5x1',
    name: '5x1 Revezamento Contínuo',
    description: '5 dias trabalhados por 1 dia de folga em ciclo contínuo de 6 dias.',
    workDays: 5,
    restDays: 1,
    dailyHours: 7.33,
    weeklyHours: 42.8,
    divisor: 220,
    sundayRule: 'COMMERCE_3WEEKS',
    requiresUnionAgreement: true,
    legalReference: 'CLT Art. 67 & Súmula 146 TST'
  },
  '4x2': {
    id: 'scale-4x2',
    code: '4x2',
    name: '4x2 Turnos Operacionais',
    description: '4 dias de 10h trabalhadas por 2 dias de descanso.',
    workDays: 4,
    restDays: 2,
    dailyHours: 10,
    weeklyHours: 46.67,
    divisor: 220,
    sundayRule: 'MTP671_7WEEKS',
    requiresUnionAgreement: true,
    legalReference: 'ACT/CCT Sindical (requer compensação de horas)'
  },
  '24x48': {
    id: 'scale-24x48',
    code: '24x48',
    name: '24x48 Plantão Especial',
    description: '24h de plantão por 48h de repouso (exige ACT/CCT específico).',
    workDays: 1,
    restDays: 2,
    dailyHours: 24,
    weeklyHours: 56,
    divisor: 200,
    sundayRule: 'ALTERNATING',
    requiresUnionAgreement: true,
    legalReference: 'ACT/CCT Especial de Plantão & Art. 611-A CLT'
  }
};

export function getScaleTemplate(
  scaleCode: ScaleCode,
  customTemplates: ScaleTemplate[] = []
): ScaleTemplate {
  if (scaleCode === 'CUSTOM') {
    const found = customTemplates.find((t) => t.code === 'CUSTOM');
    if (found) return found;
    return {
      ...SCALE_PRESETS['5x2_40'],
      id: 'scale-custom-default',
      code: 'CUSTOM',
      name: 'Escala Customizada'
    };
  }
  return SCALE_PRESETS[scaleCode];
}

export function buildCustomScale(params: CustomScaleParams): ScaleTemplate {
  if (params.workDays < 1 || params.restDays < 1) {
    throw new Error('Dias trabalhados e folgas devem ser maiores ou iguais a 1.');
  }
  if (params.dailyHours <= 0 || params.dailyHours > 24) {
    throw new Error('Horas diárias devem estar entre 1h e 24h.');
  }
  if (params.divisor < 100 || params.divisor > 240) {
    throw new Error('Divisor salarial deve estar entre 100 e 240.');
  }

  const cycleDays = params.workDays + params.restDays;
  const weeklyHours =
    cycleDays === 7
      ? round2(params.workDays * params.dailyHours)
      : round2((params.workDays * params.dailyHours * 7) / cycleDays);

  return {
    id: `scale-custom-${Date.now()}`,
    code: 'CUSTOM',
    name: params.name.trim() || `Custom ${params.workDays}x${params.restDays}`,
    description: `Ciclo customizado ${params.workDays}x${params.restDays} (${params.dailyHours}h/dia, média ${weeklyHours}h/sem).`,
    workDays: params.workDays,
    restDays: params.restDays,
    dailyHours: params.dailyHours,
    weeklyHours,
    divisor: params.divisor,
    sundayRule: params.sundayRule,
    requiresUnionAgreement: params.requiresUnionAgreement,
    extraMonthlyRest12x36: params.extraMonthlyRest12x36,
    legalReference: params.requiresUnionAgreement
      ? 'ACT/CCT Obrigatório (Art. 611-A CLT)'
      : 'Norma Interna / CLT'
  };
}

export function simulateMigration6x1To5x2(params: {
  employeesInScale: Employee[];
  targetScale: '5x2_42' | '5x2_40';
}): Migration6x1To5x2Result {
  const count = Math.max(1, params.employeesInScale.length);
  const currentTemplate = SCALE_PRESETS['6x1_44'];
  const targetTemplate = SCALE_PRESETS[params.targetScale];

  const avgSalary =
    params.employeesInScale.length > 0
      ? params.employeesInScale.reduce((acc, e) => acc + e.monthlySalary, 0) /
        params.employeesInScale.length
      : 2400;

  const hourlyRateBefore = round2(avgSalary / currentTemplate.divisor);
  const hourlyRateAfter = round2(avgSalary / targetTemplate.divisor);
  const hourlyRateIncreasePct = round2(
    ((hourlyRateAfter - hourlyRateBefore) / hourlyRateBefore) * 100
  );

  const weeklyHoursReducedTotal = round2(
    count * (currentTemplate.weeklyHours - targetTemplate.weeklyHours)
  );

  const additionalHeadcountNeeded = Math.ceil(
    weeklyHoursReducedTotal / targetTemplate.weeklyHours
  );

  return {
    employeeCount: count,
    currentScale: '6x1_44',
    targetScale: params.targetScale,
    currentWeeklyHours: currentTemplate.weeklyHours,
    targetWeeklyHours: targetTemplate.weeklyHours,
    currentDivisor: currentTemplate.divisor,
    targetDivisor: targetTemplate.divisor,
    hourlyRateBefore,
    hourlyRateAfter,
    hourlyRateIncreasePct,
    weeklyHoursReducedTotal,
    additionalHeadcountNeeded,
    legalNote:
      'Irredutibilidade salarial garantida (Art. 7º, VI CF e EC 141/2026): mantém-se o salário mensal com redução do divisor.'
  };
}

/* =========================================================
 * Motor 1: LunchWindowStaggerEngine (Art. 71 CLT)
 * ========================================================= */

export function staggerSectorLunchWindows(params: {
  date: string;
  sectorId: string;
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
}): LunchStaggerResult {
  const shiftMap = new Map<string, ShiftDefinition>();
  for (const s of params.shifts) {
    shiftMap.set(s.code, s);
  }

  const sectorWorking = params.assignments.filter(
    (a) =>
      a.sectorId === params.sectorId &&
      a.date === params.date &&
      (a.statusCode === 'T' || a.statusCode === 'TR')
  );

  // Separa turnos diurnos (> 6h) de noturnos (> 6h) e jornadas curtas (<= 6h)
  const dayWorking: ScheduleAssignment[] = [];
  const nightWorking: ScheduleAssignment[] = [];
  const shortWorking: ScheduleAssignment[] = [];

  for (const item of sectorWorking) {
    const shift = shiftMap.get(item.shiftCode);
    if (shift && shift.durationHours <= 6) {
      shortWorking.push(item);
    } else if (shift?.isOvernight) {
      nightWorking.push(item);
    } else {
      dayWorking.push(item);
    }
  }

  // Ordena deterministicamente por employeeId para estabilidade de escala
  dayWorking.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  nightWorking.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

  let window1Count = 0;
  let window2Count = 0;
  const updatedById = new Map<string, ScheduleAssignment>();

  dayWorking.forEach((assignment, idx) => {
    const lunchWindow: LunchWindowId = idx % 2 === 0 ? 'W1_12_13' : 'W2_13_14';
    if (lunchWindow === 'W1_12_13') window1Count += 1;
    else window2Count += 1;
    updatedById.set(assignment.id, { ...assignment, lunchWindow });
  });

  nightWorking.forEach((assignment, idx) => {
    const lunchWindow: LunchWindowId =
      idx % 2 === 0 ? 'NIGHT_W1_00_01' : 'NIGHT_W2_01_02';
    if (lunchWindow === 'NIGHT_W1_00_01') window1Count += 1;
    else window2Count += 1;
    updatedById.set(assignment.id, { ...assignment, lunchWindow });
  });

  shortWorking.forEach((assignment) => {
    updatedById.set(assignment.id, { ...assignment, lunchWindow: 'NONE' });
  });

  const updatedAssignments = params.assignments.map(
    (a) => updatedById.get(a.id) ?? a
  );

  const dayDiff = Math.abs(
    dayWorking.filter((_, i) => i % 2 === 0).length -
      dayWorking.filter((_, i) => i % 2 === 1).length
  );

  // Cobertura garantida se há >= 2 no setor (ou 0) e a diferença entre janelas é <= 1
  const coverageGuaranteed =
    sectorWorking.length === 0 || (sectorWorking.length >= 2 && dayDiff <= 1);

  return {
    date: params.date,
    sectorId: params.sectorId,
    window1Count,
    window2Count,
    updatedAssignments,
    coverageGuaranteed
  };
}

/* =========================================================
 * Motor 2: SectorCollisionDetector (Dupla Ausência & Art. 134 § 3º CLT)
 * ========================================================= */

export function validateLeaveOrVacationRequest(params: {
  employee: Employee;
  date: string;
  type: LeaveOrVacation['type'];
  substituteEmployeeId?: string;
  existingLeaves: LeaveOrVacation[];
  employees: Employee[];
  assignments?: ScheduleAssignment[];
  holidays?: readonly string[];
}): LeaveCollisionValidationResult {
  const holidaySet = new Set<string>(
    params.holidays ?? BRAZIL_NATIONAL_HOLIDAYS_2026_2027
  );
  const employeeMap = new Map(params.employees.map((e) => [e.id, e]));

  // 1. Duplicidade para o mesmo colaborador na mesma data
  const sameEmployeeLeave = params.existingLeaves.find(
    (l) => l.employeeId === params.employee.id && l.date === params.date
  );
  if (sameEmployeeLeave) {
    return {
      allowed: false,
      blocked: true,
      code: 'DUPLICATE_EMPLOYEE_DATE',
      message: `Colaborador ${params.employee.name} já possui programação (${sameEmployeeLeave.type}) em ${params.date}.`,
      conflictingEmployees: [params.employee.name]
    };
  }

  // 2. Bloqueio de Dupla Ausência no Mesmo Setor ([sectorId+date])
  const sectorLeavesOnDate = params.existingLeaves.filter(
    (l) =>
      l.sectorId === params.employee.sectorId &&
      l.date === params.date &&
      l.employeeId !== params.employee.id
  );

  const hasValidSubstitute =
    Boolean(params.substituteEmployeeId) &&
    params.substituteEmployeeId !== params.employee.id;

  if (sectorLeavesOnDate.length >= 1 && !hasValidSubstitute) {
    const conflictingNames = sectorLeavesOnDate.map(
      (l) => employeeMap.get(l.employeeId)?.name ?? l.employeeId
    );
    return {
      allowed: false,
      blocked: true,
      code: 'SECTOR_COLLISION_GE_2',
      message: `BLOQUEADO: COLISÃO SETORIAL >= 2 NO SETOR (${conflictingNames.join(', ')} já ausente(s) em ${params.date} sem substituto pré-alocado).`,
      conflictingEmployees: conflictingNames
    };
  }

  // 3. Trava do Art. 134, § 3º da CLT para Férias (FE)
  // Proíbe início de férias no período de 2 dias que antecede feriado ou dia de DSR.
  if (params.type === 'FE') {
    const d1 = addDaysIso(params.date, 1);
    const d2 = addDaysIso(params.date, 2);
    const windowDates = [params.date, d1, d2];

    for (const checkDate of windowDates) {
      if (holidaySet.has(checkDate)) {
        return {
          allowed: false,
          blocked: true,
          code: 'ART_134_PAR_3_CLT_DSR_OR_HOLIDAY',
          message: `BLOQUEADO: ART. 134 § 3º CLT — Início de férias em ${params.date} antecede em até 2 dias o feriado de ${checkDate}.`,
          conflictingEmployees: []
        };
      }

      const explicitAssignment = params.assignments?.find(
        (a) => a.employeeId === params.employee.id && a.date === checkDate
      );
      const isDsr = explicitAssignment
        ? explicitAssignment.statusCode === 'F'
        : getWeekdayUtc(checkDate) === 0; // Domingo como DSR padrão se não houver escala explícita

      if (isDsr) {
        return {
          allowed: false,
          blocked: true,
          code: 'ART_134_PAR_3_CLT_DSR_OR_HOLIDAY',
          message: `BLOQUEADO: ART. 134 § 3º CLT — Início de férias em ${params.date} antecede em até 2 dias o dia de DSR (${checkDate}).`,
          conflictingEmployees: []
        };
      }
    }
  }

  return {
    allowed: true,
    blocked: false,
    code: 'OK',
    message: 'Programação validada e em conformidade com a CLT e cobertura setorial.',
    conflictingEmployees: []
  };
}

/* =========================================================
 * Motor 3: CriticalHourHeatmapEngine (Cobertura Crítica & Dimensionamento)
 * ========================================================= */

function shiftCoversHour(shift: ShiftDefinition | undefined, hour: number): boolean {
  if (!shift) {
    return hour >= 8 && hour < 17;
  }
  const startMin = parseTimeToMinutes(shift.startTime);
  const endMin = parseTimeToMinutes(shift.endTime);
  const hourStartMin = hour * 60;
  const hourEndMin = (hour + 1) * 60;

  if (!shift.isOvernight && endMin > startMin) {
    return hourStartMin >= startMin && hourEndMin <= endMin;
  }
  // Turno noturno (ex: 19:00 -> 07:00)
  return hourStartMin >= startMin || hourEndMin <= endMin;
}

function isOnLunchAtHour(lunchWindow: LunchWindowId, hour: number): boolean {
  if (lunchWindow === 'W1_12_13' && hour === 12) return true;
  if (lunchWindow === 'W2_13_14' && hour === 13) return true;
  if (lunchWindow === 'NIGHT_W1_00_01' && hour === 0) return true;
  if (lunchWindow === 'NIGHT_W2_01_02' && hour === 1) return true;
  return false;
}

export function calculateSectorCoverageMatrix(params: {
  sector: Sector;
  date: string;
  employees: Employee[];
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
}): SectorCoverageMatrixResult {
  const shiftMap = new Map(params.shifts.map((s) => [s.code, s]));
  const empMap = new Map(params.employees.map((e) => [e.id, e]));

  const computeForDate = (targetDate: string): HourlyCoverageCell[] => {
    const dayAssignments = params.assignments.filter(
      (a) => a.sectorId === params.sector.id && a.date === targetDate
    );

    const onLeaveCount = dayAssignments.filter((a) =>
      ['F', 'FE', 'LM', 'LP', 'FA'].includes(a.statusCode)
    ).length;

    const cells: HourlyCoverageCell[] = [];
    for (let hour = 8; hour <= 19; hour += 1) {
      let scheduledCount = 0;
      let onLunchCount = 0;

      for (const a of dayAssignments) {
        if (a.statusCode !== 'T' && a.statusCode !== 'TR') continue;
        const shift = shiftMap.get(a.shiftCode);
        if (!shiftCoversHour(shift, hour)) continue;
        scheduledCount += 1;
        if (isOnLunchAtHour(a.lunchWindow, hour)) {
          onLunchCount += 1;
        }
      }

      const activeCount = Math.max(0, scheduledCount - onLunchCount);
      const isOperating =
        hour >= params.sector.operatingStartHour &&
        hour < params.sector.operatingEndHour;
      const minRequired = isOperating ? params.sector.minCriticalPresence : 0;
      const deficit = Math.max(0, minRequired - activeCount);

      cells.push({
        hour,
        label: `${String(hour).padStart(2, '0')}h-${String(hour + 1).padStart(2, '0')}h`,
        scheduledCount,
        onLunchCount,
        onLeaveOrAbsenceCount: onLeaveCount,
        activeCount,
        minRequired,
        deficit,
        isDeficit: isOperating && activeCount < minRequired
      });
    }
    return cells;
  };

  const hourlyCells = computeForDate(params.date);

  const getActiveEmployeesInHours = (
    targetDate: string,
    hours: number[]
  ): string[] => {
    const dayAssignments = params.assignments.filter(
      (a) =>
        a.sectorId === params.sector.id &&
        a.date === targetDate &&
        (a.statusCode === 'T' || a.statusCode === 'TR')
    );
    const names = new Set<string>();
    for (const a of dayAssignments) {
      const shift = shiftMap.get(a.shiftCode);
      const activeInAnyHour = hours.some(
        (h) => shiftCoversHour(shift, h) && !isOnLunchAtHour(a.lunchWindow, h)
      );
      if (activeInAnyHour) {
        names.add(empMap.get(a.employeeId)?.name ?? a.employeeId);
      }
    }
    return Array.from(names);
  };

  const summarizeHours = (
    id: CriticalWindowSummary['id'],
    label: string,
    targetDate: string,
    cells: HourlyCoverageCell[],
    hours: number[]
  ): CriticalWindowSummary => {
    const slice = cells.filter((c) => hours.includes(c.hour));
    const operatingSlice = slice.filter((c) => c.minRequired > 0);
    const effectiveSlice = operatingSlice.length > 0 ? operatingSlice : slice;
    const minActiveCount =
      effectiveSlice.length > 0
        ? Math.min(...effectiveSlice.map((c) => c.activeCount))
        : 0;
    const requiredPresence =
      effectiveSlice.length > 0
        ? Math.max(...effectiveSlice.map((c) => c.minRequired))
        : 0;

    return {
      id,
      label,
      minActiveCount,
      requiredPresence,
      isDeficit: requiredPresence > 0 && minActiveCount < requiredPresence,
      activeEmployees: getActiveEmployeesInHours(targetDate, hours)
    };
  };

  const monday = getMondayOfWeekIso(params.date);
  const saturdayDate = addDaysIso(monday, 5);
  const sundayDate = addDaysIso(monday, 6);
  const saturdayCells = computeForDate(saturdayDate);
  const sundayCells = computeForDate(sundayDate);

  const criticalWindows: CriticalWindowSummary[] = [
    summarizeHours('OPENING_08_10', 'Abertura 08h-10h', params.date, hourlyCells, [8, 9]),
    summarizeHours('MORNING_PEAK_10_12', 'Pico Manhã 10h-12h', params.date, hourlyCells, [10, 11]),
    summarizeHours('LUNCH_12_14', 'Janela Almoço 12h-14h', params.date, hourlyCells, [12, 13]),
    summarizeHours('AFTERNOON_PEAK_14_17', 'Pico Tarde 14h-17h', params.date, hourlyCells, [14, 15, 16]),
    summarizeHours('CLOSING_17_20', 'Fechamento 17h-20h', params.date, hourlyCells, [17, 18, 19]),
    summarizeHours('SATURDAY', `Sábado (${saturdayDate})`, saturdayDate, saturdayCells, [9, 10, 11, 14, 15, 16]),
    summarizeHours('SUNDAY', `Domingo (${sundayDate})`, sundayDate, sundayCells, [9, 10, 11, 14, 15])
  ];

  const hasAnyDeficit = hourlyCells.some((c) => c.isDeficit);

  return {
    sectorId: params.sector.id,
    sectorName: params.sector.name,
    date: params.date,
    minCriticalPresence: params.sector.minCriticalPresence,
    hourlyCells,
    criticalWindows,
    hasAnyDeficit
  };
}

export function simulateHeadcountComparison(params: {
  minDailyCoverage: number;
  operatingHoursPerDay: number;
  operatingDaysPerWeek: number;
}): HeadcountSimulationRow[] {
  const weeklySectorDemandHours =
    Math.max(1, params.minDailyCoverage) *
    Math.max(1, params.operatingHoursPerDay) *
    Math.max(1, params.operatingDaysPerWeek);

  const codes: Array<{ code: Exclude<ScaleCode, 'CUSTOM'>; notes: string }> = [
    {
      code: '5x2_40',
      notes: 'EC 141/2026: 2 DSRs semanais; requer maior reserva para fins de semana.'
    },
    {
      code: '6x1_44',
      notes: '1 DSR semanal; menor efetivo nominal, mas alta rotatividade e passivo de domingos.'
    },
    {
      code: '12x36',
      notes: 'Art. 59-A CLT: cobre 12h contínuas com 2 equipes alternadas + reserva para folga EC 141.'
    },
    {
      code: '12x48',
      notes: 'ACT/CCT: exige 2,5 equipes por posto contínuo (33,6h/sem), reduzindo fadiga e absenteísmo.'
    }
  ];

  return codes.map(({ code, notes }) => {
    const tpl = SCALE_PRESETS[code];
    // Considera +10% de reserva técnica para férias/atestados no dimensionamento
    const requiredTotalHeadcount = Math.ceil(
      (weeklySectorDemandHours * 1.08) / tpl.weeklyHours
    );
    const dailyCapacityRatio = round2(tpl.weeklyHours / (7 * params.operatingHoursPerDay));
    return {
      scaleCode: tpl.code,
      scaleName: tpl.name,
      weeklyHours: tpl.weeklyHours,
      divisor: tpl.divisor,
      requiredTotalHeadcount,
      dailyCapacityRatio,
      notes
    };
  });
}

/* =========================================================
 * Motor 4: SingleScreenSwapResolver (Substituição Ágil CLT)
 * ========================================================= */

function getAssignmentTimestamps(
  date: string,
  shift: ShiftDefinition | undefined
): { startMs: number; endMs: number; durationHours: number } {
  const baseDateMs = parseIsoDateUtc(date).getTime();
  const startMin = shift ? parseTimeToMinutes(shift.startTime) : 8 * 60;
  const endMin = shift ? parseTimeToMinutes(shift.endTime) : 17 * 60;
  const durationHours = shift ? shift.durationHours : 8;

  const startMs = baseDateMs + startMin * 60_000;
  let endMs = baseDateMs + endMin * 60_000;
  if (shift?.isOvernight || endMs <= startMs) {
    endMs += 86_400_000;
  }
  return { startMs, endMs, durationHours };
}

export function evaluateShiftSwapCandidates(params: {
  targetDate: string;
  absentEmployeeId: string;
  targetShiftCode?: string;
  employees: Employee[];
  sectors: Sector[];
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
  unionRules?: UnionRule[];
  customTemplates?: ScaleTemplate[];
}): SwapCandidateEvaluation[] {
  const empMap = new Map(params.employees.map((e) => [e.id, e]));
  const sectorMap = new Map(params.sectors.map((s) => [s.id, s]));
  const shiftMap = new Map(params.shifts.map((s) => [s.code, s]));
  const unionRuleMap = new Map((params.unionRules ?? []).map((u) => [u.id, u]));

  const absentEmployee = empMap.get(params.absentEmployeeId);
  if (!absentEmployee) return [];

  const absentAssignment = params.assignments.find(
    (a) => a.employeeId === absentEmployee.id && a.date === params.targetDate
  );

  const shiftCodeToCover =
    params.targetShiftCode ??
    absentAssignment?.shiftCode ??
    absentEmployee.defaultShiftCode;
  const targetShift = shiftMap.get(shiftCodeToCover);
  const targetSlot = getAssignmentTimestamps(params.targetDate, targetShift);

  const weekStart = getMondayOfWeekIso(params.targetDate);
  const weekEnd = addDaysIso(weekStart, 6);
  const targetWeekday = getWeekdayUtc(params.targetDate);
  const isTargetSunday = targetWeekday === 0;

  const candidates = params.employees.filter(
    (e) => e.active && e.id !== params.absentEmployeeId
  );

  const evaluations: SwapCandidateEvaluation[] = candidates.map((candidate) => {
    const candidateSector = sectorMap.get(candidate.sectorId);
    const scaleTemplate = getScaleTemplate(
      candidate.scaleCode,
      params.customTemplates
    );
    const unionRule = candidate.unionRuleId
      ? unionRuleMap.get(candidate.unionRuleId)
      : undefined;

    const candidateAssignments = params.assignments
      .filter((a) => a.employeeId === candidate.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const sameDayAssignment = candidateAssignments.find(
      (a) => a.date === params.targetDate
    );
    const alreadyWorkingSameDay =
      sameDayAssignment?.statusCode === 'T' ||
      sameDayAssignment?.statusCode === 'TR';

    // 1. Interjornada (Art. 66 CLT >= 11h antes e depois do turno proposto)
    const workingAssignments = candidateAssignments.filter(
      (a) =>
        (a.statusCode === 'T' || a.statusCode === 'TR') &&
        a.date !== params.targetDate
    );

    let lastEndedMs: number | null = null;
    let lastShiftEndedAt: string | null = null;
    let nextStartMs: number | null = null;

    for (const wa of workingAssignments) {
      const s = shiftMap.get(wa.shiftCode);
      const ts = getAssignmentTimestamps(wa.date, s);
      if (ts.endMs <= targetSlot.startMs) {
        if (lastEndedMs === null || ts.endMs > lastEndedMs) {
          lastEndedMs = ts.endMs;
          lastShiftEndedAt = `${wa.date} ${s?.endTime ?? '17:00'}`;
        }
      }
      if (ts.startMs >= targetSlot.endMs) {
        if (nextStartMs === null || ts.startMs < nextStartMs) {
          nextStartMs = ts.startMs;
        }
      }
    }

    const gapBeforeHours =
      lastEndedMs !== null
        ? round2((targetSlot.startMs - lastEndedMs) / 3_600_000)
        : 48;
    const gapAfterHours =
      nextStartMs !== null
        ? round2((nextStartMs - targetSlot.endMs) / 3_600_000)
        : 48;

    const interjornadaHours = alreadyWorkingSameDay
      ? 0
      : Math.min(gapBeforeHours, gapAfterHours);

    const interjornadaArt66Ok = !alreadyWorkingSameDay && interjornadaHours >= 11;

    // 2. DSR + Interjornada (Art. 67 CLT >= 35h quando dia anterior foi DSR 'F')
    const prevDate = addDaysIso(params.targetDate, -1);
    const prevAssignment = candidateAssignments.find((a) => a.date === prevDate);
    const wasOnDsrYesterday = prevAssignment?.statusCode === 'F';
    const dsrIntervalHours = wasOnDsrYesterday ? gapBeforeHours : interjornadaHours;
    const dsrArt67Ok = wasOnDsrYesterday ? dsrIntervalHours >= 35 : true;

    // 3. Teto Semanal e Limite de 2h Extras Diárias (Art. 59 CLT)
    const weeklyHoursCurrent = round2(
      candidateAssignments
        .filter(
          (a) =>
            a.date >= weekStart &&
            a.date <= weekEnd &&
            (a.statusCode === 'T' || a.statusCode === 'TR')
        )
        .reduce((acc, a) => acc + a.hoursWorked, 0)
    );

    const addedHours = alreadyWorkingSameDay ? 0 : targetSlot.durationHours;
    const weeklyHoursProjected = round2(weeklyHoursCurrent + addedHours);
    const dailyOvertimeExcess = Math.max(
      0,
      targetSlot.durationHours - scaleTemplate.dailyHours
    );
    const weeklyLimitHours = scaleTemplate.weeklyHours;

    // Permite cobertura dentro do teto da escala (ou até +2h semanais quando é extensão de turno <= 2h)
    const weeklyAndOvertimeArt59Ok =
      !alreadyWorkingSameDay &&
      dailyOvertimeExcess <= 2 &&
      weeklyHoursProjected <= weeklyLimitHours;

    // 4. Revezamento Dominical (Art. 386 CLT / Comércio 3 sem / MTP 671 7 sem)
    let consecutiveSundaysWorked = 0;
    for (let w = 1; w <= 7; w += 1) {
      const checkSunday = addDaysIso(
        isTargetSunday ? params.targetDate : addDaysIso(weekStart, -1),
        isTargetSunday ? -7 * w : -7 * (w - 1)
      );
      const sunAssign = candidateAssignments.find((a) => a.date === checkSunday);
      if (sunAssign && (sunAssign.statusCode === 'T' || sunAssign.statusCode === 'TR')) {
        consecutiveSundaysWorked += 1;
      } else {
        break;
      }
    }

    let sundayLimitWeeks = 6; // MTP 671/2021 padrão (folga ao menos na 7ª semana)
    if (candidate.gender === 'F') {
      sundayLimitWeeks = 1; // Art. 386 CLT: escala quinzenal (15 dias), máx 1 domingo consecutivo
    } else if (candidateSector?.isCommerce) {
      sundayLimitWeeks = 2; // Lei 10.101/2000 comércio: 1 domingo de folga a cada 3 semanas
    }
    if (unionRule && unionRule.sundayFrequencyWeeks - 1 < sundayLimitWeeks) {
      sundayLimitWeeks = Math.max(1, unionRule.sundayFrequencyWeeks - 1);
    }

    const sundayRotationOk =
      !isTargetSunday || consecutiveSundaysWorked < sundayLimitWeeks;

    const reasons: string[] = [];
    if (alreadyWorkingSameDay) {
      reasons.push('Já escalado em turno ativo nesta data.');
    }
    if (!alreadyWorkingSameDay && !interjornadaArt66Ok) {
      reasons.push(
        `Bloqueio Art. 66 CLT: interjornada de ${interjornadaHours}h (< 11h exigidas).`
      );
    }
    if (!dsrArt67Ok) {
      reasons.push(
        `Bloqueio Art. 67 CLT: intervalo após DSR de ${dsrIntervalHours}h (< 35h exigidas).`
      );
    }
    if (!alreadyWorkingSameDay && !weeklyAndOvertimeArt59Ok) {
      reasons.push(
        `Bloqueio Art. 59 CLT: projeção semanal ${weeklyHoursProjected}h excede teto de ${weeklyLimitHours}h da escala ${scaleTemplate.name}.`
      );
    }
    if (!sundayRotationOk) {
      reasons.push(
        candidate.gender === 'F'
          ? `Bloqueio Art. 386 CLT: colaboradora já trabalhou ${consecutiveSundaysWorked} domingo(s) consecutivo(s) (regra quinzenal de 15 dias).`
          : `Bloqueio Dominical: ${consecutiveSundaysWorked} domingos seguidos (limite ${sundayLimitWeeks} antes da folga).`
      );
    }

    const approved =
      interjornadaArt66Ok &&
      dsrArt67Ok &&
      weeklyAndOvertimeArt59Ok &&
      sundayRotationOk;

    if (approved) {
      reasons.push('Apto: cumpre Art. 66, Art. 67, Art. 59 e revezamento dominical.');
    }

    let suitabilityScore = approved ? 60 : 0;
    if (candidate.sectorId === absentEmployee.sectorId) suitabilityScore += 25;
    if (candidate.role === absentEmployee.role) suitabilityScore += 10;
    if (weeklyHoursProjected <= weeklyLimitHours) {
      suitabilityScore += Math.min(5, Math.max(0, weeklyLimitHours - weeklyHoursProjected));
    }

    return {
      candidate,
      approved,
      suitabilityScore: round2(suitabilityScore),
      lastShiftEndedAt,
      interjornadaHours,
      dsrIntervalHours,
      weeklyHoursCurrent,
      weeklyHoursProjected,
      weeklyLimitHours,
      consecutiveSundaysWorked,
      sundayLimitWeeks,
      checks: {
        interjornadaArt66Ok,
        dsrArt67Ok,
        weeklyAndOvertimeArt59Ok,
        sundayRotationOk
      },
      reasons
    };
  });

  return evaluations.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? -1 : 1;
    return b.suitabilityScore - a.suitabilityScore;
  });
}

/* =========================================================
 * Motor 5: HrPayrollLedgerEngine (Art. 58 §1º, Lei 605/49, Art. 130, INSS)
 * ========================================================= */

export function calculateVacationDaysArt130(unjustifiedAbsences: number): number {
  if (unjustifiedAbsences <= 5) return 30;
  if (unjustifiedAbsences <= 14) return 24;
  if (unjustifiedAbsences <= 23) return 18;
  if (unjustifiedAbsences <= 32) return 12;
  return 0;
}

export function calculateDailyToleranceClt(log: AttendanceLog): {
  rawMinutes: number;
  exemptMinutes: number;
  discountableMinutes: number;
} {
  if (log.punchVariations) {
    const diffs = [
      Math.abs(log.punchVariations.entryDiffMin),
      Math.abs(log.punchVariations.lunchOutDiffMin),
      Math.abs(log.punchVariations.lunchInDiffMin),
      Math.abs(log.punchVariations.exitDiffMin)
    ];
    const total = diffs.reduce((acc, v) => acc + v, 0);
    const allWithin5 = diffs.every((v) => v <= 5);
    if (allWithin5 && total <= 10) {
      return { rawMinutes: total, exemptMinutes: total, discountableMinutes: 0 };
    }
    return { rawMinutes: total, exemptMinutes: 0, discountableMinutes: total };
  }

  const raw = Math.max(0, log.lateMinutes) + Math.max(0, log.earlyLeaveMinutes);
  if (log.lateMinutes <= 5 && log.earlyLeaveMinutes <= 5 && raw <= 10) {
    return { rawMinutes: raw, exemptMinutes: raw, discountableMinutes: 0 };
  }
  return { rawMinutes: raw, exemptMinutes: 0, discountableMinutes: raw };
}

export function calculateEmployeeMonthlyLedger(params: {
  employee: Employee;
  month: string; // YYYY-MM
  assignments: ScheduleAssignment[];
  allAttendanceLogs: AttendanceLog[];
  acquisitionPeriodUnjustifiedAbsences?: number;
  customTemplates?: ScaleTemplate[];
}): MonthlyPayrollLedgerRow {
  const scaleTemplate = getScaleTemplate(
    params.employee.scaleCode,
    params.customTemplates
  );

  const monthAssignments = params.assignments.filter(
    (a) => a.employeeId === params.employee.id && a.date.startsWith(params.month)
  );
  const monthLogs = params.allAttendanceLogs.filter(
    (l) => l.employeeId === params.employee.id && l.month === params.month
  );

  const plannedDays = monthAssignments.filter(
    (a) => a.statusCode !== 'F' && a.statusCode !== 'FE'
  ).length;
  const workedDays = monthAssignments.filter(
    (a) => a.statusCode === 'T' || a.statusCode === 'TR'
  ).length;

  // Faltas injustificadas combinando logs explícitos e marcações FA na escala sem duplicar a mesma data
  const unjustifiedDates = new Set<string>();
  for (const log of monthLogs) {
    if (log.unjustifiedAbsence) unjustifiedDates.add(log.date);
  }
  for (const assign of monthAssignments) {
    if (assign.statusCode === 'FA') unjustifiedDates.add(assign.date);
  }
  const unjustifiedAbsences = unjustifiedDates.size;

  const justifiedAbsences = monthLogs.filter((l) => l.justifiedAbsence).length;

  let rawLateMinutes = 0;
  let exemptToleranceMinutes = 0;
  let discountableLateMinutes = 0;
  for (const log of monthLogs) {
    const tol = calculateDailyToleranceClt(log);
    rawLateMinutes += tol.rawMinutes;
    exemptToleranceMinutes += tol.exemptMinutes;
    discountableLateMinutes += tol.discountableMinutes;
  }

  // Lei 605/1949 Art. 6º: perde o DSR da semana em que houver falta injustificada
  const weeksWithUnjustifiedAbsence = new Set<string>();
  for (const d of unjustifiedDates) {
    weeksWithUnjustifiedAbsence.add(getMondayOfWeekIso(d));
  }
  const dsrLostCount = weeksWithUnjustifiedAbsence.size;

  // Férias Art. 130 CLT (usa faltas do período aquisitivo se fornecidas, ou soma histórica do colaborador)
  const totalAcquisitionUnjustified =
    params.acquisitionPeriodUnjustifiedAbsences ??
    Math.max(
      unjustifiedAbsences,
      params.allAttendanceLogs.filter(
        (l) => l.employeeId === params.employee.id && l.unjustifiedAbsence
      ).length
    );
  const vacationDaysEntitledArt130 = calculateVacationDaysArt130(
    totalAcquisitionUnjustified
  );

  // Alerta INSS (> 15 dias de atestado médico em janela móvel de 60 dias)
  const empMedLogs = params.allAttendanceLogs
    .filter(
      (l) =>
        l.employeeId === params.employee.id &&
        l.medicalCertificateDays > 0 &&
        l.month <= params.month
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const medicalDaysInMonth = monthLogs.reduce(
    (acc, l) => acc + l.medicalCertificateDays,
    0
  );

  let medicalDaysRolling60Days = 0;
  for (let i = 0; i < empMedLogs.length; i += 1) {
    const anchor = empMedLogs[i];
    if (!anchor) continue;
    let sumWindow = 0;
    for (let j = i; j < empMedLogs.length; j += 1) {
      const candidate = empMedLogs[j];
      if (!candidate) continue;
      if (diffDaysIso(anchor.date, candidate.date) <= 60) {
        sumWindow += candidate.medicalCertificateDays;
      }
    }
    if (sumWindow > medicalDaysRolling60Days) {
      medicalDaysRolling60Days = sumWindow;
    }
  }

  const inssReferralAlert = medicalDaysRolling60Days > 15;
  const hourlyRate = round2(params.employee.monthlySalary / scaleTemplate.divisor);
  const dsrDailyValue = round2(hourlyRate * scaleTemplate.dailyHours);
  const dsrDeductionValue = round2(dsrLostCount * dsrDailyValue);

  return {
    employeeId: params.employee.id,
    employeeName: params.employee.name,
    sectorId: params.employee.sectorId,
    scaleCode: params.employee.scaleCode,
    divisor: scaleTemplate.divisor,
    month: params.month,
    plannedDays,
    workedDays,
    unjustifiedAbsences,
    justifiedAbsences,
    medicalDaysInMonth,
    medicalDaysRolling60Days,
    inssReferralAlert,
    rawLateMinutes,
    exemptToleranceMinutes,
    discountableLateMinutes,
    dsrLostCount,
    vacationDaysEntitledArt130,
    hourlyRate,
    dsrDeductionValue
  };
}

/* =========================================================
 * Motor 6: BradfordAndCrisisPredictor (Bradford & Alerta Preditivo)
 * ========================================================= */

export function classifyBradfordRisk(score: number): BradfordRiskLevel {
  if (score >= 400) return 'CRITICO';
  if (score >= 125) return 'ALTO';
  if (score > 50) return 'ATENCAO';
  return 'BAIXO';
}

export function calculateBradfordFactor(spellsS: number, totalDaysD: number): number {
  return spellsS * spellsS * totalDaysD;
}

export function calculateWorkforceAnalytics(params: {
  filter: AnalyticsFilter;
  employees: Employee[];
  sectors: Sector[];
  assignments: ScheduleAssignment[];
  attendanceLogs: AttendanceLog[];
  customTemplates?: ScaleTemplate[];
}): WorkforceAnalyticsResult {
  const sectorMap = new Map(params.sectors.map((s) => [s.id, s]));

  const filteredEmployees = params.employees.filter((emp) => {
    if (!emp.active) return false;
    if (params.filter.sectorId !== 'ALL' && emp.sectorId !== params.filter.sectorId) {
      return false;
    }
    if (params.filter.role !== 'ALL' && emp.role !== params.filter.role) {
      return false;
    }
    if (params.filter.scaleCode !== 'ALL' && emp.scaleCode !== params.filter.scaleCode) {
      return false;
    }
    if (params.filter.regime !== 'ALL' && emp.regime !== params.filter.regime) {
      return false;
    }
    if (
      params.filter.shiftCode !== 'ALL' &&
      emp.defaultShiftCode !== params.filter.shiftCode
    ) {
      return false;
    }
    if (params.filter.gender !== 'ALL' && emp.gender !== params.filter.gender) {
      return false;
    }
    if (
      params.filter.employeeId !== 'ALL' &&
      emp.id !== params.filter.employeeId
    ) {
      return false;
    }
    return true;
  });

  const empIdSet = new Set(filteredEmployees.map((e) => e.id));
  const monthFilter = params.filter.periodMonth;

  const filteredAssignments = params.assignments.filter(
    (a) =>
      empIdSet.has(a.employeeId) &&
      (monthFilter === 'ALL' || a.date.startsWith(monthFilter))
  );

  const filteredLogs = params.attendanceLogs.filter(
    (l) =>
      empIdSet.has(l.employeeId) &&
      (monthFilter === 'ALL' || l.month === monthFilter)
  );

  let plannedHours = 0;
  let lostHours = 0;

  for (const emp of filteredEmployees) {
    const tpl = getScaleTemplate(emp.scaleCode, params.customTemplates);
    const empAssigns = filteredAssignments.filter((a) => a.employeeId === emp.id);
    const empLogs = filteredLogs.filter((l) => l.employeeId === emp.id);

    for (const a of empAssigns) {
      if (a.statusCode !== 'F' && a.statusCode !== 'FE') {
        plannedHours += tpl.dailyHours;
      }
      if (a.statusCode === 'FA' || a.statusCode === 'LM') {
        lostHours += tpl.dailyHours;
      }
    }

    // Evita dupla contagem de dias já marcados como FA/LM na escala
    const scaleAbsentDates = new Set(
      empAssigns
        .filter((a) => a.statusCode === 'FA' || a.statusCode === 'LM')
        .map((a) => a.date)
    );

    for (const l of empLogs) {
      if (l.unjustifiedAbsence || l.medicalCertificateDays > 0) {
        const totalLogDays = Math.max(1, l.medicalCertificateDays);
        let uncountedDays = 0;
        for (let k = 0; k < totalLogDays; k += 1) {
          if (!scaleAbsentDates.has(addDaysIso(l.date, k))) {
            uncountedDays += 1;
          }
        }
        lostHours += tpl.dailyHours * uncountedDays;
      } else {
        const tol = calculateDailyToleranceClt(l);
        lostHours += tol.discountableMinutes / 60;
      }
    }
  }

  plannedHours = round2(plannedHours);
  lostHours = round2(lostHours);
  const absenteeismRatePct =
    plannedHours > 0 ? round2((lostHours / plannedHours) * 100) : 0;

  // Fator de Bradford por colaborador: B = S² * D
  const bradfordRanking: EmployeeBradfordScore[] = filteredEmployees
    .map((emp) => {
      const absentDateSet = new Set<string>();
      for (const a of filteredAssignments) {
        if (
          a.employeeId === emp.id &&
          (a.statusCode === 'FA' || a.statusCode === 'LM')
        ) {
          absentDateSet.add(a.date);
        }
      }
      for (const l of filteredLogs) {
        if (l.employeeId !== emp.id) continue;
        if (l.unjustifiedAbsence || l.medicalCertificateDays > 0) {
          absentDateSet.add(l.date);
          if (l.medicalCertificateDays > 1) {
            for (let k = 1; k < l.medicalCertificateDays; k += 1) {
              absentDateSet.add(addDaysIso(l.date, k));
            }
          }
        }
      }

      const sortedDates = Array.from(absentDateSet).sort();
      let spellsS = 0;
      let prevDate: string | null = null;
      for (const dt of sortedDates) {
        if (prevDate === null || diffDaysIso(prevDate, dt) > 1) {
          spellsS += 1;
        }
        prevDate = dt;
      }

      const daysLostD = sortedDates.length;
      const bradfordScore = calculateBradfordFactor(spellsS, daysLostD);

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        sectorId: emp.sectorId,
        role: emp.role,
        scaleCode: emp.scaleCode,
        episodesS: spellsS,
        daysLostD,
        bradfordScore,
        riskLevel: classifyBradfordRisk(bradfordScore)
      };
    })
    .sort((a, b) => b.bradfordScore - a.bradfordScore);

  // Mapa de Calor de Faltas (Seg..Dom x Setor)
  const targetSectors =
    params.filter.sectorId === 'ALL'
      ? params.sectors
      : params.sectors.filter((s) => s.id === params.filter.sectorId);

  const weekdayHeatmap: WeekdaySectorHeatmapCell[] = [];
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

  for (const sector of targetSectors) {
    const sectorEmpIds = new Set(
      filteredEmployees.filter((e) => e.sectorId === sector.id).map((e) => e.id)
    );
    for (const wd of weekdayOrder) {
      const wdAssigns = filteredAssignments.filter(
        (a) =>
          sectorEmpIds.has(a.employeeId) &&
          getWeekdayUtc(a.date) === wd &&
          a.statusCode !== 'F' &&
          a.statusCode !== 'FE'
      );
      const wdLogs = filteredLogs.filter(
        (l) =>
          sectorEmpIds.has(l.employeeId) &&
          getWeekdayUtc(l.date) === wd &&
          (l.unjustifiedAbsence || l.medicalCertificateDays > 0)
      );
      const wdScaleAbsences = wdAssigns.filter(
        (a) => a.statusCode === 'FA' || a.statusCode === 'LM'
      ).length;

      const uniqueAbsentPairs = new Set<string>();
      for (const l of wdLogs) uniqueAbsentPairs.add(`${l.employeeId}|${l.date}`);
      for (const a of wdAssigns) {
        if (a.statusCode === 'FA' || a.statusCode === 'LM') {
          uniqueAbsentPairs.add(`${a.employeeId}|${a.date}`);
        }
      }

      const absenceCount = Math.max(uniqueAbsentPairs.size, wdScaleAbsences);
      const observedRate =
        wdAssigns.length > 0 ? absenceCount / wdAssigns.length : 0;
      const baseHist = sector.historicalAbsenceRateByWeekday[wd] ?? 0;
      const combinedRatePct = round2(Math.max(observedRate, baseHist) * 100);

      weekdayHeatmap.push({
        sectorId: sector.id,
        sectorName: sector.name,
        weekday: wd,
        weekdayLabel: WEEKDAY_SHORT_PT[wd] ?? String(wd),
        absenceRatePct: combinedRatePct,
        absenceCount
      });
    }
  }

  // Alerta Preditivo de Crise de Cobertura
  const distinctDates = Array.from(
    new Set(filteredAssignments.map((a) => a.date))
  ).sort();
  const crisisAlerts: CrisisPredictionAlert[] = [];

  for (const date of distinctDates) {
    const wd = getWeekdayUtc(date);
    for (const sector of targetSectors) {
      const daySectorAssigns = filteredAssignments.filter(
        (a) =>
          a.sectorId === sector.id &&
          a.date === date &&
          (a.statusCode === 'T' || a.statusCode === 'TR')
      );
      const scheduledCount = daySectorAssigns.length;
      if (scheduledCount === 0 && filteredEmployees.every((e) => e.sectorId !== sector.id)) {
        continue;
      }

      const coverageMargin = scheduledCount - sector.minCriticalPresence;
      const heatmapCell = weekdayHeatmap.find(
        (c) => c.sectorId === sector.id && c.weekday === wd
      );
      const histProb =
        (heatmapCell?.absenceRatePct ??
          (sector.historicalAbsenceRateByWeekday[wd] ?? 0.05) * 100) / 100;

      const expectedAbsentHeadcount = round2(scheduledCount * histProb);
      const projectedNetCoverage = round2(scheduledCount - expectedAbsentHeadcount);

      const crisisRisk =
        scheduledCount < sector.minCriticalPresence ||
        projectedNetCoverage < sector.minCriticalPresence ||
        (coverageMargin <= 1 && histProb >= 0.15);

      if (crisisRisk) {
        crisisAlerts.push({
          date,
          weekdayLabel: WEEKDAY_LABELS_PT[wd] ?? String(wd),
          sectorId: sector.id,
          sectorName: sectorMap.get(sector.id)?.name ?? sector.name,
          scheduledCount,
          minRequired: sector.minCriticalPresence,
          coverageMargin,
          historicalAbsenceProbabilityPct: round2(histProb * 100),
          expectedAbsentHeadcount,
          projectedNetCoverage,
          crisisRisk: true,
          alertMessage: 'RISCO DE CRISE: REFORÇAR PLANTÃO'
        });
      }
    }
  }

  return {
    plannedHours,
    lostHours,
    absenteeismRatePct,
    filteredEmployeesCount: filteredEmployees.length,
    bradfordRanking,
    weekdayHeatmap,
    crisisAlerts
  };
}
