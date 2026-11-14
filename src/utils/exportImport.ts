import * as XLSX from 'xlsx';
import { db } from '../db/database';
import {
  calculateEmployeeMonthlyLedger,
  calculateSectorCoverageMatrix,
  calculateWorkforceAnalytics,
  SCALE_PRESETS
} from '../core/laborRulesEngine';
import { recordDualWriteMutation } from '../db/syncEngine';
import type {
  AnalyticsFilter,
  AttendanceLog,
  Employee,
  LeaveOrVacation,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  ShiftSwapRecord,
  StatusCode,
  UnionRule
} from '../types/domain';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportWorkbook7TabsXlsx(params: {
  month: string;
  referenceDate: string;
  employees: Employee[];
  sectors: Sector[];
  shifts: ShiftDefinition[];
  assignments: ScheduleAssignment[];
  leaves: LeaveOrVacation[];
  swaps: ShiftSwapRecord[];
  attendanceLogs: AttendanceLog[];
  scaleTemplates: ScaleTemplate[];
  unionRules: UnionRule[];
}): Promise<void> {
  const wb = XLSX.utils.book_new();
  const sectorMap = new Map(params.sectors.map((s) => [s.id, s.name]));
  const empMap = new Map(params.employees.map((e) => [e.id, e]));

  // Aba 1: 1_Mapeamento_Turnos
  const monthAssignments = params.assignments.filter((a) =>
    a.date.startsWith(params.month)
  );
  const tab1Data = monthAssignments.map((a) => {
    const emp = empMap.get(a.employeeId);
    return {
      Data: a.date,
      Matricula: emp?.registration ?? '',
      Colaborador: emp?.name ?? a.employeeId,
      Setor: sectorMap.get(a.sectorId) ?? a.sectorId,
      Escala: emp?.scaleCode ?? '',
      Regime: emp?.regime ?? '',
      Turno: a.shiftCode,
      Codigo: a.statusCode,
      JanelaAlmoco: a.lunchWindow,
      HorasPrevistas: a.hoursWorked
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab1Data),
    '1_Mapeamento_Turnos'
  );

  // Aba 2: 2_Folgas_Ferias
  const tab2Data = params.leaves.map((l) => ({
    Data: l.date,
    Colaborador: empMap.get(l.employeeId)?.name ?? l.employeeId,
    Setor: sectorMap.get(l.sectorId) ?? l.sectorId,
    Tipo: l.type,
    Substituto: l.substituteEmployeeId
      ? empMap.get(l.substituteEmployeeId)?.name ?? l.substituteEmployeeId
      : 'Sem substituto',
    Motivo: l.reason,
    Aprovado: l.approved ? 'SIM' : 'NAO'
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab2Data),
    '2_Folgas_Ferias'
  );

  // Aba 3: 3_Matriz_Cobertura
  const tab3Data: Array<Record<string, string | number>> = [];
  for (const sector of params.sectors) {
    const matrix = calculateSectorCoverageMatrix({
      sector,
      date: params.referenceDate,
      employees: params.employees,
      assignments: params.assignments,
      shifts: params.shifts
    });
    for (const cell of matrix.hourlyCells) {
      tab3Data.push({
        Data: params.referenceDate,
        Setor: sector.name,
        FaixaHoraria: cell.label,
        Escalados: cell.scheduledCount,
        EmAlmoco: cell.onLunchCount,
        AtivosNoPosto: cell.activeCount,
        MinimoCritico: cell.minRequired,
        Deficit: cell.deficit,
        Status: cell.isDeficit ? 'DEFICIT' : 'OK'
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab3Data),
    '3_Matriz_Cobertura'
  );

  // Aba 4: 4_Trocas_Substituicoes
  const tab4Data = params.swaps.map((s) => ({
    Data: s.date,
    Setor: sectorMap.get(s.sectorId) ?? s.sectorId,
    Ausente: empMap.get(s.absentEmployeeId)?.name ?? s.absentEmployeeId,
    Substituto: empMap.get(s.substituteEmployeeId)?.name ?? s.substituteEmployeeId,
    InterjornadaHoras: s.interjornadaHours,
    IntervaloDSRHoras: s.dsrIntervalHours,
    HorasSemanaPosTroca: s.weeklyHoursAfterSwap,
    ConformidadeDominical: s.sundayRuleCompliant ? 'CONFORME' : 'ALERTA',
    Motivo: s.reason
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab4Data),
    '4_Trocas_Substituicoes'
  );

  // Aba 5: 5_Prontuario_RH
  const tab5Data = params.employees.map((emp) => {
    const ledger = calculateEmployeeMonthlyLedger({
      employee: emp,
      month: params.month,
      assignments: params.assignments,
      allAttendanceLogs: params.attendanceLogs,
      customTemplates: params.scaleTemplates
    });
    return {
      Matricula: emp.registration,
      Colaborador: emp.name,
      Setor: sectorMap.get(emp.sectorId) ?? emp.sectorId,
      Escala: emp.scaleCode,
      Divisor: ledger.divisor,
      DiasTrabalhados: ledger.workedDays,
      FaltasInjustificadas: ledger.unjustifiedAbsences,
      DSRsDescontados: ledger.dsrLostCount,
      ValorDescontoDSR: ledger.dsrDeductionValue,
      MinutosIsentosArt58: ledger.exemptToleranceMinutes,
      MinutosDescontaveis: ledger.discountableLateMinutes,
      Atestado60Dias: ledger.medicalDaysRolling60Days,
      AlertaINSS: ledger.inssReferralAlert ? 'SIM (>15d)' : 'NAO',
      FeriasDireitoArt130: ledger.vacationDaysEntitledArt130
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab5Data),
    '5_Prontuario_RH'
  );

  // Aba 6: 6_Analytics_Bradford
  const defaultFilter: AnalyticsFilter = {
    periodMonth: params.month,
    sectorId: 'ALL',
    role: 'ALL',
    scaleCode: 'ALL',
    regime: 'ALL',
    shiftCode: 'ALL',
    gender: 'ALL',
    employeeId: 'ALL'
  };
  const analytics = calculateWorkforceAnalytics({
    filter: defaultFilter,
    employees: params.employees,
    sectors: params.sectors,
    assignments: params.assignments,
    attendanceLogs: params.attendanceLogs,
    customTemplates: params.scaleTemplates
  });
  const tab6Data = analytics.bradfordRanking.map((b) => ({
    Colaborador: b.employeeName,
    Setor: sectorMap.get(b.sectorId) ?? b.sectorId,
    Cargo: b.role,
    Escala: b.scaleCode,
    Episodios_S: b.episodesS,
    DiasPerdidos_D: b.daysLostD,
    FatorBradford: b.bradfordScore,
    Risco: b.riskLevel,
    TaxaAbsenteismoGeralPct: analytics.absenteeismRatePct
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab6Data),
    '6_Analytics_Bradford'
  );

  // Aba 7: 7_Regras_Escalas
  const allTemplates =
    params.scaleTemplates.length > 0
      ? params.scaleTemplates
      : Object.values(SCALE_PRESETS);
  const tab7Data = allTemplates.map((t) => ({
    Codigo: t.code,
    Nome: t.name,
    DiasTrabalho: t.workDays,
    DiasFolga: t.restDays,
    HorasDia: t.dailyHours,
    HorasSemana: t.weeklyHours,
    Divisor: t.divisor,
    RegraDomingo: t.sundayRule,
    ExigeACT_CCT: t.requiresUnionAgreement ? 'SIM' : 'NAO',
    BaseLegal: t.legalReference
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(tab7Data),
    '7_Regras_Escalas'
  );

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  triggerDownload(
    new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    `EscalaPro_CLT_${params.month}.xlsx`
  );
}

export function exportAssignmentsCsv(params: {
  month: string;
  employees: Employee[];
  sectors: Sector[];
  assignments: ScheduleAssignment[];
}): void {
  const empMap = new Map(params.employees.map((e) => [e.id, e]));
  const sectorMap = new Map(params.sectors.map((s) => [s.id, s.name]));
  const rows = params.assignments
    .filter((a) => a.date.startsWith(params.month))
    .sort((a, b) => a.date.localeCompare(b.date));

  const header =
    'id;date;registration;employeeName;sectorName;shiftCode;statusCode;lunchWindow;hoursWorked';
  const lines = rows.map((r) => {
    const emp = empMap.get(r.employeeId);
    const sectorName = sectorMap.get(r.sectorId) ?? r.sectorId;
    return [
      r.id,
      r.date,
      emp?.registration ?? '',
      `"${(emp?.name ?? r.employeeId).replace(/"/g, '""')}"`,
      `"${sectorName.replace(/"/g, '""')}"`,
      r.shiftCode,
      r.statusCode,
      r.lunchWindow,
      r.hoursWorked
    ].join(';');
  });

  const csvContent = `\uFEFF${header}\n${lines.join('\n')}`;
  triggerDownload(
    new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
    `EscalaPro_CLT_${params.month}.csv`
  );
}

export async function exportFullBackupJson(): Promise<void> {
  const backup = {
    schemaVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    employees: await db.employees.toArray(),
    sectors: await db.sectors.toArray(),
    scaleTemplates: await db.scaleTemplates.toArray(),
    shifts: await db.shifts.toArray(),
    scheduleAssignments: await db.scheduleAssignments.toArray(),
    leavesAndVacations: await db.leavesAndVacations.toArray(),
    shiftSwaps: await db.shiftSwaps.toArray(),
    attendanceLogs: await db.attendanceLogs.toArray(),
    unionRules: await db.unionRules.toArray()
  };

  triggerDownload(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `EscalaPro_CLT_Backup_${new Date().toISOString().slice(0, 10)}.json`
  );
}

export async function importBackupOrSpreadsheetFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<{
      employees: Employee[];
      sectors: Sector[];
      scaleTemplates: ScaleTemplate[];
      shifts: ShiftDefinition[];
      scheduleAssignments: ScheduleAssignment[];
      leavesAndVacations: LeaveOrVacation[];
      shiftSwaps: ShiftSwapRecord[];
      attendanceLogs: AttendanceLog[];
      unionRules: UnionRule[];
    }>;

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
        db.unionRules
      ],
      async () => {
        if (parsed.sectors?.length) await db.sectors.bulkPut(parsed.sectors);
        if (parsed.scaleTemplates?.length)
          await db.scaleTemplates.bulkPut(parsed.scaleTemplates);
        if (parsed.shifts?.length) await db.shifts.bulkPut(parsed.shifts);
        if (parsed.unionRules?.length)
          await db.unionRules.bulkPut(parsed.unionRules);
        if (parsed.employees?.length)
          await db.employees.bulkPut(parsed.employees);
        if (parsed.scheduleAssignments?.length)
          await db.scheduleAssignments.bulkPut(parsed.scheduleAssignments);
        if (parsed.leavesAndVacations?.length)
          await db.leavesAndVacations.bulkPut(parsed.leavesAndVacations);
        if (parsed.shiftSwaps?.length)
          await db.shiftSwaps.bulkPut(parsed.shiftSwaps);
        if (parsed.attendanceLogs?.length)
          await db.attendanceLogs.bulkPut(parsed.attendanceLogs);
      }
    );

    await recordDualWriteMutation({
      entity: 'database',
      entityId: 'json-restore',
      operation: 'UPSERT',
      action: 'IMPORT_JSON_BACKUP',
      summary: `Restauração JSON importada de ${file.name}.`,
      payload: { filename: file.name, importedAt: new Date().toISOString() }
    });

    return `Backup JSON "${file.name}" restaurado com sucesso.`;
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Planilha sem abas legíveis.');
    }
    const sheet = wb.Sheets[firstSheetName];
    if (!sheet) {
      throw new Error('Falha ao ler a primeira aba da planilha.');
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const validCodes = new Set<StatusCode>([
      'T',
      'F',
      'FE',
      'LM',
      'LP',
      'FA',
      'AT',
      'BH',
      'TR'
    ]);
    const employees = await db.employees.toArray();
    const empByName = new Map(
      employees.map((e) => [e.name.trim().toLowerCase(), e])
    );
    const empByReg = new Map(
      employees.map((e) => [e.registration.trim().toLowerCase(), e])
    );

    const toPut: ScheduleAssignment[] = [];
    for (const row of rows) {
      const dateStr = String(row.Data ?? row.date ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      const regStr = String(row.Matricula ?? row.registration ?? '')
        .trim()
        .toLowerCase();
      const nameStr = String(row.Colaborador ?? row.employeeName ?? '')
        .trim()
        .toLowerCase();
      const emp = empByReg.get(regStr) ?? empByName.get(nameStr);
      if (!emp) continue;

      const codeRaw = String(row.Codigo ?? row.statusCode ?? 'T')
        .trim()
        .toUpperCase() as StatusCode;
      const statusCode: StatusCode = validCodes.has(codeRaw) ? codeRaw : 'T';
      const shiftCode = String(
        row.Turno ?? row.shiftCode ?? emp.defaultShiftCode
      ).trim();

      toPut.push({
        id: `asg-${emp.id}-${dateStr}`,
        employeeId: emp.id,
        sectorId: emp.sectorId,
        date: dateStr,
        statusCode,
        shiftCode,
        lunchWindow: 'W1_12_13',
        hoursWorked: Number(row.HorasPrevistas ?? row.hoursWorked ?? 8) || 0
      });
    }

    if (toPut.length > 0) {
      await db.scheduleAssignments.bulkPut(toPut);
      await recordDualWriteMutation({
        entity: 'scheduleAssignments',
        entityId: `import-${Date.now()}`,
        operation: 'UPSERT',
        action: 'IMPORT_SPREADSHEET',
        summary: `Importados ${toPut.length} registros de escala via ${file.name}.`,
        payload: { count: toPut.length, filename: file.name }
      });
    }

    return `${toPut.length} registro(s) importado(s) de "${file.name}".`;
  }

  throw new Error('Formato não suportado. Utilize .xlsx, .csv ou .json.');
}

