import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import type {
  BradfordRiskLevel,
  LunchWindowId,
  StatusCode
} from '../../types/domain';

export const STATUS_META: Record<
  StatusCode,
  { label: string; short: string; className: string }
> = {
  T: {
    label: 'Turno Normal',
    short: 'T',
    className:
      'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
  },
  F: {
    label: 'Folga / DSR',
    short: 'F',
    className:
      'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
  },
  FE: {
    label: 'Férias',
    short: 'FE',
    className:
      'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
  },
  LM: {
    label: 'Licença Médica',
    short: 'LM',
    className:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
  },
  LP: {
    label: 'Licença Legal Art. 473',
    short: 'LP',
    className:
      'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800'
  },
  FA: {
    label: 'Falta Injustificada',
    short: 'FA',
    className:
      'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
  },
  AT: {
    label: 'Atraso',
    short: 'AT',
    className:
      'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800'
  },
  BH: {
    label: 'Banco de Horas',
    short: 'BH',
    className:
      'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800'
  },
  TR: {
    label: 'Troca / Substituição',
    short: 'TR',
    className:
      'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800'
  }
};

export const LUNCH_LABELS: Record<LunchWindowId, string> = {
  W1_12_13: '1ª Janela (12:00-13:00)',
  W2_13_14: '2ª Janela (13:00-14:00)',
  NIGHT_W1_00_01: 'Noturna 1 (00:00-01:00)',
  NIGHT_W2_01_02: 'Noturna 2 (01:00-02:00)',
  NONE: 'Sem intervalo 1h'
};

export function LunchWindowBadge({ windowId }: { windowId: LunchWindowId }) {
  if (windowId === 'NONE') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        —
      </span>
    );
  }
  const isFirst = windowId === 'W1_12_13' || windowId === 'NIGHT_W1_00_01';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${
        isFirst
          ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
          : 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200'
      }`}
    >
      <Clock className="h-3 w-3" />
      {windowId === 'W1_12_13'
        ? '12h-13h'
        : windowId === 'W2_13_14'
        ? '13h-14h'
        : windowId === 'NIGHT_W1_00_01'
        ? '00h-01h'
        : '01h-02h'}
    </span>
  );
}

export function BradfordRiskBadge({ level }: { level: BradfordRiskLevel }) {
  switch (level) {
    case 'CRITICO':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          Crítico (&ge; 400)
        </span>
      );
    case 'ALTO':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-400 bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          Alto (125–399)
        </span>
      );
    case 'ATENCAO':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          Atenção (51–124)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Baixo (&lt; 50)
        </span>
      );
  }
}

export function CompliancePill({
  ok,
  label
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${
        ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
      }`}
    >
      {ok ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <ShieldAlert className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}
