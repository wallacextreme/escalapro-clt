import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { db } from '../../db/database';
import { recordDualWriteMutation } from '../../db/syncEngine';
import {
  evaluateShiftSwapCandidates,
  getScaleTemplate
} from '../../core/laborRulesEngine';
import type {
  Employee,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  ShiftSwapRecord,
  UnionRule
} from '../../types/domain';
import { CompliancePill } from '../ui/Badges';

interface AgileSwapViewProps {
  referenceDate: string;
  onReferenceDateChange: (date: string) => void;
  employees: Employee[];
  sectors: Sector[];
  shifts: ShiftDefinition[];
  assignments: ScheduleAssignment[];
  scaleTemplates: ScaleTemplate[];
  unionRules: UnionRule[];
  swaps: ShiftSwapRecord[];
  onNotify: (msg: string) => void;
}

export function AgileSwapView({
  referenceDate,
  onReferenceDateChange,
  employees,
  sectors,
  shifts,
  assignments,
  scaleTemplates,
  unionRules,
  swaps,
  onNotify
}: AgileSwapViewProps) {
  const [absentEmployeeId, setAbsentEmployeeId] = useState<string>(
    employees[0]?.id ?? ''
  );
  const [swapReason, setSwapReason] = useState<string>(
    'Cobertura ágil por ausência / troca operacional'
  );
  const [onlyApproved, setOnlyApproved] = useState<boolean>(false);

  const empMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );
  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s])),
    [sectors]
  );

  const absentEmployee = empMap.get(absentEmployeeId) ?? employees[0];

  const absentAssignment = useMemo(() => {
    if (!absentEmployee) return undefined;
    return assignments.find(
      (a) => a.employeeId === absentEmployee.id && a.date === referenceDate
    );
  }, [absentEmployee, assignments, referenceDate]);

  const targetShiftCode =
    absentAssignment?.shiftCode ?? absentEmployee?.defaultShiftCode ?? 'M8';

  const evaluations = useMemo(() => {
    if (!absentEmployee) return [];
    const list = evaluateShiftSwapCandidates({
      targetDate: referenceDate,
      absentEmployeeId: absentEmployee.id,
      targetShiftCode,
      employees,
      sectors,
      assignments,
      shifts,
      unionRules,
      customTemplates: scaleTemplates
    });
    return onlyApproved ? list.filter((item) => item.approved) : list;
  }, [
    absentEmployee,
    referenceDate,
    targetShiftCode,
    employees,
    sectors,
    assignments,
    shifts,
    unionRules,
    scaleTemplates,
    onlyApproved
  ]);

  async function handleConfirmSwap(candidateEval: (typeof evaluations)[number]) {
    if (!absentEmployee || !candidateEval.approved) return;

    const targetShift = shifts.find((s) => s.code === targetShiftCode);
    const swapRecord: ShiftSwapRecord = {
      id: `swp-${Date.now()}`,
      date: referenceDate,
      sectorId: absentEmployee.sectorId,
      absentEmployeeId: absentEmployee.id,
      substituteEmployeeId: candidateEval.candidate.id,
      reason: swapReason.trim() || 'Substituição ágil CLT',
      interjornadaHours: candidateEval.interjornadaHours,
      dsrIntervalHours: candidateEval.dsrIntervalHours,
      weeklyHoursAfterSwap: candidateEval.weeklyHoursProjected,
      sundayRuleCompliant: candidateEval.checks.sundayRotationOk,
      createdAt: new Date().toISOString()
    };

    const subAssignment: ScheduleAssignment = {
      id: `asg-${candidateEval.candidate.id}-${referenceDate}`,
      employeeId: candidateEval.candidate.id,
      sectorId: absentEmployee.sectorId,
      date: referenceDate,
      statusCode: 'TR',
      shiftCode: targetShiftCode,
      lunchWindow: absentAssignment?.lunchWindow ?? 'W1_12_13',
      hoursWorked: targetShift?.durationHours ?? 8,
      notes: `Cobertura de ${absentEmployee.name}`
    };

    const updatedAbsentAssignment: ScheduleAssignment = {
      id: `asg-${absentEmployee.id}-${referenceDate}`,
      employeeId: absentEmployee.id,
      sectorId: absentEmployee.sectorId,
      date: referenceDate,
      statusCode: 'F',
      shiftCode: targetShiftCode,
      lunchWindow: 'NONE',
      hoursWorked: 0,
      notes: `Substituído por ${candidateEval.candidate.name}`
    };

    await db.transaction(
      'rw',
      db.shiftSwaps,
      db.scheduleAssignments,
      async () => {
        await db.shiftSwaps.put(swapRecord);
        await db.scheduleAssignments.put(subAssignment);
        await db.scheduleAssignments.put(updatedAbsentAssignment);
      }
    );

    await recordDualWriteMutation({
      entity: 'shiftSwaps',
      entityId: swapRecord.id,
      operation: 'UPSERT',
      action: 'EXECUTE_AGILE_SWAP',
      summary: `Troca ágil em ${referenceDate}: ${candidateEval.candidate.name} cobre ${absentEmployee.name}.`,
      payload: swapRecord
    });

    onNotify(
      `Substituição aprovada e gravada: ${candidateEval.candidate.name} assume o turno ${targetShiftCode} de ${absentEmployee.name} em ${referenceDate}.`
    );
  }

  return (
    <section id="view-agile-swap" className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          <ArrowLeftRight className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          Cockpit de Ajuste Ágil na Escala (Interjornada, DSR, Teto Semanal &amp; Domingos)
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Join reativo automático validando Art. 66 (11h), Art. 67 (35h), Art. 59 (teto da escala + 2h extras) e revezamento dominical (Art. 386 / Comércio / MTP 671).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Data da Substituição
            </span>
            <input
              type="date"
              aria-label="Data da substituição"
              value={referenceDate}
              onChange={(e) => onReferenceDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Colaborador Ausente
            </span>
            <select
              aria-label="Colaborador ausente"
              value={absentEmployee?.id ?? ''}
              onChange={(e) => setAbsentEmployeeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({sectorMap.get(emp.sectorId)?.name ?? emp.sectorId})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Motivo da Troca
            </span>
            <input
              type="text"
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <div className="flex flex-col justify-end">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
              <input
                type="checkbox"
                checked={onlyApproved}
                onChange={(e) => setOnlyApproved(e.target.checked)}
              />
              Exibir apenas candidatos 100% aptos
            </label>
          </div>
        </div>

        {absentEmployee && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs dark:border-blue-900 dark:bg-blue-950/40">
            <span>
              <strong>Posto a cobrir:</strong>{' '}
              {sectorMap.get(absentEmployee.sectorId)?.name ?? absentEmployee.sectorId}
            </span>
            <span>
              <strong>Turno:</strong> {targetShiftCode}
            </span>
            <span>
              <strong>Escala do Titular:</strong>{' '}
              {getScaleTemplate(absentEmployee.scaleCode, scaleTemplates).name}
            </span>
          </div>
        )}
      </div>

      {/* Ranking de Substitutos */}
      <div className="grid gap-3 md:grid-cols-2">
        {evaluations.map((item) => {
          const secName =
            sectorMap.get(item.candidate.sectorId)?.name ?? item.candidate.sectorId;
          const tpl = getScaleTemplate(item.candidate.scaleCode, scaleTemplates);
          return (
            <div
              key={item.candidate.id}
              className={`rounded-xl border p-4 shadow-sm ${
                item.approved
                  ? 'border-emerald-300 bg-white dark:border-emerald-800 dark:bg-slate-900'
                  : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      {item.candidate.name}
                    </h3>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {item.candidate.gender === 'F' ? 'Fem (Art. 386)' : 'Masc'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {secName} • {item.candidate.role} • {tpl.name}
                  </p>
                </div>

                {item.approved ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    APTO ({item.suitabilityScore} pts)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    IMPEDIDO
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    Último turno: {item.lastShiftEndedAt ?? 'Folga prévia'}
                  </span>
                </div>
                <div>
                  <strong>Carga semana:</strong> {item.weeklyHoursCurrent}h →{' '}
                  {item.weeklyHoursProjected}h / {item.weeklyLimitHours}h
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <CompliancePill
                  ok={item.checks.interjornadaArt66Ok}
                  label={`Art. 66: ${item.interjornadaHours}h`}
                />
                <CompliancePill
                  ok={item.checks.dsrArt67Ok}
                  label={`Art. 67: ${item.dsrIntervalHours}h`}
                />
                <CompliancePill
                  ok={item.checks.weeklyAndOvertimeArt59Ok}
                  label={`Art. 59: ${item.weeklyHoursProjected}/${item.weeklyLimitHours}h`}
                />
                <CompliancePill
                  ok={item.checks.sundayRotationOk}
                  label={`Domingos: ${item.consecutiveSundaysWorked}/${item.sundayLimitWeeks}`}
                />
              </div>

              <ul className="mt-2.5 space-y-1 text-xs">
                {item.reasons.map((r, idx) => (
                  <li
                    key={idx}
                    className={
                      item.approved
                        ? 'font-medium text-emerald-800 dark:text-emerald-300'
                        : 'font-medium text-red-800 dark:text-red-300'
                    }
                  >
                    • {r}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex justify-end no-print">
                <button
                  type="button"
                  disabled={!item.approved}
                  onClick={() => handleConfirmSwap(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Efetivar Substituição
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico Recente de Trocas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
          Histórico Auditado de Substituições ({swaps.length})
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                <th className="px-3 py-2 font-bold">Data</th>
                <th className="px-3 py-2 font-bold">Ausente</th>
                <th className="px-3 py-2 font-bold">Substituto</th>
                <th className="px-3 py-2 font-bold">Interjornada</th>
                <th className="px-3 py-2 font-bold">Semana Pós-Troca</th>
                <th className="px-3 py-2 font-bold">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {swaps
                .slice()
                .reverse()
                .map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono font-bold">{s.date}</td>
                    <td className="px-3 py-2">
                      {empMap.get(s.absentEmployeeId)?.name ?? s.absentEmployeeId}
                    </td>
                    <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      {empMap.get(s.substituteEmployeeId)?.name ??
                        s.substituteEmployeeId}
                    </td>
                    <td className="px-3 py-2 font-mono">{s.interjornadaHours}h</td>
                    <td className="px-3 py-2 font-mono">{s.weeklyHoursAfterSwap}h</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {s.reason}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
