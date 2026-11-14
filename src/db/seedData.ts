import { db } from './database';
import {
  SCALE_PRESETS,
  getWeekdayUtc,
  staggerSectorLunchWindows
} from '../core/laborRulesEngine';
import { computeSha256Hex } from './syncEngine';
import type {
  AttendanceLog,
  Employee,
  LeaveOrVacation,
  LunchWindowId,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  ShiftSwapRecord,
  StatusCode,
  UnionRule
} from '../types/domain';

export const SEED_MONTH = '2026-11';
export const DEFAULT_ACTIVE_DATE = '2026-11-16';

export const SEED_SECTORS: Sector[] = [
  {
    id: 'sec-vendas',
    name: 'Vendas Balcão',
    minCriticalPresence: 2,
    isCommerce: true,
    operatingStartHour: 8,
    operatingEndHour: 20,
    historicalAbsenceRateByWeekday: { 0: 0.14, 1: 0.22, 2: 0.06, 3: 0.05, 4: 0.06, 5: 0.18, 6: 0.12 }
  },
  {
    id: 'sec-caixa',
    name: 'Caixa/PDV',
    minCriticalPresence: 2,
    isCommerce: true,
    operatingStartHour: 8,
    operatingEndHour: 20,
    historicalAbsenceRateByWeekday: { 0: 0.16, 1: 0.18, 2: 0.07, 3: 0.06, 4: 0.07, 5: 0.19, 6: 0.14 }
  },
  {
    id: 'sec-estoque',
    name: 'Estoque/Expedição',
    minCriticalPresence: 2,
    isCommerce: false,
    operatingStartHour: 8,
    operatingEndHour: 18,
    historicalAbsenceRateByWeekday: { 0: 0.04, 1: 0.24, 2: 0.08, 3: 0.07, 4: 0.09, 5: 0.2, 6: 0.08 }
  },
  {
    id: 'sec-logistica',
    name: 'Entregas/Logística',
    minCriticalPresence: 1,
    isCommerce: false,
    operatingStartHour: 8,
    operatingEndHour: 19,
    historicalAbsenceRateByWeekday: { 0: 0.05, 1: 0.15, 2: 0.07, 3: 0.06, 4: 0.07, 5: 0.14, 6: 0.1 }
  },
  {
    id: 'sec-suporte',
    name: 'Suporte Técnico',
    minCriticalPresence: 1,
    isCommerce: false,
    operatingStartHour: 7,
    operatingEndHour: 20,
    historicalAbsenceRateByWeekday: { 0: 0.08, 1: 0.12, 2: 0.05, 3: 0.04, 4: 0.06, 5: 0.11, 6: 0.09 }
  },
  {
    id: 'sec-admin',
    name: 'Administração',
    minCriticalPresence: 1,
    isCommerce: false,
    operatingStartHour: 8,
    operatingEndHour: 18,
    historicalAbsenceRateByWeekday: { 0: 0.02, 1: 0.07, 2: 0.04, 3: 0.03, 4: 0.04, 5: 0.08, 6: 0.03 }
  }
];

export const SEED_SHIFTS: ShiftDefinition[] = [
  {
    id: 'sh-m8',
    code: 'M8',
    label: 'Comercial Manhã (08:00-17:00)',
    startTime: '08:00',
    endTime: '17:00',
    durationHours: 8,
    isOvernight: false
  },
  {
    id: 'sh-t8',
    code: 'T8',
    label: 'Comercial Tarde (11:00-20:00)',
    startTime: '11:00',
    endTime: '20:00',
    durationHours: 8,
    isOvernight: false
  },
  {
    id: 'sh-c7',
    code: 'C7',
    label: 'Jornada 6x1 (08:00-16:20)',
    startTime: '08:00',
    endTime: '16:20',
    durationHours: 7.33,
    isOvernight: false
  },
  {
    id: 'sh-p12d',
    code: 'D12',
    label: 'Plantão Diurno 12h (07:00-19:00)',
    startTime: '07:00',
    endTime: '19:00',
    durationHours: 12,
    isOvernight: false
  },
  {
    id: 'sh-p12n',
    code: 'N12',
    label: 'Plantão Noturno 12h (19:00-07:00)',
    startTime: '19:00',
    endTime: '07:00',
    durationHours: 12,
    isOvernight: true
  },
  {
    id: 'sh-i84',
    code: 'M84',
    label: 'Transição 42h (08:00-17:24)',
    startTime: '08:00',
    endTime: '17:24',
    durationHours: 8.4,
    isOvernight: false
  }
];

export const SEED_UNION_RULES: UnionRule[] = [
  {
    id: 'act-comercio-2026',
    instrumentType: 'CCT',
    code: 'CCT-SEAC-2026',
    unionName: 'Sindicato dos Empregados no Comércio',
    description:
      'Autoriza revezamento dominical 2x1 no comércio e transição gradual 6x1 -> 5x2.',
    validUntil: '2027-12-31',
    authorizes12x36: true,
    authorizes12x48: false,
    sundayFrequencyWeeks: 3
  },
  {
    id: 'act-tecnico-2026',
    instrumentType: 'ACT',
    code: 'ACT-SINTTEL-12X48',
    unionName: 'Sindicato dos Técnicos de Suporte & Logística',
    description:
      'Acordo Coletivo específico autorizando jornada 12x48 (divisor 180) e 12x36 com folga compensatória mensal EC 141/2026.',
    validUntil: '2027-06-30',
    authorizes12x36: true,
    authorizes12x48: true,
    sundayFrequencyWeeks: 2
  }
];

export const SEED_EMPLOYEES: Employee[] = [
  // Vendas Balcão (3)
  {
    id: 'emp-01',
    registration: 'MAT-1001',
    name: 'Ana Paula Ribeiro',
    sectorId: 'sec-vendas',
    role: 'Consultora de Vendas Pleno',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'F',
    hourlySalaryBase: 14.5,
    monthlySalary: 2900,
    admissionDate: '2022-03-14',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  {
    id: 'emp-02',
    registration: 'MAT-1002',
    name: 'Bruno Henrique Costa',
    sectorId: 'sec-vendas',
    role: 'Consultor de Vendas',
    scaleCode: '6x1_44',
    regime: 'ROTATIVO',
    defaultShiftCode: 'C7',
    gender: 'M',
    hourlySalaryBase: 11.82,
    monthlySalary: 2600,
    admissionDate: '2023-07-01',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  {
    id: 'emp-03',
    registration: 'MAT-1003',
    name: 'Camila Souza Martins',
    sectorId: 'sec-vendas',
    role: 'Consultora de Vendas Sênior',
    scaleCode: '5x2_42',
    regime: 'FIXO',
    defaultShiftCode: 'M84',
    gender: 'F',
    hourlySalaryBase: 15.24,
    monthlySalary: 3200,
    admissionDate: '2021-01-18',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  // Caixa/PDV (3)
  {
    id: 'emp-04',
    registration: 'MAT-1004',
    name: 'Diego Ferreira Lima',
    sectorId: 'sec-caixa',
    role: 'Operador de Caixa',
    scaleCode: '6x1_44',
    regime: 'ROTATIVO',
    defaultShiftCode: 'C7',
    gender: 'M',
    hourlySalaryBase: 10.45,
    monthlySalary: 2300,
    admissionDate: '2024-02-05',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  {
    id: 'emp-05',
    registration: 'MAT-1005',
    name: 'Eduarda Nascimento Silva',
    sectorId: 'sec-caixa',
    role: 'Operadora de Caixa Líder',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'T8',
    gender: 'F',
    hourlySalaryBase: 13.75,
    monthlySalary: 2750,
    admissionDate: '2020-09-10',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  {
    id: 'emp-06',
    registration: 'MAT-1006',
    name: 'Felipe Augusto Rocha',
    sectorId: 'sec-caixa',
    role: 'Operador de Caixa',
    scaleCode: '5x2_42',
    regime: 'ROTATIVO',
    defaultShiftCode: 'M84',
    gender: 'M',
    hourlySalaryBase: 11.43,
    monthlySalary: 2400,
    admissionDate: '2023-11-20',
    active: true,
    unionRuleId: 'act-comercio-2026'
  },
  // Estoque/Expedição (3)
  {
    id: 'emp-07',
    registration: 'MAT-1007',
    name: 'Gabriela Mendes Oliveira',
    sectorId: 'sec-estoque',
    role: 'Conferente de Estoque',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'F',
    hourlySalaryBase: 14.0,
    monthlySalary: 2800,
    admissionDate: '2021-06-07',
    active: true
  },
  {
    id: 'emp-08',
    registration: 'MAT-1008',
    name: 'Ricardo Almeida Nogueira',
    sectorId: 'sec-estoque',
    role: 'Auxiliar de Expedição',
    scaleCode: '6x1_44',
    regime: 'FIXO',
    defaultShiftCode: 'C7',
    gender: 'M',
    hourlySalaryBase: 10.23,
    monthlySalary: 2250,
    admissionDate: '2022-08-12',
    active: true
  },
  {
    id: 'emp-09',
    registration: 'MAT-1009',
    name: 'Isabela Castro Duarte',
    sectorId: 'sec-estoque',
    role: 'Analista de Inventário',
    scaleCode: '5x2_44',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'F',
    hourlySalaryBase: 13.64,
    monthlySalary: 3000,
    admissionDate: '2020-04-22',
    active: true
  },
  // Entregas/Logística (2)
  {
    id: 'emp-10',
    registration: 'MAT-1010',
    name: 'João Victor Barbosa',
    sectorId: 'sec-logistica',
    role: 'Motorista Entregador',
    scaleCode: '12x36',
    regime: 'ROTATIVO',
    defaultShiftCode: 'D12',
    gender: 'M',
    hourlySalaryBase: 16.5,
    monthlySalary: 3300,
    admissionDate: '2021-10-04',
    active: true,
    unionRuleId: 'act-tecnico-2026'
  },
  {
    id: 'emp-11',
    registration: 'MAT-1011',
    name: 'Larissa Teixeira Moura',
    sectorId: 'sec-logistica',
    role: 'Despachante Logística',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'F',
    hourlySalaryBase: 15.0,
    monthlySalary: 3000,
    admissionDate: '2022-05-16',
    active: true
  },
  // Suporte Técnico (2)
  {
    id: 'emp-12',
    registration: 'MAT-1012',
    name: 'Marcos Vinícius Prado',
    sectorId: 'sec-suporte',
    role: 'Técnico Plantonista N2',
    scaleCode: '12x48',
    regime: 'ROTATIVO',
    defaultShiftCode: 'D12',
    gender: 'M',
    hourlySalaryBase: 21.11,
    monthlySalary: 3800,
    admissionDate: '2019-11-01',
    active: true,
    unionRuleId: 'act-tecnico-2026'
  },
  {
    id: 'emp-13',
    registration: 'MAT-1013',
    name: 'Natália Gomes Cardozo',
    sectorId: 'sec-suporte',
    role: 'Técnica Plantonista Noturna',
    scaleCode: '12x36',
    regime: 'ROTATIVO',
    defaultShiftCode: 'N12',
    gender: 'F',
    hourlySalaryBase: 19.5,
    monthlySalary: 3900,
    admissionDate: '2021-02-09',
    active: true,
    unionRuleId: 'act-tecnico-2026'
  },
  // Administração (2)
  {
    id: 'emp-14',
    registration: 'MAT-1014',
    name: 'Otávio Henrique Borges',
    sectorId: 'sec-admin',
    role: 'Coordenador de RH & DP',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'M',
    hourlySalaryBase: 26.0,
    monthlySalary: 5200,
    admissionDate: '2018-07-15',
    active: true
  },
  {
    id: 'emp-15',
    registration: 'MAT-1015',
    name: 'Patrícia Azevedo Farias',
    sectorId: 'sec-admin',
    role: 'Assistente Administrativo',
    scaleCode: '5x2_40',
    regime: 'FIXO',
    defaultShiftCode: 'M8',
    gender: 'F',
    hourlySalaryBase: 14.25,
    monthlySalary: 2850,
    admissionDate: '2023-03-06',
    active: true
  }
];

function generateMonthlyAssignments(): ScheduleAssignment[] {
  const raw: ScheduleAssignment[] = [];
  const shiftHoursMap: Record<string, number> = {
    M8: 8,
    T8: 8,
    C7: 7.33,
    D12: 12,
    N12: 12,
    M84: 8.4
  };

  for (let day = 1; day <= 30; day += 1) {
    const date = `${SEED_MONTH}-${String(day).padStart(2, '0')}`;
    const wd = getWeekdayUtc(date); // 0=Dom .. 6=Sab

    for (const emp of SEED_EMPLOYEES) {
      let statusCode: StatusCode = 'T';
      let shiftCode = emp.defaultShiftCode;

      if (emp.scaleCode === '5x2_40' || emp.scaleCode === '5x2_42' || emp.scaleCode === '5x2_44') {
        if (emp.id === 'emp-01') {
          // Folga domingo e quarta-feira (comercio alternado) + folga programada 2026-11-18
          if (wd === 0 || wd === 3 || date === '2026-11-18') statusCode = 'F';
        } else if (emp.id === 'emp-05') {
          // Trabalha domingo 08 e 22 (revezamento quinzenal Art. 386 CLT), folga terça e domingo alternado
          if (wd === 2 || (wd === 0 && (day === 1 || day === 15 || day === 29))) {
            statusCode = 'F';
          }
        } else if (wd === 0 || wd === 6) {
          statusCode = 'F';
        }
      } else if (emp.scaleCode === '6x1_44') {
        // 6x1: folga no domingo, exceto emp-02 folga quarta e trabalha domingo 15
        if (emp.id === 'emp-02') {
          statusCode = day === 4 || day === 11 || day === 22 || day === 25 ? 'F' : 'T';
        } else {
          statusCode = wd === 0 ? 'F' : 'T';
        }
      } else if (emp.scaleCode === '12x36') {
        // 12x36: dias pares vs ímpares + folga extra mensal EC 141/2026
        if (emp.id === 'emp-10') {
          statusCode = day % 2 === 1 || day === 20 ? 'F' : 'T';
        } else {
          statusCode = day % 2 === 0 || day === 19 ? 'F' : 'T';
        }
      } else if (emp.scaleCode === '12x48') {
        // 12x48: trabalha 1 dia, folga 2 dias (ciclo de 3 dias)
        statusCode = day % 3 === 1 ? 'T' : 'F';
      }

      // Cenários realistas de absenteísmo & INSS em 2026-11
      // Diego (emp-04): várias faltas injustificadas em segundas/sextas (Bradford Crítico)
      if (
        emp.id === 'emp-04' &&
        (date === '2026-11-02' ||
          date === '2026-11-06' ||
          date === '2026-11-09' ||
          date === '2026-11-13')
      ) {
        statusCode = 'FA';
      }

      // Ricardo (emp-08): 7 dias consecutivos de atestado em novembro (que somados a 10 dias em out = 17 dias -> Alerta INSS)
      if (emp.id === 'emp-08' && day >= 9 && day <= 15) {
        statusCode = wd === 0 ? 'F' : 'LM';
      }

      // Bruno (emp-02): 2 faltas isoladas para demonstrar Bradford Atenção/Alto
      if (emp.id === 'emp-02' && (date === '2026-11-06' || date === '2026-11-13')) {
        statusCode = 'FA';
      }

      // Camila (emp-03): 1 licença legal Art. 473 CLT em 2026-11-10
      if (emp.id === 'emp-03' && date === '2026-11-10') {
        statusCode = 'LP';
      }

      const hoursWorked =
        statusCode === 'T' ? shiftHoursMap[shiftCode] ?? 8 : 0;

      const lunchWindow: LunchWindowId = 'NONE';
      raw.push({
        id: `asg-${emp.id}-${date}`,
        employeeId: emp.id,
        sectorId: emp.sectorId,
        date,
        statusCode,
        shiftCode,
        lunchWindow,
        hoursWorked
      });
    }
  }

  // Escalonar automaticamente janelas de almoço (Art. 71 CLT) em todos os dias e setores
  let staggered = raw;
  for (let day = 1; day <= 30; day += 1) {
    const date = `${SEED_MONTH}-${String(day).padStart(2, '0')}`;
    for (const sector of SEED_SECTORS) {
      const res = staggerSectorLunchWindows({
        date,
        sectorId: sector.id,
        assignments: staggered,
        shifts: SEED_SHIFTS
      });
      staggered = res.updatedAssignments;
    }
  }

  return staggered;
}

export const SEED_LEAVES: LeaveOrVacation[] = [
  {
    id: 'lv-seed-01',
    employeeId: 'emp-01',
    sectorId: 'sec-vendas',
    date: '2026-11-18',
    type: 'F',
    approved: true,
    reason: 'DSR Programado / Folga Setorial Escalonada',
    createdAt: '2026-11-01T09:00:00.000Z'
  },
  {
    id: 'lv-seed-02',
    employeeId: 'emp-08',
    sectorId: 'sec-estoque',
    date: '2026-11-10',
    type: 'LM',
    approved: true,
    reason: 'Atestado Médico Ortopédico (7 dias)',
    createdAt: '2026-11-10T08:30:00.000Z'
  },
  {
    id: 'lv-seed-03',
    employeeId: 'emp-03',
    sectorId: 'sec-vendas',
    date: '2026-11-10',
    type: 'LP',
    approved: true,
    reason: 'Licença Legal Art. 473 CLT (Doação de Sangue)',
    createdAt: '2026-11-09T14:00:00.000Z'
  }
];

export const SEED_ATTENDANCE_LOGS: AttendanceLog[] = [
  // Ricardo (emp-08): 10 dias em Outubro + 7 dias em Novembro = 17 dias em < 60 dias -> ALERTA INSS
  {
    id: 'att-08-oct',
    employeeId: 'emp-08',
    month: '2026-10',
    date: '2026-10-12',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: false,
    justifiedAbsence: true,
    medicalCertificateDays: 10,
    notes: 'Atestado médico pós-operatório (10 dias)'
  },
  {
    id: 'att-08-nov',
    employeeId: 'emp-08',
    month: '2026-11',
    date: '2026-11-09',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: false,
    justifiedAbsence: true,
    medicalCertificateDays: 7,
    notes: 'Prorrogação de atestado (7 dias) — soma 17 dias em 60 dias'
  },
  // Diego (emp-04): 4 faltas injustificadas isoladas em semanas diferentes + atraso acima da tolerância
  {
    id: 'att-04-01',
    employeeId: 'emp-04',
    month: '2026-11',
    date: '2026-11-02',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada na segunda-feira'
  },
  {
    id: 'att-04-02',
    employeeId: 'emp-04',
    month: '2026-11',
    date: '2026-11-06',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada na sexta-feira'
  },
  {
    id: 'att-04-03',
    employeeId: 'emp-04',
    month: '2026-11',
    date: '2026-11-09',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada na segunda-feira'
  },
  {
    id: 'att-04-04',
    employeeId: 'emp-04',
    month: '2026-11',
    date: '2026-11-13',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada na sexta-feira'
  },
  {
    id: 'att-04-05',
    employeeId: 'emp-04',
    month: '2026-11',
    date: '2026-11-11',
    lateMinutes: 18,
    earlyLeaveMinutes: 0,
    punchVariations: { entryDiffMin: 18, lunchOutDiffMin: 2, lunchInDiffMin: 1, exitDiffMin: 0 },
    unjustifiedAbsence: false,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Atraso de 18 min (acima da tolerância Art. 58 § 1º CLT)'
  },
  // Bruno (emp-02): 2 faltas injustificadas + 1 batida dentro da tolerância CLT (4+2+2+1 = 9 <= 10 min)
  {
    id: 'att-02-01',
    employeeId: 'emp-02',
    month: '2026-11',
    date: '2026-11-06',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada'
  },
  {
    id: 'att-02-02',
    employeeId: 'emp-02',
    month: '2026-11',
    date: '2026-11-13',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: true,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Falta injustificada'
  },
  {
    id: 'att-02-03',
    employeeId: 'emp-02',
    month: '2026-11',
    date: '2026-11-12',
    lateMinutes: 4,
    earlyLeaveMinutes: 2,
    punchVariations: { entryDiffMin: 4, lunchOutDiffMin: 2, lunchInDiffMin: 2, exitDiffMin: 1 },
    unjustifiedAbsence: false,
    justifiedAbsence: false,
    medicalCertificateDays: 0,
    notes: 'Variação total de 9 min (isento pela tolerância Art. 58 § 1º CLT)'
  },
  // Camila (emp-03): 1 licença legal + variação isenta
  {
    id: 'att-03-01',
    employeeId: 'emp-03',
    month: '2026-11',
    date: '2026-11-10',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    unjustifiedAbsence: false,
    justifiedAbsence: true,
    medicalCertificateDays: 0,
    notes: 'Licença Art. 473 CLT — Doação voluntária de sangue'
  }
];

export const SEED_SWAPS: ShiftSwapRecord[] = [
  {
    id: 'swp-seed-01',
    date: '2026-11-14',
    sectorId: 'sec-caixa',
    absentEmployeeId: 'emp-04',
    substituteEmployeeId: 'emp-05',
    reason: 'Troca preventiva de cobertura no Caixa/PDV',
    interjornadaHours: 14,
    dsrIntervalHours: 38,
    weeklyHoursAfterSwap: 40,
    sundayRuleCompliant: true,
    createdAt: '2026-11-13T18:00:00.000Z'
  }
];

export async function ensureSeedDatabase(forceReset = false): Promise<void> {
  const empCount = await db.employees.count();
  if (!forceReset && empCount > 0) return;

  const assignments = generateMonthlyAssignments();
  const scaleTemplates: ScaleTemplate[] = Object.values(SCALE_PRESETS);
  const seedHash = await computeSha256Hex(`SEED:${SEED_MONTH}:15_EMPLOYEES`);

  await db.transaction(
    'rw',
    [
      db.employees,
      db.sectors,
      db.scaleTemplates,
      db.shifts,
      db.scheduleAssignments,
      db.leavesAndVacations,
      db.shiftSwaps,
      db.attendanceLogs,
      db.unionRules,
      db.auditLogs,
      db.syncQueue
    ],
    async () => {
      if (forceReset) {
        await Promise.all([
          db.employees.clear(),
          db.sectors.clear(),
          db.scaleTemplates.clear(),
          db.shifts.clear(),
          db.scheduleAssignments.clear(),
          db.leavesAndVacations.clear(),
          db.shiftSwaps.clear(),
          db.attendanceLogs.clear(),
          db.unionRules.clear(),
          db.auditLogs.clear(),
          db.syncQueue.clear()
        ]);
      }

      await db.sectors.bulkPut(SEED_SECTORS);
      await db.scaleTemplates.bulkPut(scaleTemplates);
      await db.shifts.bulkPut(SEED_SHIFTS);
      await db.unionRules.bulkPut(SEED_UNION_RULES);
      await db.employees.bulkPut(SEED_EMPLOYEES);
      await db.scheduleAssignments.bulkPut(assignments);
      await db.leavesAndVacations.bulkPut(SEED_LEAVES);
      await db.shiftSwaps.bulkPut(SEED_SWAPS);
      await db.attendanceLogs.bulkPut(SEED_ATTENDANCE_LOGS);
      await db.auditLogs.put({
        id: 'aud-seed-init',
        timestamp: '2026-11-01T08:00:00.000Z',
        actor: 'Sistema EscalaPro CLT',
        action: 'SEED_DATABASE',
        entity: 'database',
        entityId: 'escalapro-v2',
        summary: 'Carga inicial com 15 colaboradores em 6 setores e conformidade EC 141/2026.',
        payloadHash: seedHash
      });
    }
  );
}
