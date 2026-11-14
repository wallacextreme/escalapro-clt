import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  ShieldAlert
} from 'lucide-react';
import {
  SCALE_PRESETS,
  calculateWorkforceAnalytics
} from '../../core/laborRulesEngine';
import type {
  AnalyticsFilter,
  AttendanceLog,
  Employee,
  Gender,
  ScaleCode,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  WorkRegime
} from '../../types/domain';
import { BradfordRiskBadge } from '../ui/Badges';

interface AnalyticsDashboardViewProps {
  month: string;
  employees: Employee[];
  sectors: Sector[];
  shifts: ShiftDefinition[];
  assignments: ScheduleAssignment[];
  attendanceLogs: AttendanceLog[];
  scaleTemplates: ScaleTemplate[];
}

export function AnalyticsDashboardView({
  month,
  employees,
  sectors,
  shifts,
  assignments,
  attendanceLogs,
  scaleTemplates
}: AnalyticsDashboardViewProps) {
  const [filter, setFilter] = useState<AnalyticsFilter>({
    periodMonth: month,
    sectorId: 'ALL',
    role: 'ALL',
    scaleCode: 'ALL',
    regime: 'ALL',
    shiftCode: 'ALL',
    gender: 'ALL',
    employeeId: 'ALL'
  });

  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s.name])),
    [sectors]
  );

  const distinctRoles = useMemo(
    () => Array.from(new Set(employees.map((e) => e.role))).sort(),
    [employees]
  );

  const analytics = useMemo(
    () =>
      calculateWorkforceAnalytics({
        filter,
        employees,
        sectors,
        assignments,
        attendanceLogs,
        customTemplates: scaleTemplates
      }),
    [filter, employees, sectors, assignments, attendanceLogs, scaleTemplates]
  );

  const criticalBradfordCount = useMemo(
    () =>
      analytics.bradfordRanking.filter(
        (b) => b.riskLevel === 'CRITICO' || b.riskLevel === 'ALTO'
      ).length,
    [analytics]
  );

  const heatmapBySector = useMemo(() => {
    const grouped = new Map<
      string,
      { sectorName: string; cells: typeof analytics.weekdayHeatmap }
    >();
    for (const cell of analytics.weekdayHeatmap) {
      const existing = grouped.get(cell.sectorId);
      if (existing) {
        existing.cells.push(cell);
      } else {
        grouped.set(cell.sectorId, {
          sectorName: cell.sectorName,
          cells: [cell]
        });
      }
    }
    return Array.from(grouped.entries());
  }, [analytics.weekdayHeatmap]);

  return (
    <section id="view-analytics-dashboard" className="space-y-5">
      {/* Filtros Combináveis (8 dimensões) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
              <BarChart3 className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              Workforce Analytics: Absenteísmo, Fator de Bradford &amp; Crise Preditiva
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              8 filtros estatísticos combináveis com cálculo de disrupção <code>B = S² × D</code> e predição de colapso de cobertura.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setFilter({
                periodMonth: month,
                sectorId: 'ALL',
                role: 'ALL',
                scaleCode: 'ALL',
                regime: 'ALL',
                shiftCode: 'ALL',
                gender: 'ALL',
                employeeId: 'ALL'
              })
            }
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 no-print"
          >
            Limpar Filtros
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 text-xs sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 no-print">
          <label>
            <span className="font-bold">1. Período</span>
            <select
              aria-label="Filtrar período"
              value={filter.periodMonth}
              onChange={(e) =>
                setFilter((f) => ({ ...f, periodMonth: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value={month}>{month}</option>
              <option value="2026-10">2026-10</option>
              <option value="ALL">Todo o Histórico</option>
            </select>
          </label>

          <label>
            <span className="font-bold">2. Setor</span>
            <select
              aria-label="Filtrar setor"
              value={filter.sectorId}
              onChange={(e) =>
                setFilter((f) => ({ ...f, sectorId: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-bold">3. Cargo</span>
            <select
              aria-label="Filtrar cargo"
              value={filter.role}
              onChange={(e) =>
                setFilter((f) => ({ ...f, role: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos</option>
              {distinctRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-bold">4. Escala</span>
            <select
              aria-label="Filtrar escala"
              value={filter.scaleCode}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  scaleCode: e.target.value as 'ALL' | ScaleCode
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todas</option>
              {Object.values(SCALE_PRESETS).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-bold">5. Regime</span>
            <select
              aria-label="Filtrar regime"
              value={filter.regime}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  regime: e.target.value as 'ALL' | WorkRegime
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos</option>
              <option value="FIXO">Fixo</option>
              <option value="ROTATIVO">Rotativo</option>
            </select>
          </label>

          <label>
            <span className="font-bold">6. Turno</span>
            <select
              aria-label="Filtrar turno"
              value={filter.shiftCode}
              onChange={(e) =>
                setFilter((f) => ({ ...f, shiftCode: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos</option>
              {shifts.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.startTime}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-bold">7. Gênero</span>
            <select
              aria-label="Filtrar gênero"
              value={filter.gender}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  gender: e.target.value as 'ALL' | Gender
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </label>

          <label>
            <span className="font-bold">8. Colaborador</span>
            <select
              aria-label="Filtrar colaborador"
              value={filter.employeeId}
              onChange={(e) =>
                setFilter((f) => ({ ...f, employeeId: e.target.value }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">Todos ({employees.length})</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* KPIs Executivos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>ÍNDICE DE ABSENTEÍSMO</span>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-slate-50">
            {analytics.absenteeismRatePct.toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ({analytics.lostHours}h perdidas ÷ {analytics.plannedHours}h previstas)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>EFETIVO NO RECORTE</span>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-slate-50">
            {analytics.filteredEmployeesCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Colaboradores ativos filtrados
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>BRADFORD ALTO / CRÍTICO</span>
            <Flame className="h-4 w-4 text-orange-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-orange-700 dark:text-orange-400">
            {criticalBradfordCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scores &ge; 125 pontos (S² × D)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>ALERTAS DE CRISE PREDITIVA</span>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-red-700 dark:text-red-400">
            {analytics.crisisAlerts.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dias com margem vulnerável à falta
          </div>
        </div>
      </div>

      {/* Ranking Bradford + Alertas de Crise */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Fator de Bradford por Colaborador (B = S² × D)
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                  <th className="px-2.5 py-2 font-bold">Colaborador</th>
                  <th className="px-2.5 py-2 font-bold">Setor</th>
                  <th className="px-2.5 py-2 font-bold text-center">Episódios (S)</th>
                  <th className="px-2.5 py-2 font-bold text-center">Dias (D)</th>
                  <th className="px-2.5 py-2 font-bold text-center">Score B</th>
                  <th className="px-2.5 py-2 font-bold">Classificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {analytics.bradfordRanking.map((b) => (
                  <tr key={b.employeeId}>
                    <td className="px-2.5 py-2 font-bold">{b.employeeName}</td>
                    <td className="px-2.5 py-2">
                      {sectorMap.get(b.sectorId) ?? b.sectorId}
                    </td>
                    <td className="px-2.5 py-2 text-center font-mono">
                      {b.episodesS}
                    </td>
                    <td className="px-2.5 py-2 text-center font-mono">
                      {b.daysLostD}
                    </td>
                    <td className="px-2.5 py-2 text-center font-mono font-extrabold">
                      {b.bradfordScore}
                    </td>
                    <td className="px-2.5 py-2">
                      <BradfordRiskBadge level={b.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerta Preditivo de Crise de Cobertura */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Alerta Preditivo de Crise de Cobertura
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Cruza folga de escala (Escalados − Mínimo) com probabilidade histórica por dia da semana.
          </p>

          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {analytics.crisisAlerts.length === 0 ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Nenhuma crise prevista para o recorte selecionado.
              </div>
            ) : (
              analytics.crisisAlerts.slice(0, 14).map((alert, i) => (
                <div
                  key={`${alert.date}-${alert.sectorId}-${i}`}
                  className="rounded-lg border border-red-300 bg-red-50/90 p-2.5 text-xs dark:border-red-800 dark:bg-red-950/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-red-950 dark:text-red-100">
                      {alert.date} ({alert.weekdayLabel}) — {alert.sectorName}
                    </span>
                    <span className="rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {alert.alertMessage}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-red-900 dark:text-red-200">
                    Escalados: <strong>{alert.scheduledCount}</strong> • Mínimo:{' '}
                    <strong>{alert.minRequired}</strong> • Risco histórico:{' '}
                    <strong>{alert.historicalAbsenceProbabilityPct}%</strong> • Líquido
                    projetado: <strong>{alert.projectedNetCoverage}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mapa de Calor Seg-Dom x Setor */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
          Mapa de Calor de Absenteísmo (Dia da Semana × Setor)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                <th className="px-3 py-2 text-left font-bold">Setor</th>
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                  <th key={d} className="px-2 py-2 font-bold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {heatmapBySector.map(([sectorId, group]) => (
                <tr key={sectorId}>
                  <td className="px-3 py-2 text-left font-bold">
                    {group.sectorName}
                  </td>
                  {group.cells.map((cell) => {
                    const heatClass =
                      cell.absenceRatePct >= 20
                        ? 'bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-100'
                        : cell.absenceRatePct >= 12
                        ? 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100'
                        : 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200';
                    return (
                      <td key={cell.weekday} className={`px-2 py-2 font-mono font-bold ${heatClass}`}>
                        {cell.absenceRatePct.toFixed(0)}%
                        {cell.absenceCount > 0 && (
                          <span className="block text-[10px] font-normal">
                            ({cell.absenceCount} ocorr.)
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
