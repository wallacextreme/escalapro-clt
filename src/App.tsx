import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Cloud,
  CloudOff,
  Database,
  Download,
  FileSpreadsheet,
  Grid3X3,
  Moon,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sun,
  Upload
} from 'lucide-react';
import { db } from './db/database';
import {
  DEFAULT_ACTIVE_DATE,
  SEED_MONTH,
  ensureSeedDatabase
} from './db/seedData';
import {
  flushSyncQueueToFirebase,
  loadFirebaseSyncConfig,
  saveFirebaseSyncConfig,
  type FirebaseSyncConfig
} from './db/syncEngine';
import { useDexieLiveQuery } from './db/useLiveQuery';
import {
  exportAssignmentsCsv,
  exportFullBackupJson,
  exportWorkbook7TabsXlsx,
  importBackupOrSpreadsheetFile
} from './utils/exportImport';
import { ShiftMappingView } from './components/views/ShiftMappingView';
import { LeavePlannerView } from './components/views/LeavePlannerView';
import { CoverageMatrixView } from './components/views/CoverageMatrixView';
import { AgileSwapView } from './components/views/AgileSwapView';
import { AbsenceHistoryView } from './components/views/AbsenceHistoryView';
import { AnalyticsDashboardView } from './components/views/AnalyticsDashboardView';

type ActiveTab =
  | 'shift-mapping'
  | 'leave-planner'
  | 'coverage-matrix'
  | 'agile-swap'
  | 'absence-history'
  | 'analytics-dashboard';

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'shift-mapping',
    label: '1. Turnos & Almoço',
    shortDesc: 'Grade única + Art. 71',
    icon: CalendarDays
  },
  {
    id: 'leave-planner',
    label: '2. Folgas & Férias',
    shortDesc: 'Colisão + Art. 134 §3º',
    icon: CalendarPlus
  },
  {
    id: 'coverage-matrix',
    label: '3. Matriz Cobertura',
    shortDesc: 'Hora a hora + Simulador',
    icon: Grid3X3
  },
  {
    id: 'agile-swap',
    label: '4. Ajuste Ágil',
    shortDesc: 'Art. 66/67/59/386',
    icon: ArrowLeftRight
  },
  {
    id: 'absence-history',
    label: '5. Prontuário RH',
    shortDesc: 'DSR + Art. 130 + INSS',
    icon: FileSpreadsheet
  },
  {
    id: 'analytics-dashboard',
    label: '6. Analytics & Crise',
    shortDesc: 'Bradford + Preditivo',
    icon: BarChart3
  }
];

export function App() {
  const [seeded, setSeeded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('shift-mapping');
  const [month, setMonth] = useState<string>(SEED_MONTH);
  const [referenceDate, setReferenceDate] = useState<string>(DEFAULT_ACTIVE_DATE);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('escalapro_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [syncConfig, setSyncConfig] = useState<FirebaseSyncConfig>(() =>
    loadFirebaseSyncConfig()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ensureSeedDatabase()
      .then(() => setSeeded(true))
      .catch((err) => {
        console.error('Erro ao inicializar banco IndexedDB:', err);
        setSeeded(true);
      });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('escalapro_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage quota errors
    }
  }, [isDark]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  function notify(msg: string) {
    setToastMessage(msg);
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const { data: employees } = useDexieLiveQuery(
    () => db.employees.toArray(),
    [seeded],
    []
  );
  const { data: sectors } = useDexieLiveQuery(
    () => db.sectors.toArray(),
    [seeded],
    []
  );
  const { data: shifts } = useDexieLiveQuery(
    () => db.shifts.toArray(),
    [seeded],
    []
  );
  const { data: assignments } = useDexieLiveQuery(
    () => db.scheduleAssignments.toArray(),
    [seeded],
    []
  );
  const { data: leaves } = useDexieLiveQuery(
    () => db.leavesAndVacations.toArray(),
    [seeded],
    []
  );
  const { data: swaps } = useDexieLiveQuery(
    () => db.shiftSwaps.toArray(),
    [seeded],
    []
  );
  const { data: attendanceLogs } = useDexieLiveQuery(
    () => db.attendanceLogs.toArray(),
    [seeded],
    []
  );
  const { data: scaleTemplates } = useDexieLiveQuery(
    () => db.scaleTemplates.toArray(),
    [seeded],
    []
  );
  const { data: unionRules } = useDexieLiveQuery(
    () => db.unionRules.toArray(),
    [seeded],
    []
  );
  const { data: syncQueue } = useDexieLiveQuery(
    () => db.syncQueue.toArray(),
    [seeded],
    []
  );

  const pendingSyncCount = syncQueue.filter(
    (item) => item.status === 'PENDING'
  ).length;

  async function handleExportXlsx() {
    await exportWorkbook7TabsXlsx({
      month,
      referenceDate,
      employees,
      sectors,
      shifts,
      assignments,
      leaves,
      swaps,
      attendanceLogs,
      scaleTemplates,
      unionRules
    });
    notify(`Planilha EscalaPro_CLT_${month}.xlsx (7 abas) gerada.`);
  }

  function handleExportCsv() {
    exportAssignmentsCsv({
      month,
      employees,
      sectors,
      assignments
    });
    notify(`Arquivo EscalaPro_CLT_${month}.csv exportado.`);
  }

  async function handleExportJson() {
    await exportFullBackupJson();
    notify('Backup completo .json do IndexedDB exportado.');
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const msg = await importBackupOrSpreadsheetFile(file);
      notify(msg);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleFlushSync() {
    saveFirebaseSyncConfig(syncConfig);
    const res = await flushSyncQueueToFirebase();
    notify(res.message);
    setShowSyncModal(false);
  }

  async function handleResetSeed() {
    await ensureSeedDatabase(true);
    notify('Base inicial de 15 colaboradores e 6 setores restaurada.');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Cabeçalho exclusivo de impressão A4 Paisagem */}
      <div className="print-only mb-4 border-b-2 border-slate-800 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              EscalaPro CLT — Espelho Oficial de Escala &amp; Conformidade Trabalhista
            </h1>
            <p className="text-xs">
              CLT • EC nº 141/2026 • Portaria MTP nº 671/2021 • Lei nº 605/1949
            </p>
          </div>
          <div className="text-right text-xs">
            <div>Competência: {month}</div>
            <div>Data Referência: {referenceDate}</div>
          </div>
        </div>
      </div>

      {/* Barra Superior Executiva */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 no-print">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg">
                  EscalaPro CLT
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  EC 141/2026 &amp; MTP 671
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Offline-First IndexedDB • {employees.length} colaboradores • {sectors.length} setores
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                isOnline
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
              }`}
            >
              {isOnline ? (
                <Cloud className="h-3.5 w-3.5" />
              ) : (
                <CloudOff className="h-3.5 w-3.5" />
              )}
              {isOnline ? 'Offline-First' : 'Modo Offline'}
              {pendingSyncCount > 0 && (
                <span className="rounded-full bg-blue-700 px-1.5 text-[10px] text-white">
                  {pendingSyncCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportXlsx}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              .XLSX (7 Abas)
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              .CSV
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Database className="h-3.5 w-3.5" />
              .JSON
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileImport}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir A4
            </button>

            <button
              type="button"
              onClick={handleResetSeed}
              title="Restaurar dados iniciais de demonstração"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              aria-label="Alternar tema claro/escuro"
              onClick={() => setIsDark((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Navegação entre os 6 Motores */}
        <nav
          aria-label="Navegação principal EscalaPro CLT"
          className="mx-auto grid max-w-[1600px] grid-cols-2 gap-1.5 border-t border-slate-200 px-4 py-2 dark:border-slate-800 sm:grid-cols-3 lg:grid-cols-6"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  isActive
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold">{item.label}</div>
                  <div
                    className={`truncate text-[10px] ${
                      isActive
                        ? 'text-blue-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.shortDesc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Toast de feedback */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-md rounded-xl border border-blue-400 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg no-print"
        >
          {toastMessage}
        </div>
      )}

      {/* Modal Dual-Write Firebase Sync */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 no-print">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold">
              Dual-Write Sync (IndexedDB + Firebase RTDB)
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Toda mutação gera hash SHA-256 na fila offline <code>syncQueue</code> e respeita as regras granulares de <code>database.rules.json</code>.
            </p>
            <div className="mt-3 space-y-3 text-xs">
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={syncConfig.enabled}
                  onChange={(e) =>
                    setSyncConfig((c) => ({ ...c, enabled: e.target.checked }))
                  }
                />
                Habilitar envio para Firebase Realtime Database
              </label>
              <label className="block">
                <span className="font-bold">URL do Banco Firebase</span>
                <input
                  type="url"
                  placeholder="https://meu-projeto-default-rtdb.firebaseio.com"
                  value={syncConfig.databaseUrl}
                  onChange={(e) =>
                    setSyncConfig((c) => ({ ...c, databaseUrl: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="font-bold">Tenant ID</span>
                <input
                  type="text"
                  value={syncConfig.tenantId}
                  onChange={(e) =>
                    setSyncConfig((c) => ({ ...c, tenantId: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="rounded bg-slate-100 p-2 font-mono text-[11px] dark:bg-slate-800">
                Pendentes na fila local: {pendingSyncCount} registro(s)
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleFlushSync}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Salvar e Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-[1600px] p-4">
        {!seeded ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
            Carregando banco local IndexedDB (EscalaPro CLT)...
          </div>
        ) : (
          <>
            {activeTab === 'shift-mapping' && (
              <ShiftMappingView
                month={month}
                referenceDate={referenceDate}
                onReferenceDateChange={setReferenceDate}
                employees={employees}
                sectors={sectors}
                shifts={shifts}
                assignments={assignments}
                scaleTemplates={scaleTemplates}
                onNotify={notify}
              />
            )}

            {activeTab === 'leave-planner' && (
              <LeavePlannerView
                employees={employees}
                sectors={sectors}
                leaves={leaves}
                assignments={assignments}
                onNotify={notify}
              />
            )}

            {activeTab === 'coverage-matrix' && (
              <CoverageMatrixView
                referenceDate={referenceDate}
                onReferenceDateChange={setReferenceDate}
                employees={employees}
                sectors={sectors}
                assignments={assignments}
                shifts={shifts}
              />
            )}

            {activeTab === 'agile-swap' && (
              <AgileSwapView
                referenceDate={referenceDate}
                onReferenceDateChange={setReferenceDate}
                employees={employees}
                sectors={sectors}
                shifts={shifts}
                assignments={assignments}
                scaleTemplates={scaleTemplates}
                unionRules={unionRules}
                swaps={swaps}
                onNotify={notify}
              />
            )}

            {activeTab === 'absence-history' && (
              <AbsenceHistoryView
                month={month}
                onMonthChange={setMonth}
                employees={employees}
                sectors={sectors}
                assignments={assignments}
                attendanceLogs={attendanceLogs}
                scaleTemplates={scaleTemplates}
                onNotify={notify}
              />
            )}

            {activeTab === 'analytics-dashboard' && (
              <AnalyticsDashboardView
                month={month}
                employees={employees}
                sectors={sectors}
                shifts={shifts}
                assignments={assignments}
                attendanceLogs={attendanceLogs}
                scaleTemplates={scaleTemplates}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;

