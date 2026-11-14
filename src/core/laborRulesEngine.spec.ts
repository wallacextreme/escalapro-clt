import { describe, expect, it } from 'vitest';
import {
  SCALE_PRESETS,
  buildCustomScale,
  calculateBradfordFactor,
  calculateEmployeeMonthlyLedger,
  calculateSectorCoverageMatrix,
  calculateVacationDaysArt130,
  calculateWorkforceAnalytics,
  classifyBradfordRisk,
  evaluateShiftSwapCandidates,
  simulateHeadcountComparison,
  simulateMigration6x1To5x2,
  staggerSectorLunchWindows,
  validateLeaveOrVacationRequest
} from './laborRulesEngine';
import {
  SEED_ATTENDANCE_LOGS,
  SEED_EMPLOYEES,
  SEED_LEAVES,
  SEED_SECTORS,
  SEED_SHIFTS,
  SEED_UNION_RULES
} from '../db/seedData';
import type {
  AttendanceLog,
  Employee,
  LeaveOrVacation,
  ScheduleAssignment
} from '../types/domain';

describe('Motor de Regras Trabalhistas e Sindicais (EscalaPro CLT)', () => {
  it('suporta todas as escalas obrigatórias com divisores corretos (200, 210, 220, 180)', () => {
    expect(SCALE_PRESETS['5x2_40'].divisor).toBe(200);
    expect(SCALE_PRESETS['5x2_42'].divisor).toBe(210);
    expect(SCALE_PRESETS['5x2_44'].divisor).toBe(220);
    expect(SCALE_PRESETS['6x1_44'].divisor).toBe(220);
    expect(SCALE_PRESETS['12x36'].divisor).toBe(200);
    expect(SCALE_PRESETS['12x48'].divisor).toBe(180);
    expect(SCALE_PRESETS['12x48'].weeklyHours).toBe(33.6);
    expect(SCALE_PRESETS['12x48'].requiresUnionAgreement).toBe(true);
  });

  it('constrói escala customizada e simula migração 6x1 -> 5x2 sem redução salarial', () => {
    const custom = buildCustomScale({
      name: 'Escala 4x2 Industrial',
      workDays: 4,
      restDays: 2,
      dailyHours: 9,
      divisor: 200,
      sundayRule: 'MTP671_7WEEKS',
      requiresUnionAgreement: true
    });
    expect(custom.code).toBe('CUSTOM');
    expect(custom.weeklyHours).toBe(42);
    expect(custom.divisor).toBe(200);

    const employees6x1 = SEED_EMPLOYEES.filter((e) => e.scaleCode === '6x1_44');
    const migration = simulateMigration6x1To5x2({
      employeesInScale: employees6x1,
      targetScale: '5x2_40'
    });
    expect(migration.currentDivisor).toBe(220);
    expect(migration.targetDivisor).toBe(200);
    expect(migration.hourlyRateAfter).toBeGreaterThan(migration.hourlyRateBefore);
    expect(migration.hourlyRateIncreasePct).toBeCloseTo(10, 0);
    expect(migration.additionalHeadcountNeeded).toBeGreaterThanOrEqual(1);
  });

  it('Motor 1 (LunchWindowStaggerEngine): escalona almoço entre 12h-13h e 13h-14h sem descobrir o setor', () => {
    const date = '2026-11-16';
    const assignments: ScheduleAssignment[] = [
      {
        id: 'a1',
        employeeId: 'emp-01',
        sectorId: 'sec-vendas',
        date,
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'NONE',
        hoursWorked: 8
      },
      {
        id: 'a2',
        employeeId: 'emp-02',
        sectorId: 'sec-vendas',
        date,
        statusCode: 'T',
        shiftCode: 'C7',
        lunchWindow: 'NONE',
        hoursWorked: 7.33
      },
      {
        id: 'a3',
        employeeId: 'emp-03',
        sectorId: 'sec-vendas',
        date,
        statusCode: 'T',
        shiftCode: 'M84',
        lunchWindow: 'NONE',
        hoursWorked: 8.4
      }
    ];

    const res = staggerSectorLunchWindows({
      date,
      sectorId: 'sec-vendas',
      assignments,
      shifts: SEED_SHIFTS
    });

    expect(res.window1Count).toBe(2);
    expect(res.window2Count).toBe(1);
    expect(res.coverageGuaranteed).toBe(true);
    expect(
      res.updatedAssignments.every((a) => a.lunchWindow !== 'NONE')
    ).toBe(true);
  });

  it('Motor 2 (SectorCollisionDetector): bloqueia dupla ausência setorial sem substituto e aplica trava Art. 134 § 3º CLT', () => {
    const bruno = SEED_EMPLOYEES.find((e) => e.id === 'emp-02')!;
    const existingLeaves: LeaveOrVacation[] = [...SEED_LEAVES]; // emp-01 (sec-vendas) já ausente em 2026-11-18

    // Tentativa de colocar Bruno (sec-vendas) em 2026-11-18 sem substituto
    const collisionBlocked = validateLeaveOrVacationRequest({
      employee: bruno,
      date: '2026-11-18',
      type: 'F',
      existingLeaves,
      employees: SEED_EMPLOYEES
    });
    expect(collisionBlocked.blocked).toBe(true);
    expect(collisionBlocked.code).toBe('SECTOR_COLLISION_GE_2');
    expect(collisionBlocked.message).toContain(
      'BLOQUEADO: COLISÃO SETORIAL >= 2 NO SETOR'
    );

    // Com substituto pré-alocado, permite
    const collisionWithSub = validateLeaveOrVacationRequest({
      employee: bruno,
      date: '2026-11-18',
      type: 'F',
      substituteEmployeeId: 'emp-14',
      existingLeaves,
      employees: SEED_EMPLOYEES
    });
    expect(collisionWithSub.allowed).toBe(true);

    // Trava Art. 134 § 3º CLT: 2026-11-13 é 2 dias antes do feriado/domingo 2026-11-15
    const art134Blocked = validateLeaveOrVacationRequest({
      employee: bruno,
      date: '2026-11-13',
      type: 'FE',
      existingLeaves,
      employees: SEED_EMPLOYEES
    });
    expect(art134Blocked.blocked).toBe(true);
    expect(art134Blocked.code).toBe('ART_134_PAR_3_CLT_DSR_OR_HOLIDAY');
    expect(art134Blocked.message).toContain('ART. 134 § 3º CLT');
  });

  it('Motor 3 (CriticalHourHeatmapEngine): desconta almoço/ausências e compara dimensionamento entre escalas', () => {
    const vendasSector = SEED_SECTORS.find((s) => s.id === 'sec-vendas')!;
    const date = '2026-11-16';
    const assignments: ScheduleAssignment[] = [
      {
        id: 'v1',
        employeeId: 'emp-01',
        sectorId: 'sec-vendas',
        date,
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      {
        id: 'v2',
        employeeId: 'emp-02',
        sectorId: 'sec-vendas',
        date,
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13', // Ambos saem às 12h -> déficit proposital
        hoursWorked: 8
      }
    ];

    const matrix = calculateSectorCoverageMatrix({
      sector: vendasSector,
      date,
      employees: SEED_EMPLOYEES,
      assignments,
      shifts: SEED_SHIFTS
    });

    const hour12 = matrix.hourlyCells.find((c) => c.hour === 12)!;
    expect(hour12.scheduledCount).toBe(2);
    expect(hour12.onLunchCount).toBe(2);
    expect(hour12.activeCount).toBe(0);
    expect(hour12.isDeficit).toBe(true);
    expect(matrix.hasAnyDeficit).toBe(true);

    const sim = simulateHeadcountComparison({
      minDailyCoverage: 2,
      operatingHoursPerDay: 12,
      operatingDaysPerWeek: 7
    });
    expect(sim).toHaveLength(4);
    expect(
      sim.find((r) => r.scaleCode === '12x48')!.requiredTotalHeadcount
    ).toBeGreaterThan(
      sim.find((r) => r.scaleCode === '6x1_44')!.requiredTotalHeadcount
    );
  });

  it('Motor 4 (SingleScreenSwapResolver): valida Art. 66 (11h), Art. 67 (35h), Art. 59 e Art. 386 CLT (mulheres 15 dias)', () => {
    const targetSunday = '2026-11-15';
    const customEmployees: Employee[] = [
      {
        ...SEED_EMPLOYEES[0]!, // Ana (ausente)
        id: 'emp-absent',
        sectorId: 'sec-vendas'
      },
      {
        ...SEED_EMPLOYEES[2]!, // Camila (F) - trabalhou domingo passado -> Bloqueada pelo Art. 386
        id: 'emp-female-blocked',
        name: 'Camila Bloqueada Domingo',
        gender: 'F',
        scaleCode: '5x2_40'
      },
      {
        ...SEED_EMPLOYEES[1]!, // Bruno (M) - trabalhou plantão N12 sábado à noite (termina 07:00 domingo -> interjornada 1h < 11h)
        id: 'emp-interjornada-blocked',
        name: 'Bruno Interjornada Violada',
        gender: 'M',
        scaleCode: '5x2_40'
      },
      {
        ...SEED_EMPLOYEES[5]!, // Felipe (M) - 32h na semana, folga sábado com >35h, elegível
        id: 'emp-valid-sub',
        name: 'Felipe Substituto Apto',
        gender: 'M',
        scaleCode: '5x2_40'
      }
    ];

    const assignments: ScheduleAssignment[] = [
      // Camila trabalhou domingo anterior (2026-11-08)
      {
        id: 'c-prev-sun',
        employeeId: 'emp-female-blocked',
        sectorId: 'sec-vendas',
        date: '2026-11-08',
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      // Bruno trabalhou turno noturno N12 em 2026-11-14 (19:00 -> 07:00 de 15/11)
      {
        id: 'b-night',
        employeeId: 'emp-interjornada-blocked',
        sectorId: 'sec-vendas',
        date: '2026-11-14',
        statusCode: 'T',
        shiftCode: 'N12',
        lunchWindow: 'NIGHT_W1_00_01',
        hoursWorked: 12
      },
      // Felipe trabalhou seg-qui (32h), folgou sexta e sábado (DSR)
      {
        id: 'f-mon',
        employeeId: 'emp-valid-sub',
        sectorId: 'sec-vendas',
        date: '2026-11-09',
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      {
        id: 'f-tue',
        employeeId: 'emp-valid-sub',
        sectorId: 'sec-vendas',
        date: '2026-11-10',
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      {
        id: 'f-wed',
        employeeId: 'emp-valid-sub',
        sectorId: 'sec-vendas',
        date: '2026-11-11',
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      {
        id: 'f-thu',
        employeeId: 'emp-valid-sub',
        sectorId: 'sec-vendas',
        date: '2026-11-12',
        statusCode: 'T',
        shiftCode: 'M8',
        lunchWindow: 'W1_12_13',
        hoursWorked: 8
      },
      {
        id: 'f-sat',
        employeeId: 'emp-valid-sub',
        sectorId: 'sec-vendas',
        date: '2026-11-14',
        statusCode: 'F',
        shiftCode: 'M8',
        lunchWindow: 'NONE',
        hoursWorked: 0
      }
    ];

    const evals = evaluateShiftSwapCandidates({
      targetDate: targetSunday,
      absentEmployeeId: 'emp-absent',
      targetShiftCode: 'M8',
      employees: customEmployees,
      sectors: SEED_SECTORS,
      assignments,
      shifts: SEED_SHIFTS,
      unionRules: SEED_UNION_RULES
    });

    const camila = evals.find((e) => e.candidate.id === 'emp-female-blocked')!;
    expect(camila.approved).toBe(false);
    expect(camila.checks.sundayRotationOk).toBe(false);

    const bruno = evals.find(
      (e) => e.candidate.id === 'emp-interjornada-blocked'
    )!;
    expect(bruno.approved).toBe(false);
    expect(bruno.checks.interjornadaArt66Ok).toBe(false);

    const felipe = evals.find((e) => e.candidate.id === 'emp-valid-sub')!;
    expect(felipe.approved).toBe(true);
    expect(felipe.checks.interjornadaArt66Ok).toBe(true);
    expect(felipe.checks.dsrArt67Ok).toBe(true);
    expect(felipe.checks.weeklyAndOvertimeArt59Ok).toBe(true);
    expect(felipe.checks.sundayRotationOk).toBe(true);
  });

  it('Motor 5 (HrPayrollLedgerEngine): aplica tolerância Art. 58 §1º, desconto DSR Lei 605/49, Art. 130 CLT e alerta INSS', () => {
    // Tabela Progressiva Art. 130 CLT
    expect(calculateVacationDaysArt130(5)).toBe(30);
    expect(calculateVacationDaysArt130(6)).toBe(24);
    expect(calculateVacationDaysArt130(14)).toBe(24);
    expect(calculateVacationDaysArt130(15)).toBe(18);
    expect(calculateVacationDaysArt130(24)).toBe(12);
    expect(calculateVacationDaysArt130(33)).toBe(0);

    // Ricardo (emp-08) possui 10d em out + 7d em nov = 17d em 60d -> ALERTA INSS
    const ricardo = SEED_EMPLOYEES.find((e) => e.id === 'emp-08')!;
    const ricardoLedger = calculateEmployeeMonthlyLedger({
      employee: ricardo,
      month: '2026-11',
      assignments: [],
      allAttendanceLogs: SEED_ATTENDANCE_LOGS
    });
    expect(ricardoLedger.medicalDaysRolling60Days).toBe(17);
    expect(ricardoLedger.inssReferralAlert).toBe(true);

    // Bruno (emp-02): 2 faltas injustificadas em semanas distintas + variação isenta 9 min (4+2+2+1)
    const bruno = SEED_EMPLOYEES.find((e) => e.id === 'emp-02')!;
    const brunoLedger = calculateEmployeeMonthlyLedger({
      employee: bruno,
      month: '2026-11',
      assignments: [],
      allAttendanceLogs: SEED_ATTENDANCE_LOGS
    });
    expect(brunoLedger.unjustifiedAbsences).toBe(2);
    expect(brunoLedger.dsrLostCount).toBe(2);
    expect(brunoLedger.exemptToleranceMinutes).toBe(9);
    expect(brunoLedger.discountableLateMinutes).toBe(0);

    // Diego (emp-04): 4 faltas + 18 min atraso fora da tolerância (18+2+1+0 = 21 min descontáveis)
    const diego = SEED_EMPLOYEES.find((e) => e.id === 'emp-04')!;
    const diegoLogs: AttendanceLog[] = SEED_ATTENDANCE_LOGS;
    const diegoLedger = calculateEmployeeMonthlyLedger({
      employee: diego,
      month: '2026-11',
      assignments: [],
      allAttendanceLogs: diegoLogs
    });
    expect(diegoLedger.discountableLateMinutes).toBe(21);
    expect(diegoLedger.dsrLostCount).toBe(2); // semanas de 02/11 e 09/11
  });

  it('Motor 6 (BradfordAndCrisisPredictor): calcula B = S² * D, aplica filtros e prevê crise de cobertura', () => {
    expect(calculateBradfordFactor(5, 16)).toBe(400);
    expect(classifyBradfordRisk(40)).toBe('BAIXO');
    expect(classifyBradfordRisk(75)).toBe('ATENCAO');
    expect(classifyBradfordRisk(200)).toBe('ALTO');
    expect(classifyBradfordRisk(400)).toBe('CRITICO');

    const diegoOnly = SEED_EMPLOYEES.filter((e) => e.id === 'emp-04');
    const caixaOnly = SEED_SECTORS.filter((s) => s.id === 'sec-caixa');
    const assignments: ScheduleAssignment[] = [
      {
        id: 'cx-1',
        employeeId: 'emp-04',
        sectorId: 'sec-caixa',
        date: '2026-11-02',
        statusCode: 'FA',
        shiftCode: 'C7',
        lunchWindow: 'NONE',
        hoursWorked: 0
      },
      {
        id: 'cx-2',
        employeeId: 'emp-04',
        sectorId: 'sec-caixa',
        date: '2026-11-06',
        statusCode: 'FA',
        shiftCode: 'C7',
        lunchWindow: 'NONE',
        hoursWorked: 0
      },
      {
        id: 'cx-3',
        employeeId: 'emp-04',
        sectorId: 'sec-caixa',
        date: '2026-11-09',
        statusCode: 'FA',
        shiftCode: 'C7',
        lunchWindow: 'NONE',
        hoursWorked: 0
      },
      {
        id: 'cx-4',
        employeeId: 'emp-04',
        sectorId: 'sec-caixa',
        date: '2026-11-13',
        statusCode: 'FA',
        shiftCode: 'C7',
        lunchWindow: 'NONE',
        hoursWorked: 0
      },
      {
        id: 'cx-5',
        employeeId: 'emp-04',
        sectorId: 'sec-caixa',
        date: '2026-11-16',
        statusCode: 'T',
        shiftCode: 'C7',
        lunchWindow: 'W1_12_13',
        hoursWorked: 7.33
      }
    ];

    const analytics = calculateWorkforceAnalytics({
      filter: {
        periodMonth: '2026-11',
        sectorId: 'sec-caixa',
        role: 'ALL',
        scaleCode: 'ALL',
        regime: 'ALL',
        shiftCode: 'ALL',
        gender: 'ALL',
        employeeId: 'ALL'
      },
      employees: diegoOnly,
      sectors: caixaOnly,
      assignments,
      attendanceLogs: SEED_ATTENDANCE_LOGS
    });

    expect(analytics.bradfordRanking[0]!.episodesS).toBe(4);
    expect(analytics.bradfordRanking[0]!.daysLostD).toBe(4);
    expect(analytics.bradfordRanking[0]!.bradfordScore).toBe(64);
    expect(analytics.bradfordRanking[0]!.riskLevel).toBe('ATENCAO');
    expect(analytics.absenteeismRatePct).toBeGreaterThan(50);
    expect(analytics.crisisAlerts.length).toBeGreaterThan(0);
    expect(analytics.crisisAlerts[0]!.alertMessage).toBe(
      'RISCO DE CRISE: REFORÇAR PLANTÃO'
    );
  });
});

