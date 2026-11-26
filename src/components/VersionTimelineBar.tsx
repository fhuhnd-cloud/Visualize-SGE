import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Flag,
  Info,
  Layers,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AppMode,
  ColorMode,
  CustomPalette,
  NomenclatureLang,
  PhaseVersionConfig,
  StatusColorGroup,
} from '../types/sge';
import { VersionKpiSnapshot } from '../utils/sgeAnalytics';
import {
  DEFAULT_SGE_PALETTE,
  SGE_LEGEND_ITEMS,
  VARIATION_MARKER_COLORS,
  formatVariationCode,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';

interface VersionTimelineBarProps {
  versions: PhaseVersionConfig[];
  selectedVersionIndex: number;
  onSelectVersionIndex: (index: number) => void;
  appMode?: AppMode;
  lang?: NomenclatureLang;
  onOpenModal?: (modal: ModalState) => void;
  kpi: VersionKpiSnapshot | null;
  activeColorFilters: StatusColorGroup[];
  onToggleColorFilter: (group: StatusColorGroup) => void;
  onSetColorFilters: (groups: StatusColorGroup[]) => void;
  colorMode: ColorMode;
  onChangeColorMode: (mode: ColorMode) => void;
  palette: CustomPalette;
  onChangePalette: (next: CustomPalette) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const VersionTimelineBar: React.FC<VersionTimelineBarProps> = ({
  versions,
  selectedVersionIndex,
  onSelectVersionIndex,
  appMode = 'presentation',
  lang = 'en',
  onOpenModal,
  kpi,
  activeColorFilters,
  onToggleColorFilter,
  onSetColorFilters,
  colorMode,
  onChangeColorMode,
  palette,
  onChangePalette,
  searchQuery,
  onSearchChange,
}) => {
  const isEdit = appMode === 'edit';
  const [infoVersionKey, setInfoVersionKey] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const currentVersion = versions[selectedVersionIndex] ?? versions[versions.length - 1];
  const inspectedVersion = infoVersionKey
    ? versions.find((v) => v.versionKey === infoVersionKey) ?? null
    : null;

  const hasFilters = activeColorFilters.length > 0 || searchQuery.trim().length > 0;

  return (
    <div className="z-20 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Row 1: Interactive Version Slider & Clickable Milestone Pills */}
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800/80 dark:bg-slate-950/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Prev/Slider/Next + Current Version Title */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={selectedVersionIndex <= 0}
                onClick={() => onSelectVersionIndex(Math.max(0, selectedVersionIndex - 1))}
                aria-label="Vorherige System-Version"
                title="Vorherige Version (←)"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={selectedVersionIndex >= versions.length - 1}
                onClick={() =>
                  onSelectVersionIndex(Math.min(versions.length - 1, selectedVersionIndex + 1))
                }
                aria-label="Nächste System-Version"
                title="Nächste Version (→)"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Interactive Range Slider */}
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {versions[0]?.versionKey ?? 'v0.0'}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, versions.length - 1)}
                step={1}
                value={selectedVersionIndex}
                onChange={(e) => onSelectVersionIndex(Number(e.target.value))}
                aria-label="System-Version auswählen"
                className="h-1.5 w-32 cursor-pointer accent-blue-600 sm:w-44 dark:accent-blue-400"
              />
              <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {versions[versions.length - 1]?.versionKey ?? 'v2.2'}
              </span>
            </div>

            {currentVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-blue-600">
                  {currentVersion.generationId} · {currentVersion.engineeringGenId}
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {currentVersion.phaseName}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setInfoVersionKey((prev) =>
                      prev === currentVersion.versionKey ? null : currentVersion.versionKey
                    )
                  }
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    infoVersionKey === currentVersion.versionKey
                      ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Info className="h-3 w-3" />
                  <span>Systemstand</span>
                </button>
                {isEdit && onOpenModal && (
                  <button
                    type="button"
                    onClick={() => onOpenModal({ kind: 'edit-version', version: currentVersion })}
                    title="Aktuelle Version / Meilenstein bearbeiten"
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Version</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Live KPI Rollup for selected version */}
          {kpi && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Aktiv: <strong className="font-mono">{kpi.activeCount}</strong>
              </span>
              <span
                className="rounded-md border px-2 py-1 font-medium"
                style={{
                  backgroundColor: palette.EC.bg,
                  borderColor: palette.EC.border,
                  color: palette.EC.text,
                }}
              >
                EC: <strong className="font-mono">{kpi.plannedChanges}</strong>
              </span>
              <span
                className="rounded-md border px-2 py-1 font-medium"
                style={{
                  backgroundColor: palette.UD.bg,
                  borderColor: palette.UD.border,
                  color: palette.UD.text,
                }}
              >
                UD: <strong className="font-mono">{kpi.unplannedDeviations}</strong>
                {kpi.unplannedDeviations > 0 && (
                  <span className="ml-1 opacity-80">
                    ({Math.round(kpi.unplannedRatio * 100)}%)
                  </span>
                )}
              </span>
              <span
                className="rounded-md border px-2 py-1 font-medium"
                style={{
                  backgroundColor: palette.CV.bg,
                  borderColor: palette.CV.border,
                  color: palette.CV.text,
                }}
              >
                {formatVariationCode('CV', lang)}:{' '}
                <strong className="font-mono">{Math.round(kpi.carryoverRatio * 100)}%</strong>
              </span>
              {kpi.removedTotalCount > 0 && (
                <span
                  className="rounded-md border border-dashed px-2 py-1 font-medium"
                  style={{
                    backgroundColor: palette.REM.bg,
                    borderColor: palette.REM.border,
                    color: palette.REM.text,
                  }}
                >
                  Entfernt: <strong className="font-mono">{kpi.removedTotalCount}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Version Stepper Pills + Clickable Milestone Badges (M1, M2, M3) */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {versions.map((ver, idx) => {
            const isSelected = idx === selectedVersionIndex;
            const isPast = idx < selectedVersionIndex;
            return (
              <div key={ver.versionKey} className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectVersionIndex(idx)}
                  className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs dark:border-blue-400 dark:bg-blue-600'
                      : isPast
                        ? 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        : 'border-slate-200 bg-slate-100/70 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  <span className="font-mono font-bold">{ver.engineeringGenId}</span>
                  <span className="hidden lg:inline max-w-[110px] truncate text-[10.5px] opacity-85">
                    {ver.versionKey} · {ver.phaseName.replace(ver.versionKey, '').trim()}
                  </span>
                </button>

                {ver.milestoneBadge && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVersionIndex(idx);
                      setInfoVersionKey((prev) =>
                        prev === ver.versionKey ? null : ver.versionKey
                      );
                    }}
                    title={`Meilenstein-Details zu ${ver.versionKey} anzeigen`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors whitespace-nowrap ${
                      ver.isMilestone
                        ? infoVersionKey === ver.versionKey
                          ? 'border-amber-600 bg-amber-500 text-white'
                          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ver.isMilestone && <Flag className="h-2.5 w-2.5 shrink-0" />}
                    <span>{ver.milestoneBadge}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Expandable Milestone / Version System State Info Card */}
        {inspectedVersion && (
          <div className="mt-2.5 flex items-start justify-between gap-4 rounded-lg border border-amber-200/90 bg-amber-50/70 px-3.5 py-2.5 text-xs dark:border-amber-800/70 dark:bg-amber-950/35">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {inspectedVersion.phaseName}
                </span>
                {inspectedVersion.milestoneBadge && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                    {inspectedVersion.isMilestone && <Flag className="h-2.5 w-2.5" />}
                    {inspectedVersion.milestoneBadge}
                  </span>
                )}
              </div>
              <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-200">
                {inspectedVersion.systemStateSummary || 'Keine Systemstand-Einordnung hinterlegt.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInfoVersionKey(null)}
              aria-label="Systemstand schließen"
              className="rounded p-1 text-slate-500 hover:bg-amber-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-amber-900/60 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Interactive SGE Legend Filter Badges + Color Mode + Custom Palette + Search */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2">
        {/* Clickable SGE Color Legend Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SGE_LEGEND_ITEMS.map((item) => {
            const swatch = palette[item.group];
            const isActive = activeColorFilters.includes(item.group);
            const count = kpi?.countsByGroup[item.group] ?? 0;
            const dimmed = activeColorFilters.length > 0 && !isActive;

            return (
              <button
                key={item.group}
                type="button"
                onClick={() => onToggleColorFilter(item.group)}
                aria-pressed={isActive}
                title={`${item.title} – ${item.subtitle} (Klicken zum Filtern/Hervorheben)`}
                style={{
                  backgroundColor: swatch.bg,
                  borderColor: swatch.border,
                  color: swatch.text,
                  borderStyle: swatch.dashed ? 'dashed' : 'solid',
                }}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-900'
                    : dimmed
                      ? 'opacity-45 hover:opacity-85'
                      : 'hover:brightness-95'
                }`}
              >
                <span className="font-mono text-[10px] font-bold">
                  {lang === 'de' && item.codeLabelDe ? item.codeLabelDe : item.codeLabel}
                </span>
                <span className="hidden 2xl:inline font-medium opacity-90">{item.title}</span>
                <span className="rounded bg-white/75 px-1 py-0.2 font-mono text-[10px] font-bold tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}

          {/* Quick filter presets */}
          <div className="ml-1 flex items-center gap-1 border-l border-slate-200 pl-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() =>
                onSetColorFilters(
                  activeColorFilters.length === 1 && activeColorFilters[0] === 'UD' ? [] : ['UD']
                )
              }
              className={`rounded px-1.5 py-1 text-[10px] font-semibold transition-colors whitespace-nowrap ${
                activeColorFilters.length === 1 && activeColorFilters[0] === 'UD'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title="Nur ungeplante Abweichungen (UD-AV & UD-PV)"
            >
              Nur UD
            </button>
            <button
              type="button"
              onClick={() =>
                onSetColorFilters(
                  activeColorFilters.length === 1 && activeColorFilters[0] === 'KOMBI'
                    ? []
                    : ['KOMBI']
                )
              }
              className={`rounded px-1.5 py-1 text-[10px] font-semibold transition-colors whitespace-nowrap ${
                activeColorFilters.length === 1 && activeColorFilters[0] === 'KOMBI'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title="Nur Funktionsintegrationen (KOMBI-xx)"
            >
              Nur KOMBI
            </button>
          </div>
        </div>

        {/* Right Controls: Search + Color Mode + Custom Palette */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="RSE, Event, KOMBI, U01..."
              aria-label="SGE-Elemente durchsuchen"
              className="h-7 w-44 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-6 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-48"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Color Mode Switcher */}
          <div
            role="group"
            aria-label="Farbmodus umschalten"
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
          >
            {(
              [
                { id: 'variation', label: `${formatVariationCode('CV', lang)} / AV / PV` },
                { id: 'planning', label: 'Fig. 2 Planung' },
                { id: 'lifecycle', label: 'Lebenszyklus' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeColorMode(m.id)}
                className={`rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                  colorMode === m.id
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Custom Palette Editor Popover */}
          <div ref={paletteRef} className="relative">
            <button
              type="button"
              onClick={() => setPaletteOpen((p) => !p)}
              title="Benutzerdefinierte SGE-Farbpalette anpassen"
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                paletteOpen
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Palette</span>
            </button>

            {paletteOpen && (
              <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>Custom SGE-Farbpalette</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChangePalette(DEFAULT_SGE_PALETTE)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Standard</span>
                  </button>
                </div>

                <div className="mt-2.5 space-y-2">
                  {SGE_LEGEND_ITEMS.map((item) => {
                    const sw = palette[item.group];
                    return (
                      <div
                        key={item.group}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {item.codeLabel}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-500">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span>BG</span>
                            <input
                              type="color"
                              value={sw.bg}
                              onChange={(e) =>
                                onChangePalette({
                                  ...palette,
                                  [item.group]: { ...sw, bg: e.target.value },
                                })
                              }
                              className="h-5 w-6 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span>Rand</span>
                            <input
                              type="color"
                              value={sw.border}
                              onChange={(e) =>
                                onChangePalette({
                                  ...palette,
                                  [item.group]: { ...sw, border: e.target.value },
                                })
                              }
                              className="h-5 w-6 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                onSetColorFilters([]);
                onSearchChange('');
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode legend note when using CV/AV/PV or Lifecycle mode */}
      {colorMode !== 'planning' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-1 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Layers className="h-3 w-3" />
            {colorMode === 'variation' ? 'Model of SGE (Variationsarten):' : 'Lebenszyklus-Farbmodus:'}
          </span>
          {colorMode === 'variation' ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span
                  style={{ backgroundColor: VARIATION_MARKER_COLORS.BASE.dot }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                G₀ Referenz
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  style={{ backgroundColor: VARIATION_MARKER_COLORS.CV.dot }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                {formatVariationCode('CV', lang)} (Carryover)
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  style={{ backgroundColor: VARIATION_MARKER_COLORS.AV.dot }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                AV (Attribute Variation)
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  style={{ backgroundColor: VARIATION_MARKER_COLORS.PV.dot }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                PV (Principle Variation)
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  style={{ backgroundColor: VARIATION_MARKER_COLORS.REM.dot }}
                  className="h-2.5 w-2.5 rounded-full"
                />
                {formatVariationCode('REM', lang)} (Entfernt / Ersetzt)
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs border border-[#16A34A] bg-[#DCFCE7]" />
                Aktiv
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs border border-[#0D9488] bg-[#CCFBF1]" />
                Aktiv (Integriert / KOMBI)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-[#DC2626] bg-[#FECACA]" />
                Entfernt / Ersetzt
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
