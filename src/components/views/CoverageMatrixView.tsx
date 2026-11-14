import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Grid3X3
} from 'lucide-react';
import {
  calculateSectorCoverageMatrix,
  simulateHeadcountComparison
} from '../../core/laborRulesEngine';
import type {
  Employee,
  ScheduleAssignment,
  Sector,
  ShiftDefinition
} from '../../types/domain';

interface CoverageMatrixViewProps {
  referenceDate: string;
  onReferenceDateChange: (date: string) => void;
  employees: Employee[];
  sectors: Sector[];
  assignments: ScheduleAssignment[];
  shifts: ShiftDefinition[];
}

export function CoverageMatrixView({
  referenceDate,
  onReferenceDateChange,
  employees,
  sectors,
  assignments,
  shifts
}: CoverageMatrixViewProps) {
  const [simMinDaily, setSimMinDaily] = useState<number>(3);
  const [simOperatingHours, setSimOperatingHours] = useState<number>(12);
  const [simOperatingDays, setSimOperatingDays] = useState<number>(7);

  const sectorMatrices = useMemo(() => {
    return sectors.map((sector) =>
      calculateSectorCoverageMatrix({
        sector,
        date: referenceDate,
        employees,
        assignments,
        shifts
      })
    );
  }, [sectors, referenceDate, employees, assignments, shifts]);

  const headcountSimulation = useMemo(
    () =>
      simulateHeadcountComparison({
        minDailyCoverage: simMinDaily,
        operatingHoursPerDay: simOperatingHours,
        operatingDaysPerWeek: simOperatingDays
      }),
    [simMinDaily, simOperatingHours, simOperatingDays]
  );

  return (
    <section id="view-coverage-matrix" className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
            <Grid3X3 className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            Matriz de Cobertura nos Horários Críticos (Hora a Hora)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Desconta automaticamente pausas de almoço, folgas, férias e atestados para expor qualquer déficit operacional.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold">
          <span>Data analisada:</span>
          <input
            type="date"
            aria-label="Data da matriz de cobertura"
            value={referenceDate}
            onChange={(e) => onReferenceDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
      </div>

      {/* Janelas Críticas por Setor */}
      <div className="space-y-4">
        {sectorMatrices.map((matrix) => (
          <div
            key={matrix.sectorId}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {matrix.sectorName}
                </h3>
                <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Presença Mínima Crítica: {matrix.minCriticalPresence}
                </span>
              </div>

              {matrix.hasAnyDeficit ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-100 px-3 py-0.5 text-xs font-bold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  DÉFICIT DETECTADO EM FAIXA CRÍTICA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  COBERTURA 100% CONFORME
                </span>
              )}
            </div>

            {/* Resumo das 7 Janelas Críticas */}
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {matrix.criticalWindows.map((win) => (
                <div
                  key={win.id}
                  className={`rounded-lg border p-2 text-xs ${
                    win.isDeficit
                      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200'
                      : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                  }`}
                >
                  <div className="font-bold leading-tight">{win.label}</div>
                  <div className="mt-1 font-mono text-sm font-extrabold">
                    {win.minActiveCount}/{win.requiredPresence}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {win.isDeficit ? 'Abaixo do mínimo' : 'Coberto'}
                  </div>
                </div>
              ))}
            </div>

            {/* Grade Hora a Hora 08h-20h */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                    <th className="px-2 py-1.5 text-left font-bold">Métrica</th>
                    {matrix.hourlyCells.map((c) => (
                      <th key={c.hour} className="px-1.5 py-1.5 font-mono font-bold">
                        {String(c.hour).padStart(2, '0')}h
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <td className="px-2 py-1 text-left font-semibold">Escalados</td>
                    {matrix.hourlyCells.map((c) => (
                      <td key={c.hour} className="px-1.5 py-1">
                        {c.scheduledCount}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <td className="px-2 py-1 text-left font-semibold text-amber-800 dark:text-amber-300">
                      Em Almoço
                    </td>
                    {matrix.hourlyCells.map((c) => (
                      <td key={c.hour} className="px-1.5 py-1 text-amber-800 dark:text-amber-300">
                        {c.onLunchCount > 0 ? `-${c.onLunchCount}` : '0'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-left font-bold">Ativos Líquidos</td>
                    {matrix.hourlyCells.map((c) => (
                      <td
                        key={c.hour}
                        className={`px-1.5 py-1.5 font-mono font-bold ${
                          c.isDeficit
                            ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
                            : c.minRequired === 0
                            ? 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-600'
                            : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                        }`}
                      >
                        {c.activeCount}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Calculadora de Dimensionamento (Headcount Simulator) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
          <Calculator className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          Calculadora de Dimensionamento (Headcount Simulator: 5x2 vs 6x1 vs 12x36 vs 12x48)
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs">
            <span className="font-bold">Presença Mínima Simultânea</span>
            <input
              type="number"
              min={1}
              max={50}
              value={simMinDaily}
              onChange={(e) => setSimMinDaily(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs">
            <span className="font-bold">Horas de Operação/Dia</span>
            <input
              type="number"
              min={4}
              max={24}
              value={simOperatingHours}
              onChange={(e) => setSimOperatingHours(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs">
            <span className="font-bold">Dias de Funcionamento/Semana</span>
            <input
              type="number"
              min={5}
              max={7}
              value={simOperatingDays}
              onChange={(e) => setSimOperatingDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                <th className="px-3 py-2 font-bold">Escala</th>
                <th className="px-3 py-2 font-bold">Carga Semanal</th>
                <th className="px-3 py-2 font-bold">Divisor</th>
                <th className="px-3 py-2 font-bold">Efetivo Mínimo Exigido</th>
                <th className="px-3 py-2 font-bold">Impacto Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {headcountSimulation.map((row) => (
                <tr key={row.scaleCode}>
                  <td className="px-3 py-2 font-bold">{row.scaleName}</td>
                  <td className="px-3 py-2 font-mono">{row.weeklyHours}h</td>
                  <td className="px-3 py-2 font-mono">{row.divisor}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-sm font-extrabold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                      {row.requiredTotalHeadcount} colaboradores
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {row.notes}
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
