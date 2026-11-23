import { EdgeCategory, StandCategory } from '../types/duckomat';

export const CANONICAL_LANES = [
  'S0_Gesamtsystem',
  'S1_Band_vorne',
  'S2_Band_hinten',
  'S3_Erkennung',
  'S4_Auswurf',
  'S5_Wasserfestigkeit',
  'S6_Software',
] as const;

export interface StandStyle {
  label: string;
  badgeText: string;
  badgeClass: string;
  dotColor: string;
}

export const STAND_STYLES: Record<StandCategory, StandStyle> = {
  final: {
    label: 'Aktueller Stand (Final)',
    badgeText: 'FINAL',
    badgeClass:
      'bg-emerald-600 text-white border-emerald-700 font-semibold tracking-wide dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-400',
    dotColor: '#16A34A',
  },
  superseded: {
    label: 'Überarbeitet / Abgelöst',
    badgeText: 'Überarbeitet',
    badgeClass:
      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700',
    dotColor: '#94A3B8',
  },
  milestone: {
    label: 'Meilenstein (Prüfpunkt)',
    badgeText: 'Meilenstein',
    badgeClass:
      'bg-amber-50 text-amber-900 border-amber-300 font-medium dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
    dotColor: '#D97706',
  },
  other: {
    label: 'Zwischenstand',
    badgeText: 'Stand',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotColor: '#64748B',
  },
};

export interface EdgeStyleConfig {
  label: string;
  shortLabel: string;
  strokeLight: string;
  strokeDark: string;
  strokeWidth: number;
  dashArray?: string;
  badgeClass: string;
}

export const EDGE_STYLES: Record<EdgeCategory, EdgeStyleConfig> = {
  optimization: {
    label: 'Weiterentwicklung (Optimierung)',
    shortLabel: 'Optimierung',
    strokeLight: '#2563EB',
    strokeDark: '#60A5FA',
    strokeWidth: 2.2,
    badgeClass:
      'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80',
  },
  bugfix: {
    label: 'Problembehebung (Fehler-Reaktion)',
    shortLabel: 'Problembehebung',
    strokeLight: '#DC2626',
    strokeDark: '#F87171',
    strokeWidth: 2.6,
    badgeClass:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/80',
  },
  paradigmShift: {
    label: 'Konzeptwechsel (Paradigmenbruch)',
    shortLabel: 'Konzeptwechsel',
    strokeLight: '#7C3AED',
    strokeDark: '#A78BFA',
    strokeWidth: 3.6,
    badgeClass:
      'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/80',
  },
  transfer: {
    label: 'Konzept-Transfer (Bewährte Lösung übernehmen)',
    shortLabel: 'Konzept-Transfer',
    strokeLight: '#16A34A',
    strokeDark: '#4ADE80',
    strokeWidth: 2.4,
    dashArray: '8 4',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
  },
  crossLane: {
    label: 'Spurübergreifende Wirkbeziehung',
    shortLabel: 'Wirkbeziehung',
    strokeLight: '#0D9488',
    strokeDark: '#2DD4BF',
    strokeWidth: 2.6,
    dashArray: '2.5 4.5',
    badgeClass:
      'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80',
  },
  milestoneTest: {
    label: 'Meilenstein-Erprobung (Praxistest)',
    shortLabel: 'Erprobung',
    strokeLight: '#64748B',
    strokeDark: '#94A3B8',
    strokeWidth: 2.0,
    dashArray: '5 4',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const EDGE_CATEGORY_ORDER: EdgeCategory[] = [
  'optimization',
  'bugfix',
  'paradigmShift',
  'transfer',
  'crossLane',
  'milestoneTest',
];

export function formatCodeAndLabel(raw: string): { code: string; label: string } {
  const laneMatch = raw.match(/^(S\d+)_(.*)$/i);
  if (laneMatch) {
    return {
      code: laneMatch[1],
      label: laneMatch[2].replace(/_/g, ' '),
    };
  }
  const phaseMatch = raw.match(/^(P\d+|M\d+)_(.*)$/i);
  if (phaseMatch) {
    return {
      code: phaseMatch[1],
      label: phaseMatch[2].replace(/_/g, ' '),
    };
  }
  return { code: '', label: raw.replace(/_/g, ' ') };
}
