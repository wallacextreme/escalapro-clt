import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  CalendarPlus,
  CheckCircle2,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { db } from '../../db/database';
import { recordDualWriteMutation } from '../../db/syncEngine';
import {
  BRAZIL_NATIONAL_HOLIDAYS_2026_2027,
  validateLeaveOrVacationRequest
} from '../../core/laborRulesEngine';
import type {
  Employee,
  LeaveOrVacation,
  LeaveType,
  ScheduleAssignment,
  Sector
} from '../../types/domain';

interface LeavePlannerViewProps {
  employees: Employee[];
  sectors: Sector[];
  leaves: LeaveOrVacation[];
  assignments: ScheduleAssignment[];
  onNotify: (msg: string) => void;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  F: 'Folga / DSR Programada (F)',
  FE: 'Início de Férias (FE)',
  LM: 'Licença Médica / Atestado (LM)',
  LP: 'Licença Legal Art. 473 CLT (LP)'
};

export function LeavePlannerView({
  employees,
  sectors,
  leaves,
  assignments,
  onNotify
}: LeavePlannerViewProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    employees.find((e) => e.id === 'emp-02')?.id ?? employees[0]?.id ?? ''
  );
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-18');
  const [selectedType, setSelectedType] = useState<LeaveType>('F');
  const [substituteId, setSubstituteId] = useState<string>('');
  const [reason, setReason] = useState<string>('Folga compensatória programada');
  const [filterSectorId, setFilterSectorId] = useState<string>('ALL');

  const empMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );
  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s])),
    [sectors]
  );

  const selectedEmployee = empMap.get(selectedEmployeeId) ?? employees[0];

  const liveValidation = useMemo(() => {
    if (!selectedEmployee) return null;
    return validateLeaveOrVacationRequest({
      employee: selectedEmployee,
      date: selectedDate,
      type: selectedType,
      substituteEmployeeId: substituteId || undefined,
      existingLeaves: leaves,
      employees,
      assignments,
      holidays: BRAZIL_NATIONAL_HOLIDAYS_2026_2027
    });
  }, [
    selectedEmployee,
    selectedDate,
    selectedType,
    substituteId,
    leaves,
    employees,
    assignments
  ]);

  const filteredLeaves = useMemo(() => {
    return leaves
      .filter(
        (l) => filterSectorId === 'ALL' || l.sectorId === filterSectorId
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [leaves, filterSectorId]);

  const substituteCandidates = useMemo(() => {
    if (!selectedEmployee) return [];
    return employees.filter(
      (e) => e.active && e.id !== selectedEmployee.id
    );
  }, [employees, selectedEmployee]);

  async function handleAddLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee || !liveValidation || liveValidation.blocked) {
      return;
    }

    const newLeave: LeaveOrVacation = {
      id: `lv-${Date.now()}`,
      employeeId: selectedEmployee.id,
      sectorId: selectedEmployee.sectorId,
      date: selectedDate,
      type: selectedType,
      substituteEmployeeId: substituteId || undefined,
      approved: true,
      reason: reason.trim() || LEAVE_TYPE_LABELS[selectedType],
      createdAt: new Date().toISOString()
    };

    const existingAsg = assignments.find(
      (a) => a.employeeId === selectedEmployee.id && a.date === selectedDate
    );
    const updatedAsg: ScheduleAssignment = existingAsg
      ? {
          ...existingAsg,
          statusCode: selectedType,
          hoursWorked: 0
        }
      : {
          id: `asg-${selectedEmployee.id}-${selectedDate}`,
          employeeId: selectedEmployee.id,
          sectorId: selectedEmployee.sectorId,
          date: selectedDate,
          statusCode: selectedType,
          shiftCode: selectedEmployee.defaultShiftCode,
          lunchWindow: 'NONE',
          hoursWorked: 0
        };

    await db.transaction(
      'rw',
      db.leavesAndVacations,
      db.scheduleAssignments,
      async () => {
        await db.leavesAndVacations.put(newLeave);
        await db.scheduleAssignments.put(updatedAsg);
      }
    );

    await recordDualWriteMutation({
      entity: 'leavesAndVacations',
      entityId: newLeave.id,
      operation: 'UPSERT',
      action: 'CREATE_LEAVE_OR_VACATION',
      summary: `Programado ${selectedType} para ${selectedEmployee.name} em ${selectedDate}.`,
      payload: newLeave
    });

    onNotify(
      `Programação confirmada: ${selectedEmployee.name} (${selectedType}) em ${selectedDate}.`
    );
  }

  async function handleDeleteLeave(leave: LeaveOrVacation) {
    await db.leavesAndVacations.delete(leave.id);
    await recordDualWriteMutation({
      entity: 'leavesAndVacations',
      entityId: leave.id,
      operation: 'DELETE',
      action: 'REMOVE_LEAVE',
      summary: `Removida programação ${leave.type} de ${leave.date}.`,
      payload: leave
    });
    onNotify(`Registro de ausência (${leave.date}) removido.`);
  }

  return (
    <section id="view-leave-planner" className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
          <CalendarPlus className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          Programação de Folgas, Férias &amp; Licenças (Trava Setorial + Art. 134 § 3º CLT)
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Validação reativa no índice <code>[sectorId+date]</code> bloqueando colisão de 2+ ausências no mesmo setor sem substituto e início de férias nos 2 dias anteriores a DSR ou feriado.
        </p>

        <form
          onSubmit={handleAddLeave}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Colaborador
            </span>
            <select
              id="leave-employee-select"
              aria-label="Colaborador para programação"
              value={selectedEmployee?.id ?? ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
              Data
            </span>
            <input
              id="leave-date-input"
              type="date"
              aria-label="Data da folga ou início de férias"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Tipo de Programação
            </span>
            <select
              id="leave-type-select"
              aria-label="Tipo de programação"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as LeaveType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((k) => (
                <option key={k} value={k}>
                  {LEAVE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Substituto Pré-Alocado (Opcional)
            </span>
            <select
              id="leave-substitute-select"
              aria-label="Substituto pré-alocado"
              value={substituteId}
              onChange={(e) => setSubstituteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Sem substituto pré-alocado</option>
              {substituteCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({sectorMap.get(c.sectorId)?.name ?? c.sectorId})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Motivo / Observação
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {liveValidation && (
              <div
                id="leave-validation-banner"
                role="alert"
                className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                  liveValidation.blocked
                    ? 'border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200'
                    : 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                }`}
              >
                {liveValidation.blocked ? (
                  <AlertOctagon className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                <span>{liveValidation.message}</span>
              </div>
            )}

            <button
              id="leave-submit-btn"
              type="submit"
              disabled={!liveValidation || liveValidation.blocked}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Confirmar Programação
            </button>
          </div>
        </form>
      </div>

      {/* Linha do tempo / Tabela de ausências programadas */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Linha do Tempo de Ausências Programadas ({filteredLeaves.length})
          </h3>
          <select
            aria-label="Filtrar linha do tempo por setor"
            value={filterSectorId}
            onChange={(e) => setFilterSectorId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="ALL">Todos os Setores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-3 py-2 font-bold">Data</th>
                <th className="px-3 py-2 font-bold">Setor</th>
                <th className="px-3 py-2 font-bold">Colaborador</th>
                <th className="px-3 py-2 font-bold">Tipo</th>
                <th className="px-3 py-2 font-bold">Substituto</th>
                <th className="px-3 py-2 font-bold">Motivo</th>
                <th className="px-3 py-2 font-bold text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLeaves.map((leave) => {
                const emp = empMap.get(leave.employeeId);
                const sub = leave.substituteEmployeeId
                  ? empMap.get(leave.substituteEmployeeId)
                  : undefined;
                const secName = sectorMap.get(leave.sectorId)?.name ?? leave.sectorId;
                return (
                  <tr
                    key={leave.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold">{leave.date}</td>
                    <td className="px-3 py-2 font-medium">{secName}</td>
                    <td className="px-3 py-2 font-bold">{emp?.name ?? leave.employeeId}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 font-bold text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        {leave.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {sub ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {sub.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Sem substituto
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {leave.reason}
                    </td>
                    <td className="px-3 py-2 text-right no-print">
                      <button
                        type="button"
                        onClick={() => handleDeleteLeave(leave)}
                        aria-label={`Remover programação de ${emp?.name ?? leave.employeeId}`}
                        className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

