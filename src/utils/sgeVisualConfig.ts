import {
  ColorMode,
  CustomPalette,
  EdgeCategory,
  PaletteSwatch,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';

export const CANONICAL_SGE_LANES = [
  'S1_Rahmen_Peripherie',
  'S2_Band_vorne',
  'S3_Band_hinten',
  'S4_NFC_Erkennung',
  'S5_Objekterkennung',
  'S6_Auswurf',
  'S7_Elektronik_Energie',
  'S8_Anlagen_Software',
  'S9_Benutzeroberflaeche',
] as const;

/** Mandatory SGE & Figure 2 color palette */
export const DEFAULT_SGE_PALETTE: CustomPalette = {
  BASE: {
    bg: '#E2E8F0',
    border: '#64748B',
    text: '#1E293B',
  },
  CV: {
    bg: '#DBEAFE',
    border: '#2563EB',
    text: '#1E3A8A',
  },
  NEW: {
    bg: '#F3E8FF',
    border: '#7C3AED',
    text: '#4C1D95',
  },
  EC: {
    bg: '#FFEDD5',
    border: '#EA580C',
    text: '#7C2D12',
  },
  UD: {
    bg: '#FEF08A',
    border: '#CA8A04',
    text: '#713F12',
  },
  REM: {
    bg: '#FECACA',
    border: '#DC2626',
    text: '#7F1D1D',
    dashed: true,
  },
  KOMBI: {
    bg: '#CCFBF1',
    border: '#0D9488',
    text: '#134E4A',
  },
};

export interface LegendItemMeta {
  group: StatusColorGroup;
  codeLabel: string;
  title: string;
  subtitle: string;
}

export const SGE_LEGEND_ITEMS: LegendItemMeta[] = [
  {
    group: 'BASE',
    codeLabel: 'BASE',
    title: 'Ausgangsstand',
    subtitle: 'Gen. n-1 Referenz',
  },
  {
    group: 'CV',
    codeLabel: 'CV',
    title: 'Carry over',
    subtitle: 'Übernahmevariation (ÜV)',
  },
  {
    group: 'NEW',
    codeLabel: 'NEW',
    title: 'Newly added',
    subtitle: 'Neu & Extern',
  },
  {
    group: 'EC',
    codeLabel: 'EC-GV / EC-PV',
    title: 'Engineering change',
    subtitle: 'Geplante Änderung',
  },
  {
    group: 'UD',
    codeLabel: 'UD-GV / UD-PV',
    title: 'Unplanned deviation',
    subtitle: 'Ungeplante Abweichung',
  },
  {
    group: 'REM',
    codeLabel: 'REM',
    title: 'Removed',
    subtitle: 'Entfernt / ersetzt',
  },
  {
    group: 'KOMBI',
    codeLabel: 'KOMBI-xx',
    title: 'Funktionsintegration',
    subtitle: 'Verschmolzene RSE',
  },
];

export const ALL_STATUS_CODES: StatusCode[] = [
  'BASE',
  'CV',
  'NEW',
  'EC-GV',
  'EC-PV',
  'UD-GV',
  'UD-PV',
  'REM',
];

export function statusCodeToColorGroup(code: StatusCode): StatusColorGroup {
  switch (code) {
    case 'BASE':
      return 'BASE';
    case 'CV':
      return 'CV';
    case 'NEW':
      return 'NEW';
    case 'EC-GV':
    case 'EC-PV':
      return 'EC';
    case 'UD-GV':
    case 'UD-PV':
      return 'UD';
    case 'REM':
      return 'REM';
  }
}

export function derivePlanningCategoryFromStatus(code: StatusCode): string {
  switch (code) {
    case 'BASE':
      return 'Ausgangsstand (Grau)';
    case 'CV':
      return 'Carry over (Blau)';
    case 'NEW':
      return 'Newly added (Violett)';
    case 'EC-GV':
    case 'EC-PV':
      return 'Engineering change (Orange)';
    case 'UD-GV':
    case 'UD-PV':
      return 'Unplanned deviation (Gelb)';
    case 'REM':
      return 'Removed (Rot gestrichelt)';
  }
}

export function deriveVariationTypeFromStatus(code: StatusCode): string {
  switch (code) {
    case 'BASE':
      return 'Referenz (Gen. n-1)';
    case 'CV':
      return 'ÜV (Übernahmevariation)';
    case 'NEW':
      return 'PV (Neu / Extern)';
    case 'EC-GV':
    case 'UD-GV':
      return 'GV (Gestaltvariation)';
    case 'EC-PV':
    case 'UD-PV':
      return 'PV (Prinzipvariation)';
    case 'REM':
      return 'PV- (Entfall / Entfernt)';
  }
}

export function getSwatchForStatus(
  code: StatusCode | '',
  mode: ColorMode,
  palette: CustomPalette,
  lifecycle?: string
): PaletteSwatch {
  if (!code) {
    return {
      bg: '#F8FAFC',
      border: '#CBD5E1',
      text: '#64748B',
    };
  }

  if (mode === 'planning') {
    const group = statusCodeToColorGroup(code);
    return palette[group];
  }

  if (mode === 'variation') {
    if (code === 'BASE') {
      return { bg: '#E2E8F0', border: '#64748B', text: '#1E293B' };
    }
    if (code === 'CV') {
      return { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' };
    }
    if (code === 'EC-GV' || code === 'UD-GV') {
      // Gestaltvariation (GV): Warm Amber / Sky-Indigo contrast
      return { bg: '#E0F2FE', border: '#0284C7', text: '#0C4A6E' };
    }
    if (code === 'EC-PV' || code === 'UD-PV') {
      // Prinzipvariation (PV): Deep Magenta / Rose-Violet
      return { bg: '#FCE7F3', border: '#DB2777', text: '#831843' };
    }
    if (code === 'NEW') {
      return { bg: '#F3E8FF', border: '#7C3AED', text: '#4C1D95' };
    }
    // REM (PV-)
    return { bg: '#FECACA', border: '#DC2626', text: '#7F1D1D', dashed: true };
  }

  // lifecycle mode
  const lc = (lifecycle || '').toLowerCase();
  if (code === 'REM' || lc.includes('entfernt') || lc.includes('ersetzt')) {
    return { bg: '#FECACA', border: '#DC2626', text: '#7F1D1D', dashed: true };
  }
  if (lc.includes('integriert')) {
    return palette.KOMBI;
  }
  return { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' };
}

export function getVariationShortLabel(code: StatusCode | ''): string {
  switch (code) {
    case 'BASE':
      return 'Ref.';
    case 'CV':
      return 'ÜV';
    case 'NEW':
      return 'PV (Neu)';
    case 'EC-GV':
    case 'UD-GV':
      return 'GV';
    case 'EC-PV':
    case 'UD-PV':
      return 'PV';
    case 'REM':
      return 'PV−';
    default:
      return '—';
  }
}

export function formatLaneCodeAndLabel(raw: string): { code: string; label: string } {
  const match = raw.match(/^(S\d+)_(.*)$/i);
  if (match) {
    return {
      code: match[1].toUpperCase(),
      label: match[2]
        .replace(/_/g, ' ')
        .replace(/ae/g, 'ä')
        .replace(/oe/g, 'ö')
        .replace(/ue/g, 'ü')
        .replace('Benutzeroberflache', 'Benutzeroberfläche'),
    };
  }
  return { code: '', label: raw.replace(/_/g, ' ') };
}

/** Better German display labels for the 9 canonical lanes */
export const LANE_DISPLAY_NAMES: Record<string, string> = {
  S1_Rahmen_Peripherie: 'Rahmen & Peripherie',
  S2_Band_vorne: 'Band vorne',
  S3_Band_hinten: 'Band hinten',
  S4_NFC_Erkennung: 'NFC-Erkennung',
  S5_Objekterkennung: 'Objekterkennung',
  S6_Auswurf: 'Auswurf',
  S7_Elektronik_Energie: 'Elektronik & Energie',
  S8_Anlagen_Software: 'Anlagen-Software',
  S9_Benutzeroberflaeche: 'Benutzeroberfläche',
};

export function getLaneDisplayName(spurId: string, dashboardName?: string): string {
  if (dashboardName) return dashboardName;
  if (LANE_DISPLAY_NAMES[spurId]) return LANE_DISPLAY_NAMES[spurId];
  return formatLaneCodeAndLabel(spurId).label;
}

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
    strokeWidth: 3.4,
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
    label: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    shortLabel: 'Spurübergreifend',
    strokeLight: '#D97706',
    strokeDark: '#FBBF24',
    strokeWidth: 2.6,
    dashArray: '2.5 4.5',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
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
