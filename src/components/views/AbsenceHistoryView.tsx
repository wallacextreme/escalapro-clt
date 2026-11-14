import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  ShieldAlert
} from 'lucide-react';
import { db } from '../../db/database';
import { recordDualWriteMutation } from '../../db/syncEngine';
import { calculateEmployeeMonthlyLedger } from '../../core/laborRulesEngine';
import type {
  AttendanceLog,
  Employee,
  ScaleTemplate,
  ScheduleAssignment,
  Sector
} from '../../types/domain';

interface AbsenceHistoryViewProps {
  month: string;
  onMonthChange: (month: string) => void;
  employees: Employee[];
  sectors: Sector[];
  assignments: ScheduleAssignment[];
  attendanceLogs: AttendanceLog[];
  scaleTemplates: ScaleTemplate[];
  onNotify: (msg: string) => void;
}

export function AbsenceHistoryView({
  month,
  onMonthChange,
  employees,
  sectors,
  assignments,
  attendanceLogs,
  scaleTemplates,
  onNotify
}: AbsenceHistoryViewProps) {
  const [logEmployeeId, setLogEmployeeId] = useState<string>(
    employees[0]?.id ?? ''
  );
  const [logDate, setLogDate] = useState<string>(`${month}-16`);
  const [logKind, setLogKind] = useState<
    'LATE_TOLERANCE' | 'UNJUSTIFIED_ABSENCE' | 'MEDICAL_CERT'
  >('LATE_TOLERANCE');
  const [lateMinutes, setLateMinutes] = useState<number>(4);
  const [medicalDays, setMedicalDays] = useState<number>(2);
  const [notes, setNotes] = useState<string>('Ocorrência registrada pelo RH');

  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s.name])),
    [sectors]
  );

  const ledgerRows = useMemo(() => {
    return employees.map((emp) =>
      calculateEmployeeMonthlyLedger({
        employee: emp,
        month,
        assignments,
        allAttendanceLogs: attendanceLogs,
        customTemplates: scaleTemplates
      })
    );
  }, [employees, month, assignments, attendanceLogs, scaleTemplates]);

  const inssAlertsCount = useMemo(
    () => ledgerRows.filter((r) => r.inssReferralAlert).length,
    [ledgerRows]
  );

  async function handleAddAttendanceLog(e: React.FormEvent) {
    e.preventDefault();
    const targetEmp = employees.find((emp) => emp.id === logEmployeeId);
    if (!targetEmp) return;

    const logMonth = logDate.slice(0, 7);
    const newLog: AttendanceLog = {
      id: `att-${Date.now()}`,
      employeeId: targetEmp.id,
      month: logMonth,
      date: logDate,
      lateMinutes: logKind === 'LATE_TOLERANCE' ? lateMinutes : 0,
      earlyLeaveMinutes: 0,
      unjustifiedAbsence: logKind === 'UNJUSTIFIED_ABSENCE',
      justifiedAbsence: logKind === 'MEDICAL_CERT',
      medicalCertificateDays: logKind === 'MEDICAL_CERT' ? medicalDays : 0,
      notes: notes.trim() || 'Registro RH'
    };

    await db.attendanceLogs.put(newLog);
    await recordDualWriteMutation({
      entity: 'attendanceLogs',
      entityId: newLog.id,
      operation: 'UPSERT',
      action: 'ADD_ATTENDANCE_LOG',
      summary: `Lançamento RH (${logKind}) para ${targetEmp.name} em ${logDate}.`,
      payload: newLog
    });

    onNotify(`Ocorrência registrada no prontuário de ${targetEmp.name}.`);
  }

  return (
    <section id="view-absence-history" className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
            <FileSpreadsheet className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            Prontuário Mensal de Ausências para o RH (CLT / Lei 605/49 / INSS)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cálculo automático de Tolerância de Ponto (Art. 58 § 1º), Desconto de DSR (Lei 605/49), Férias (Art. 130) e Alerta INSS (&gt;15 dias em 60 dias).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {inssAlertsCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400 bg-red-100 px-3 py-1 text-xs font-extrabold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
              <ShieldAlert className="h-4 w-4" />
              {inssAlertsCount} Alerta(s) INSS (&gt;15d/60d)
            </span>
          )}
          <label className="flex items-center gap-2 text-xs font-bold">
            <span>Competência:</span>
            <input
              type="month"
              aria-label="Competência do prontuário RH"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>
      </div>

      {/* Lançamento Rápido de Ocorrência RH */}
      <form
        onSubmit={handleAddAttendanceLog}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-6 no-print"
      >
        <label className="text-xs lg:col-span-2">
          <span className="font-bold">Colaborador</span>
          <select
            value={logEmployeeId}
            onChange={(e) => setLogEmployeeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="font-bold">Data</span>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="text-xs">
          <span className="font-bold">Tipo</span>
          <select
            value={logKind}
            onChange={(e) =>
              setLogKind(
                e.target.value as
                  | 'LATE_TOLERANCE'
                  | 'UNJUSTIFIED_ABSENCE'
                  | 'MEDICAL_CERT'
              )
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="LATE_TOLERANCE">Atraso / Batida (Art. 58 §1º)</option>
            <option value="UNJUSTIFIED_ABSENCE">Falta Injustificada (FA)</option>
            <option value="MEDICAL_CERT">Atestado Médico (LM)</option>
          </select>
        </label>

        {logKind === 'LATE_TOLERANCE' && (
          <label className="text-xs">
            <span className="font-bold">Minutos Variação</span>
            <input
              type="number"
              min={0}
              max={480}
              value={lateMinutes}
              onChange={(e) => setLateMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}

        {logKind === 'MEDICAL_CERT' && (
          <label className="text-xs">
            <span className="font-bold">Dias de Atestado</span>
            <input
              type="number"
              min={1}
              max={60}
              value={medicalDays}
              onChange={(e) => setMedicalDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}

        {logKind === 'UNJUSTIFIED_ABSENCE' && (
          <label className="text-xs">
            <span className="font-bold">Observação</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}

        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <PlusCircle className="h-4 w-4" />
            Lançar no Prontuário
          </button>
        </div>
      </form>

      {/* Tabela Consolidada RH */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <th className="px-3 py-2.5 font-bold">Colaborador</th>
              <th className="px-3 py-2.5 font-bold">Setor</th>
              <th className="px-3 py-2.5 font-bold text-center">Divisor</th>
              <th className="px-3 py-2.5 font-bold text-center">Trabalhados</th>
              <th className="px-3 py-2.5 font-bold text-center">Faltas Inj.</th>
              <th className="px-3 py-2.5 font-bold text-center">
                DSRs Perdidos (Lei 605/49)
              </th>
              <th className="px-3 py-2.5 font-bold text-right">Desc. DSR</th>
              <th className="px-3 py-2.5 font-bold text-center">
                Tolerância Art. 58 §1º
              </th>
              <th className="px-3 py-2.5 font-bold text-center">
                Férias Art. 130
              </th>
              <th className="px-3 py-2.5 font-bold">
                Atestados 60d / Status INSS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {ledgerRows.map((row) => (
              <tr
                key={row.employeeId}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-50">
                  {row.employeeName}
                </td>
                <td className="px-3 py-2">
                  {sectorMap.get(row.sectorId) ?? row.sectorId}
                </td>
                <td className="px-3 py-2 text-center font-mono">{row.divisor}</td>
                <td className="px-3 py-2 text-center font-mono font-semibold">
                  {row.workedDays}/{row.plannedDays}
                </td>
                <td className="px-3 py-2 text-center font-mono font-bold">
                  <span
                    className={
                      row.unjustifiedAbsences > 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {row.unjustifiedAbsences}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono font-bold">
                  {row.dsrLostCount}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  R$ {row.dsrDeductionValue.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="font-mono text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {row.exemptToleranceMinutes}m isentos
                    </span>
                    {row.discountableLateMinutes > 0 && (
                      <span className="block font-bold text-red-700 dark:text-red-400">
                        -{row.discountableLateMinutes}m desc.
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                    {row.vacationDaysEntitledArt130} dias
                  </span>
                </td>
                <td className="px-3 py-2">
                  {row.inssReferralAlert ? (
                    <span className="inline-flex items-center gap-1 rounded border border-red-400 bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      ALERTA INSS ({row.medicalDaysRolling60Days}d/60d)
                    </span>
                  ) : (
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {row.medicalDaysRolling60Days}d em 60d (Normal)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

