import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  SlidersHorizontal,
  UtensilsCrossed,
  Wrench
} from 'lucide-react';
import { db } from '../../db/database';
import { recordDualWriteMutation } from '../../db/syncEngine';
import {
  SCALE_PRESETS,
  WEEKDAY_SHORT_PT,
  addDaysIso,
  buildCustomScale,
  getMondayOfWeekIso,
  getScaleTemplate,
  getWeekdayUtc,
  simulateMigration6x1To5x2,
  staggerSectorLunchWindows
} from '../../core/laborRulesEngine';
import type {
  Employee,
  ScaleCode,
  ScaleTemplate,
  ScheduleAssignment,
  Sector,
  ShiftDefinition,
  StatusCode,
  SundayRuleType
} from '../../types/domain';
import { LunchWindowBadge, STATUS_META } from '../ui/Badges';

interface ShiftMappingViewProps {
  month: string;
  referenceDate: string;
  onReferenceDateChange: (date: string) => void;
  employees: Employee[];
  sectors: Sector[];
  shifts: ShiftDefinition[];
  assignments: ScheduleAssignment[];
  scaleTemplates: ScaleTemplate[];
  onNotify: (msg: string) => void;
}

type HorizonMode = 'WEEK' | 'FORTNIGHT' | 'MONTH';

const ALL_STATUS_CODES: StatusCode[] = [
  'T',
  'F',
  'FE',
  'LM',
  'LP',
  'FA',
  'AT',
  'BH',
  'TR'
];

export function ShiftMappingView({
  month,
  referenceDate,
  onReferenceDateChange,
  employees,
  sectors,
  shifts,
  assignments,
  scaleTemplates,
  onNotify
}: ShiftMappingViewProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<string>('ALL');
  const [horizon, setHorizon] = useState<HorizonMode>('WEEK');
  const [showScaleTools, setShowScaleTools] = useState<boolean>(false);
  const [migrationTarget, setMigrationTarget] = useState<'5x2_42' | '5x2_40'>(
    '5x2_40'
  );

  // Estado do Construtor Customizado
  const [customName, setCustomName] = useState('Escala Especial 4x2 Noturna');
  const [customWorkDays, setCustomWorkDays] = useState(4);
  const [customRestDays, setCustomRestDays] = useState(2);
  const [customDailyHours, setCustomDailyHours] = useState(10);
  const [customDivisor, setCustomDivisor] = useState(200);
  const [customSundayRule, setCustomSundayRule] =
    useState<SundayRuleType>('EC141_PREFERENTIAL');
  const [customRequiresUnion, setCustomRequiresUnion] = useState(true);

  const sectorMap = useMemo(
    () => new Map(sectors.map((s) => [s.id, s])),
    [sectors]
  );

  const visibleDates = useMemo(() => {
    const start =
      horizon === 'MONTH'
        ? `${month}-01`
        : getMondayOfWeekIso(referenceDate);
    const count = horizon === 'WEEK' ? 7 : horizon === 'FORTNIGHT' ? 14 : 30;
    const arr: string[] = [];
    for (let i = 0; i < count; i += 1) {
      arr.push(addDaysIso(start, i));
    }
    return arr;
  }, [horizon, month, referenceDate]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.active &&
        (selectedSectorId === 'ALL' || e.sectorId === selectedSectorId)
    );
  }, [employees, selectedSectorId]);

  const assignmentLookup = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    for (const a of assignments) {
      map.set(`${a.employeeId}|${a.date}`, a);
    }
    return map;
  }, [assignments]);

  const employees6x1 = useMemo(
    () => employees.filter((e) => e.scaleCode === '6x1_44'),
    [employees]
  );

  const migrationSimulation = useMemo(
    () =>
      simulateMigration6x1To5x2({
        employeesInScale: employees6x1,
        targetScale: migrationTarget
      }),
    [employees6x1, migrationTarget]
  );

  async function handleStatusChange(
    employee: Employee,
    date: string,
    nextCode: StatusCode
  ) {
    const existing = assignmentLookup.get(`${employee.id}|${date}`);
    const tpl = getScaleTemplate(employee.scaleCode, scaleTemplates);
    const updated: ScheduleAssignment = existing
      ? {
          ...existing,
          statusCode: nextCode,
          hoursWorked:
            nextCode === 'T' || nextCode === 'TR' ? tpl.dailyHours : 0
        }
      : {
          id: `asg-${employee.id}-${date}`,
          employeeId: employee.id,
          sectorId: employee.sectorId,
          date,
          statusCode: nextCode,
          shiftCode: employee.defaultShiftCode,
          lunchWindow: 'W1_12_13',
          hoursWorked:
            nextCode === 'T' || nextCode === 'TR' ? tpl.dailyHours : 0
        };

    await db.scheduleAssignments.put(updated);
    await recordDualWriteMutation({
      entity: 'scheduleAssignments',
      entityId: updated.id,
      operation: 'UPSERT',
      action: 'UPDATE_SHIFT_STATUS',
      summary: `${employee.name} em ${date} alterado para ${nextCode}.`,
      payload: updated
    });
    onNotify(`Escala atualizada: ${employee.name} (${date}) → ${nextCode}`);
  }

  async function handleAutoStaggerLunch() {
    const targetSectors =
      selectedSectorId === 'ALL'
        ? sectors
        : sectors.filter((s) => s.id === selectedSectorId);

    let currentAssignments = [...assignments];
    let updatedTotal = 0;

    for (const dt of visibleDates) {
      for (const sec of targetSectors) {
        const result = staggerSectorLunchWindows({
          date: dt,
          sectorId: sec.id,
          assignments: currentAssignments,
          shifts
        });
        currentAssignments = result.updatedAssignments;
        updatedTotal += result.window1Count + result.window2Count;
      }
    }

    await db.scheduleAssignments.bulkPut(currentAssignments);
    await recordDualWriteMutation({
      entity: 'scheduleAssignments',
      entityId: `lunch-stagger-${referenceDate}`,
      operation: 'UPSERT',
      action: 'STAGGER_LUNCH_ART71',
      summary: `Escalonamento automático Art. 71 CLT aplicado em ${visibleDates.length} dias (${updatedTotal} turnos distribuídos).`,
      payload: { dates: visibleDates, sectorId: selectedSectorId }
    });
    onNotify(
      `Almoço escalonado (Art. 71 CLT): ${updatedTotal} turno(s) balanceados entre 12h-13h e 13h-14h.`
    );
  }

  async function handleEmployeeScaleChange(
    employee: Employee,
    nextScale: ScaleCode
  ) {
    const updatedEmp: Employee = { ...employee, scaleCode: nextScale };
    await db.employees.put(updatedEmp);
    await recordDualWriteMutation({
      entity: 'employees',
      entityId: employee.id,
      operation: 'UPSERT',
      action: 'CHANGE_EMPLOYEE_SCALE',
      summary: `${employee.name} migrado para escala ${nextScale}.`,
      payload: updatedEmp
    });
    onNotify(
      `Escala de ${employee.name} alterada instantaneamente para ${
        getScaleTemplate(nextScale, scaleTemplates).name
      }.`
    );
  }

  async function handleSaveCustomScale(e: React.FormEvent) {
    e.preventDefault();
    try {
      const customTpl = buildCustomScale({
        name: customName,
        workDays: customWorkDays,
        restDays: customRestDays,
        dailyHours: customDailyHours,
        divisor: customDivisor,
        sundayRule: customSundayRule,
        requiresUnionAgreement: customRequiresUnion
      });
      await db.scaleTemplates.put(customTpl);
      await recordDualWriteMutation({
        entity: 'scaleTemplates',
        entityId: customTpl.id,
        operation: 'UPSERT',
        action: 'CREATE_CUSTOM_SCALE',
        summary: `Criada escala customizada ${customTpl.name} (${customTpl.weeklyHours}h/sem, divisor ${customTpl.divisor}).`,
        payload: customTpl
      });
      onNotify(`Escala customizada "${customTpl.name}" salva no motor trabalhista.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao criar escala customizada.');
    }
  }

  async function handleApply6x1Migration() {
    if (employees6x1.length === 0) {
      onNotify('Nenhum colaborador restante na escala 6x1.');
      return;
    }
    const updatedEmployees = employees6x1.map((emp) => ({
      ...emp,
      scaleCode: migrationTarget,
      defaultShiftCode: migrationTarget === '5x2_42' ? 'M84' : 'M8'
    }));
    await db.employees.bulkPut(updatedEmployees);
    await recordDualWriteMutation({
      entity: 'employees',
      entityId: `migration-6x1-${migrationTarget}`,
      operation: 'UPSERT',
      action: 'MIGRATE_6X1_TO_5X2',
      summary: `Migrados ${updatedEmployees.length} colaboradores da escala 6x1 para ${migrationTarget}.`,
      payload: { employeeIds: updatedEmployees.map((e) => e.id), migrationTarget }
    });
    onNotify(
      `Migração 6x1 → ${migrationTarget} aplicada para ${updatedEmployees.length} colaborador(es)!`
    );
  }

  return (
    <section id="view-shift-mapping" className="space-y-5">
      {/* Cabeçalho e Controles */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
            <CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            Mapeamento de Turnos em Tela Única &amp; Almoço (Art. 71 CLT)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Visualize e edite horários fixos/rotativos e distribua janelas de refeição sem descobrir o balcão.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <select
            aria-label="Filtrar setor no mapeamento"
            value={selectedSectorId}
            onChange={(e) => setSelectedSectorId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="ALL">Todos os Setores ({employees.length})</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="Data de referência da grade"
            value={referenceDate}
            onChange={(e) => onReferenceDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            {(['WEEK', 'FORTNIGHT', 'MONTH'] as HorizonMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setHorizon(mode)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  horizon === mode
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {mode === 'WEEK'
                  ? 'Semanal (7d)'
                  : mode === 'FORTNIGHT'
                  ? 'Quinzenal (14d)'
                  : 'Mensal (30d)'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAutoStaggerLunch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Escalonar Almoço (Art. 71)
          </button>

          <button
            type="button"
            onClick={() => setShowScaleTools((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Motor de Escalas &amp; 6x1→5x2
          </button>
        </div>
      </div>

      {/* Motor de Escalas, Assistente 6x1->5x2 & Construtor Customizado */}
      {showScaleTools && (
        <div className="grid gap-4 lg:grid-cols-2 no-print">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <ArrowRightLeft className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              Assistente de Migração 6x1 → 5x2 (EC nº 141/2026)
            </h3>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              Simule e execute a transição gradual (42h até 15/12/2027) ou padrão constitucional (40h) com preservação salarial.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Meta Constitucional:
              </label>
              <select
                value={migrationTarget}
                onChange={(e) =>
                  setMigrationTarget(e.target.value as '5x2_42' | '5x2_40')
                }
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="5x2_42">5x2 Transição (42h — Divisor 210)</option>
                <option value="5x2_40">5x2 Constitucional (40h — Divisor 200)</option>
              </select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-slate-500 dark:text-slate-400">
                  Em 6x1 atual
                </span>
                <strong className="text-sm text-slate-900 dark:text-slate-50">
                  {employees6x1.length} colab.
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-slate-500 dark:text-slate-400">
                  Valor-Hora Médio
                </span>
                <strong className="text-sm text-emerald-700 dark:text-emerald-400">
                  +{migrationSimulation.hourlyRateIncreasePct}%
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-slate-500 dark:text-slate-400">
                  Horas Reduzidas/Sem
                </span>
                <strong className="text-sm text-slate-900 dark:text-slate-50">
                  {migrationSimulation.weeklyHoursReducedTotal}h
                </strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-slate-500 dark:text-slate-400">
                  Reforço Necessário
                </span>
                <strong className="text-sm text-blue-700 dark:text-blue-400">
                  +{migrationSimulation.additionalHeadcountNeeded} vaga(s)
                </strong>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                {migrationSimulation.legalNote}
              </span>
              <button
                type="button"
                onClick={handleApply6x1Migration}
                disabled={employees6x1.length === 0}
                className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Migrar Colaboradores 6x1
              </button>
            </div>
          </div>

          {/* Construtor Customizado */}
          <form
            onSubmit={handleSaveCustomScale}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <Wrench className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              Construtor de Escala Customizada (CustomScaleBuilder)
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
              <label className="col-span-2 sm:col-span-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Nome da Escala
                </span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Dias Trabalho
                </span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={customWorkDays}
                  onChange={(e) => setCustomWorkDays(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Folgas
                </span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={customRestDays}
                  onChange={(e) => setCustomRestDays(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Horas/Dia
                </span>
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={24}
                  value={customDailyHours}
                  onChange={(e) => setCustomDailyHours(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Divisor
                </span>
                <input
                  type="number"
                  min={100}
                  max={240}
                  value={customDivisor}
                  onChange={(e) => setCustomDivisor(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Regra Domingo
                </span>
                <select
                  value={customSundayRule}
                  onChange={(e) =>
                    setCustomSundayRule(e.target.value as SundayRuleType)
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="EC141_PREFERENTIAL">Preferencial Dom</option>
                  <option value="ART386_BIWEEKLY_15D">Quinzenal (Art. 386)</option>
                  <option value="COMMERCE_3WEEKS">Comércio 3 sem</option>
                  <option value="MTP671_7WEEKS">MTP 671 7 sem</option>
                  <option value="ALTERNATING">Alternado</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  checked={customRequiresUnion}
                  onChange={(e) => setCustomRequiresUnion(e.target.checked)}
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Exige ACT/CCT
                </span>
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Salvar Escala Customizada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Legenda de Códigos Rápidos */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
        <span className="font-bold text-slate-700 dark:text-slate-200">
          Códigos Rápidos:
        </span>
        {ALL_STATUS_CODES.map((code) => (
          <span
            key={code}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold ${STATUS_META[code].className}`}
          >
            <strong>{code}</strong> = {STATUS_META[code].label}
          </span>
        ))}
      </div>

      {/* Tabela Grade Única */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
              <th className="sticky left-0 z-10 min-w-[230px] bg-slate-100 px-3 py-2.5 font-bold dark:bg-slate-800">
                Colaborador / Setor / Escala
              </th>
              <th className="px-2 py-2.5 font-bold">Regime</th>
              <th className="px-2 py-2.5 font-bold">
                Almoço ({referenceDate.slice(5)})
              </th>
              {visibleDates.map((dt) => {
                const wd = getWeekdayUtc(dt);
                const isSunday = wd === 0;
                return (
                  <th
                    key={dt}
                    className={`min-w-[66px] px-1.5 py-2 text-center font-bold ${
                      isSunday
                        ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                        : ''
                    }`}
                  >
                    <div>{WEEKDAY_SHORT_PT[wd]}</div>
                    <div className="font-mono text-[11px] opacity-80">
                      {dt.slice(8)}/{dt.slice(5, 7)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredEmployees.map((emp) => {
              const sectorName = sectorMap.get(emp.sectorId)?.name ?? emp.sectorId;
              const refAssign = assignmentLookup.get(`${emp.id}|${referenceDate}`);
              return (
                <tr
                  key={emp.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-900">
                    <div className="font-bold text-slate-900 dark:text-slate-50">
                      {emp.name}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {sectorName} • {emp.role}
                    </div>
                    <div className="mt-1">
                      <select
                        aria-label={`Escala de ${emp.name}`}
                        value={emp.scaleCode}
                        onChange={(e) =>
                          handleEmployeeScaleChange(
                            emp,
                            e.target.value as ScaleCode
                          )
                        }
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {Object.values(SCALE_PRESETS).map((preset) => (
                          <option key={preset.code} value={preset.code}>
                            {preset.name} (Div {preset.divisor})
                          </option>
                        ))}
                        {scaleTemplates
                          .filter((t) => t.code === 'CUSTOM')
                          .map((ct) => (
                            <option key={ct.id} value="CUSTOM">
                              {ct.name} (Div {ct.divisor})
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>

                  <td className="px-2 py-2 font-semibold">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${
                        emp.regime === 'FIXO'
                          ? 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          : 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'
                      }`}
                    >
                      {emp.regime}
                    </span>
                  </td>

                  <td className="px-2 py-2">
                    {refAssign &&
                    (refAssign.statusCode === 'T' ||
                      refAssign.statusCode === 'TR') ? (
                      <LunchWindowBadge windowId={refAssign.lunchWindow} />
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>

                  {visibleDates.map((dt) => {
                    const asg = assignmentLookup.get(`${emp.id}|${dt}`);
                    const code: StatusCode = asg?.statusCode ?? 'T';
                    const meta = STATUS_META[code];
                    return (
                      <td key={dt} className="px-1 py-1.5 text-center">
                        <select
                          aria-label={`${emp.name} em ${dt}`}
                          value={code}
                          onChange={(e) =>
                            handleStatusChange(
                              emp,
                              dt,
                              e.target.value as StatusCode
                            )
                          }
                          className={`w-full cursor-pointer rounded border px-1 py-1 text-center text-xs font-bold ${meta.className}`}
                        >
                          {ALL_STATUS_CODES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

