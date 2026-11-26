import {
  ColorMode,
  CustomPalette,
  EdgeCategory,
  NomenclatureLang,
  PaletteSwatch,
  SgeVariationKind,
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

/** Clean high-contrast variation marker colors (for dots, corners, stacked bars, reference badges) */
export const VARIATION_MARKER_COLORS: Record<
  SgeVariationKind | 'BASE',
  { dot: string; bg: string; border: string; text: string }
> = {
  BASE: {
    dot: '#64748B',
    bg: '#F1F5F9',
    border: '#64748B',
    text: '#334155',
  },
  CV: {
    dot: '#2563EB',
    bg: '#DBEAFE',
    border: '#2563EB',
    text: '#1E3A8A',
  },
  AV: {
    dot: '#EA580C',
    bg: '#FFEDD5',
    border: '#EA580C',
    text: '#9A3412',
  },
  PV: {
    dot: '#7C3AED',
    bg: '#F3E8FF',
    border: '#7C3AED',
    text: '#5B21B6',
  },
  REM: {
    dot: '#DC2626',
    bg: '#FEE2E2',
    border: '#DC2626',
    text: '#991B1B',
  },
};

export interface LegendItemMeta {
  group: StatusColorGroup;
  codeLabel: string;
  codeLabelDe?: string;
  title: string;
  subtitle: string;
}

export const SGE_LEGEND_ITEMS: LegendItemMeta[] = [
  {
    group: 'BASE',
    codeLabel: 'BASE (G₀)',
    title: 'Referenzsystem',
    subtitle: 'Gen. n-1 Ausgangsstand',
  },
  {
    group: 'CV',
    codeLabel: 'CV',
    codeLabelDe: 'ÜV',
    title: 'Carryover Variation',
    subtitle: 'Übernahmevariation (ohne Kasten in 2D)',
  },
  {
    group: 'EC',
    codeLabel: 'AV / PV (EC)',
    title: 'Geplante Variation',
    subtitle: 'EC-AV (Attribute) & EC-PV (Principle)',
  },
  {
    group: 'UD',
    codeLabel: 'AV / PV (UD)',
    title: 'Ungeplante Abweichung',
    subtitle: 'UD-AV (Attribute) & UD-PV (Principle)',
  },
  {
    group: 'NEW',
    codeLabel: 'PV (NEW)',
    title: 'Neu / Extern',
    subtitle: 'Prinzipvariation: neu hinzugefügt',
  },
  {
    group: 'REM',
    codeLabel: 'Entfall (REM)',
    title: 'Entfernt / Ersetzt',
    subtitle: 'Prinzipvariation: Element entfernt',
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
  'EC-AV',
  'EC-PV',
  'UD-AV',
  'UD-PV',
  'REM',
];

export function statusCodeToVariationKind(code: StatusCode | ''): SgeVariationKind {
  switch (code) {
    case 'CV':
    case 'BASE':
      return 'CV';
    case 'EC-AV':
    case 'UD-AV':
      return 'AV';
    case 'REM':
      return 'REM';
    case 'NEW':
    case 'EC-PV':
    case 'UD-PV':
    default:
      return 'PV';
  }
}

export function isPlannedStatusCode(code: StatusCode): boolean {
  return code !== 'UD-AV' && code !== 'UD-PV';
}

export function statusCodeToColorGroup(code: StatusCode): StatusColorGroup {
  switch (code) {
    case 'BASE':
      return 'BASE';
    case 'CV':
      return 'CV';
    case 'NEW':
      return 'NEW';
    case 'EC-AV':
    case 'EC-PV':
      return 'EC';
    case 'UD-AV':
    case 'UD-PV':
      return 'UD';
    case 'REM':
      return 'REM';
  }
}

/** Formats canonical variation label according to EN (CV/AV/PV) or DE (ÜV/AV/PV) toggle */
export function formatVariationCode(
  kind: SgeVariationKind,
  lang: NomenclatureLang = 'en'
): string {
  if (kind === 'CV') return lang === 'de' ? 'ÜV' : 'CV';
  if (kind === 'AV') return 'AV';
  if (kind === 'PV') return 'PV';
  return lang === 'de' ? 'Entfall' : 'REM';
}

export function formatStatusCodeDisplay(
  code: StatusCode | '',
  lang: NomenclatureLang = 'en'
): string {
  if (!code) return '—';
  if (code === 'CV') return lang === 'de' ? 'ÜV' : 'CV';
  if (code === 'REM') return lang === 'de' ? 'Entfall' : 'REM';
  return code;
}

export function getVariationFullName(
  kind: SgeVariationKind,
  lang: NomenclatureLang = 'en'
): string {
  if (lang === 'de') {
    switch (kind) {
      case 'CV':
        return 'ÜV (Übernahmevariation)';
      case 'AV':
        return 'AV (Attribut-/Eigenschaftsvariation)';
      case 'PV':
        return 'PV (Prinzipvariation)';
      case 'REM':
        return 'Entfall (PV− / Entfernt)';
    }
  }
  switch (kind) {
    case 'CV':
      return 'CV (Carryover Variation)';
    case 'AV':
      return 'AV (Attribute Variation)';
    case 'PV':
      return 'PV (Principle Variation)';
    case 'REM':
      return 'REM (Removed / Principle Variation)';
  }
}

export function derivePlanningCategoryFromStatus(code: StatusCode): string {
  switch (code) {
    case 'BASE':
      return 'Referenzsystem G_0 (Grau)';
    case 'CV':
      return 'Carryover Variation (Blau)';
    case 'NEW':
      return 'Newly added / PV (Violett)';
    case 'EC-AV':
    case 'EC-PV':
      return 'Engineering change (Orange)';
    case 'UD-AV':
    case 'UD-PV':
      return 'Unplanned deviation (Gelb)';
    case 'REM':
      return 'Removed / Entfall (Rot gestrichelt)';
  }
}

export function deriveVariationTypeFromStatus(
  code: StatusCode,
  lang: NomenclatureLang = 'en'
): string {
  if (code === 'BASE') return 'Referenzsystem (G_0)';
  if (code === 'NEW') {
    return lang === 'de' ? 'PV (Prinzipvariation · Neu)' : 'PV (Principle Variation · New)';
  }
  return getVariationFullName(statusCodeToVariationKind(code), lang);
}

export function getSwatchForStatus(
  code: StatusCode | '',
  mode: ColorMode,
  palette: CustomPalette,
  lifecycle?: string
): PaletteSwatch {
  if (!code) {
    return { bg: '#F8FAFC', border: '#CBD5E1', text: '#64748B' };
  }

  if (mode === 'planning') {
    return palette[statusCodeToColorGroup(code)];
  }

  if (mode === 'variation') {
    if (code === 'BASE') return VARIATION_MARKER_COLORS.BASE;
    if (code === 'CV') return VARIATION_MARKER_COLORS.CV;
    if (code === 'EC-AV' || code === 'UD-AV') return VARIATION_MARKER_COLORS.AV;
    if (code === 'EC-PV' || code === 'UD-PV' || code === 'NEW') return VARIATION_MARKER_COLORS.PV;
    return { ...VARIATION_MARKER_COLORS.REM, dashed: true };
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

export function getVariationShortLabel(
  code: StatusCode | '',
  lang: NomenclatureLang = 'en'
): string {
  switch (code) {
    case 'BASE':
      return 'G₀';
    case 'CV':
      return lang === 'de' ? 'ÜV' : 'CV';
    case 'NEW':
      return 'PV+';
    case 'EC-AV':
    case 'UD-AV':
      return 'AV';
    case 'EC-PV':
    case 'UD-PV':
      return 'PV';
    case 'REM':
      return lang === 'de' ? 'Entfall' : 'REM';
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
