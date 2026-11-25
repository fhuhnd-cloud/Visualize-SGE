import React, { useMemo, useState } from 'react';
import { BarChart3, Edit3, Flag, Link2, Plus, RefreshCw } from 'lucide-react';
import {
  AppMode,
  ColorMode,
  CustomPalette,
  DetailLevel,
  MediaAttachment,
  PhaseVersionConfig,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import { computeVersionKpis } from '../utils/sgeAnalytics';
import {
  formatLaneCodeAndLabel,
  getLaneDisplayName,
  getSwatchForStatus,
  getVariationShortLabel,
  statusCodeToColorGroup,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';
import { HoverTooltip, HoverTooltipData } from './HoverTooltip';
import { LightboxPayload } from './LightboxModal';
import { MediaDropzone } from './MediaDropzone';

interface RseMatrixViewProps {
  dataset: SgeDataset;
  appMode: AppMode;
  detailLevel: DetailLevel;
  selectedVersionIndex: number;
  selectedVersion: PhaseVersionConfig;
  activeColorFilters: StatusColorGroup[];
  colorMode: ColorMode;
  palette: CustomPalette;
  searchQuery: string;
  selectedRseId: string | null;
  mediaMap: Record<string, MediaAttachment>;
  onSelectRse: (rseId: string) => void;
  onSelectVersionIndex: (index: number) => void;
  onOpenModal: (modal: ModalState) => void;
  onUploadMedia: (refKey: string, file: File) => void;
  onUpdateMediaCaption: (refKey: string, caption: string) => void;
  onDeleteMedia: (refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
}

const CHART_STACK_GROUPS: { group: Exclude<StatusColorGroup, 'KOMBI'>; label: string }[] = [
  { group: 'BASE', label: 'BASE' },
  { group: 'CV', label: 'CV' },
  { group: 'NEW', label: 'NEW' },
  { group: 'EC', label: 'EC (GV+PV)' },
  { group: 'UD', label: 'UD (GV+PV)' },
  { group: 'REM', label: 'REM' },
];

export const RseMatrixView: React.FC<RseMatrixViewProps> = ({
  dataset,
  appMode,
  detailLevel,
  selectedVersionIndex,
  selectedVersion,
  activeColorFilters,
  colorMode,
  palette,
  searchQuery,
  selectedRseId,
  mediaMap,
  onSelectRse,
  onSelectVersionIndex,
  onOpenModal,
  onUploadMedia,
  onUpdateMediaCaption,
  onDeleteMedia,
  onOpenLightbox,
}) => {
  const isEdit = appMode === 'edit';
  const [tooltip, setTooltip] = useState<HoverTooltipData | null>(null);

  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );

  const dashboardBySpur = useMemo(
    () => new Map(dataset.dashboard.map((d) => [d.spurId, d])),
    [dataset.dashboard]
  );

  const versionKeyByNr = useMemo(
    () => new Map(dataset.versions.map((v) => [v.sortOrder, v.versionKey])),
    [dataset.versions]
  );

  const eventByCellKey = useMemo(() => {
    const map = new Map<string, (typeof dataset.events)[number]>();
    for (const ev of dataset.events) {
      const vk = versionKeyByNr.get(ev.versionNr);
      if (vk) map.set(`${ev.rseId}::${vk}`, ev);
    }
    return map;
  }, [dataset.events, versionKeyByNr]);

  const kpisByVersionKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeVersionKpis>>();
    for (const v of dataset.versions) {
      map.set(v.versionKey, computeVersionKpis(dataset, v));
    }
    return map;
  }, [dataset]);

  const maxBarTotal = useMemo(() => {
    let m = 1;
    for (const v of dataset.versions) {
      const k = kpisByVersionKey.get(v.versionKey);
      if (!k) continue;
      const tot = k.activeCount + k.removedHereCount;
      if (tot > m) m = tot;
    }
    return m;
  }, [dataset.versions, kpisByVersionKey]);

  const filteredMatrixRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataset.matrix.filter((row) => {
      if (!q) return true;
      const master = rseById.get(row.rseId);
      const hay = `${row.rseId} ${row.name} ${row.spur} ${row.kombiIdRaw} ${master?.functionSummary ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [dataset.matrix, rseById, searchQuery]);

  const groupedRows = useMemo(() => {
    const groups: { spurId: string; rows: typeof filteredMatrixRows }[] = [];
    for (const lane of dataset.lanes) {
      const rows = filteredMatrixRows.filter((r) => r.spur === lane);
      if (rows.length > 0) groups.push({ spurId: lane, rows });
    }
    return groups;
  }, [dataset.lanes, filteredMatrixRows]);

  const cellMatchesFilter = (statusCode: string, kombiIds: string[]): boolean => {
    if (activeColorFilters.length === 0) return true;
    for (const grp of activeColorFilters) {
      if (grp === 'KOMBI' && kombiIds.length > 0) return true;
      if (statusCode && statusCodeToColorGroup(statusCode as StatusCode) === grp) return true;
    }
    return false;
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-5 space-y-5">
      {/* Section 1: Gestapelte SGE-Balkendiagramme (SGE_Auswertung) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>
                SGE-Kennzahlen &amp; Gestapelte Versions-Auswertung (
                {dataset.versions[0]?.versionKey ?? 'v0.0'} –{' '}
                {dataset.versions[dataset.versions.length - 1]?.versionKey ?? 'v2.2'})
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Verteilung der ISEM-Kategorien, Carryover-Quote (CV) und Ungeplant-Quote (UD) je
              Systemgeneration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            {CHART_STACK_GROUPS.map((seg) => {
              const sw = palette[seg.group];
              return (
                <span key={seg.group} className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                  <span
                    style={{
                      backgroundColor: sw.bg,
                      borderColor: sw.border,
                      borderStyle: sw.dashed ? 'dashed' : 'solid',
                    }}
                    className="h-2.5 w-2.5 rounded-xs border"
                  />
                  {seg.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Stacked Bars Grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, dataset.versions.length)}, minmax(0, 1fr))`,
              }}
              className="grid items-end gap-2 sm:gap-3 pt-2"
            >
              {dataset.versions.map((ver, idx) => {
                const kpi = kpisByVersionKey.get(ver.versionKey);
                if (!kpi) return null;
                const isSel = idx === selectedVersionIndex;
                const barTotal = kpi.activeCount + kpi.removedHereCount;
                const barHeightPx = Math.max(16, Math.round((barTotal / maxBarTotal) * 148));

                return (
                  <button
                    key={ver.versionKey}
                    type="button"
                    onClick={() => onSelectVersionIndex(idx)}
                    className={`group flex flex-col items-center rounded-lg p-1.5 transition-colors ${
                      isSel
                        ? 'bg-blue-50/90 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="mb-1 font-mono text-[10px] font-bold text-slate-700 tabular-nums dark:text-slate-200">
                      {kpi.activeCount}
                      {kpi.removedHereCount > 0 ? ` (+${kpi.removedHereCount})` : ''}
                    </span>

                    {/* Stacked vertical bar */}
                    <div
                      style={{ height: 152 }}
                      className="flex w-full max-w-[54px] flex-col justify-end"
                    >
                      <div
                        style={{ height: barHeightPx }}
                        className="flex w-full flex-col-reverse overflow-hidden rounded-t-md border border-slate-300/80 shadow-2xs dark:border-slate-700"
                      >
                        {CHART_STACK_GROUPS.map((seg) => {
                          const val = kpi.countsByGroup[seg.group];
                          if (!val) return null;
                          const pct = (val / Math.max(1, barTotal)) * 100;
                          const sw = palette[seg.group];
                          return (
                            <div
                              key={seg.group}
                              style={{
                                height: `${pct}%`,
                                backgroundColor: sw.bg,
                                borderTop: `1px solid ${sw.border}`,
                                color: sw.text,
                              }}
                              title={`${ver.versionKey} · ${seg.label}: ${val} RSE`}
                              className="flex items-center justify-center overflow-hidden font-mono text-[9px] font-bold"
                            >
                              {val >= 4 ? val : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-1.5 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                      {ver.versionKey}
                    </div>
                    <div className="mt-0.5 flex flex-col items-center gap-0.5 text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
                      <span>CV {Math.round(kpi.carryoverRatio * 100)}%</span>
                      <span
                        className={
                          kpi.unplannedDeviations > 0
                            ? 'font-semibold text-amber-700 dark:text-amber-300'
                            : ''
                        }
                      >
                        UD {Math.round(kpi.unplannedRatio * 100)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right KPI Highlight Cards for Selected Version */}
          <div className="grid grid-cols-2 gap-2.5 lg:col-span-4">
            {(() => {
              const selKpi = kpisByVersionKey.get(selectedVersion.versionKey);
              if (!selKpi) return null;
              return (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      Aktive RSE ({selectedVersion.versionKey})
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                      {selKpi.activeCount}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {selKpi.countsByGroup.KOMBI} davon in KOMBI integriert
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="text-[10px] font-semibold uppercase text-blue-800 dark:text-blue-300">
                      Carryover-Quote (CV)
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-blue-900 dark:text-blue-200">
                      {Math.round(selKpi.carryoverRatio * 100)}%
                    </div>
                    <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                      {selKpi.countsByCode.CV} unverändert übernommen
                    </div>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 dark:border-orange-900/60 dark:bg-orange-950/30">
                    <div className="text-[10px] font-semibold uppercase text-orange-800 dark:text-orange-300">
                      Geplante Änderungen (EC)
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-orange-900 dark:text-orange-200">
                      {selKpi.plannedChanges}
                    </div>
                    <div className="text-[11px] text-orange-800/80 dark:text-orange-300/80">
                      {selKpi.countsByCode['EC-GV']} GV · {selKpi.countsByCode['EC-PV']} PV
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <div className="text-[10px] font-semibold uppercase text-amber-900 dark:text-amber-300">
                      Ungeplante Abweichungen (UD)
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-amber-950 dark:text-amber-200">
                      {selKpi.unplannedDeviations}
                    </div>
                    <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                      {Math.round(selKpi.unplannedRatio * 100)}% Anteil an Änderungen
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Section 2: 48 x 7 RSE_Phasenmatrix Heatmap */}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="sticky left-0 z-20 min-w-[74px] bg-slate-50 px-3 py-2.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                RSE_ID
              </th>
              <th className="min-w-[220px] px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                RSE_Bezeichnung
              </th>
              <th className="min-w-[95px] px-2.5 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                KOMBI / It.
              </th>
              {dataset.versions.map((ver, idx) => {
                const isSelected = idx === selectedVersionIndex;
                return (
                  <th
                    key={ver.versionKey}
                    onClick={() => onSelectVersionIndex(idx)}
                    className={`min-w-[102px] cursor-pointer border-l border-slate-200 px-2 py-2 text-center transition-colors dark:border-slate-800 ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-950 dark:bg-blue-950/60 dark:text-blue-100'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold">{ver.versionKey}</div>
                    <div className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {ver.phaseName.replace(ver.versionKey, '').trim()}
                    </div>
                    {ver.isMilestone && (
                      <div className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200">
                        <Flag className="h-2.5 w-2.5" />
                        <span>{ver.milestoneBadge.split(':')[0]}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {groupedRows.map(({ spurId, rows }) => {
              const { code } = formatLaneCodeAndLabel(spurId);
              const dash = dashboardBySpur.get(spurId);
              const laneLabel = getLaneDisplayName(spurId, dash?.name);

              return (
                <React.Fragment key={spurId}>
                  <tr className="bg-slate-100/85 dark:bg-slate-800/70">
                    <td
                      colSpan={3 + dataset.versions.length}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                    >
                      <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white dark:bg-slate-700">
                        {code}
                      </span>
                      <span>{laneLabel}</span>
                      <span className="ml-2 font-mono text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        ({rows.length} RSE)
                      </span>
                    </td>
                  </tr>

                  {rows.map((row) => {
                    const master = rseById.get(row.rseId);
                    const isSelected = selectedRseId === row.rseId;
                    const rowMatches = cellMatchesFilter(
                      row.statusByVersionKey[selectedVersion.versionKey] ?? '',
                      row.kombiIds
                    );

                    return (
                      <tr
                        key={row.rseId}
                        onClick={() => onSelectRse(row.rseId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/35'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        } ${!rowMatches ? 'opacity-35 hover:opacity-85' : ''}`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {row.rseId}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          <div className="line-clamp-1" title={row.name}>
                            {row.name}
                          </div>
                          {detailLevel >= 2 && master?.functionSummary && (
                            <div className="line-clamp-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                              {master.functionSummary}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {row.kombiIds.map((kId) => (
                              <span
                                key={kId}
                                style={{
                                  backgroundColor: palette.KOMBI.bg,
                                  borderColor: palette.KOMBI.border,
                                  color: palette.KOMBI.text,
                                }}
                                className="inline-flex items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[9px] font-bold"
                              >
                                <Link2 className="h-2.5 w-2.5" />
                                {kId.replace('KOMBI-', 'K')}
                              </span>
                            ))}
                            {master && master.microIterationsCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 font-mono text-[9px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                <RefreshCw className="h-2.5 w-2.5" />
                                {master.microIterationsCount}
                              </span>
                            )}
                          </div>
                        </td>

                        {dataset.versions.map((ver, idx) => {
                          const codeVal = row.statusByVersionKey[ver.versionKey] ?? '';
                          const isColSelected = idx === selectedVersionIndex;
                          const sw = getSwatchForStatus(
                            codeVal,
                            colorMode,
                            palette,
                            master?.currentLifecycle
                          );
                          const isCellHighlighted = cellMatchesFilter(codeVal, row.kombiIds);
                          const ev = eventByCellKey.get(`${row.rseId}::${ver.versionKey}`);

                          return (
                            <td
                              key={ver.versionKey}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectVersionIndex(idx);
                                if (isEdit) {
                                  onOpenModal({
                                    kind: 'upsert-event',
                                    rseId: row.rseId,
                                    versionKey: ver.versionKey,
                                    existing: ev,
                                  });
                                } else {
                                  onSelectRse(row.rseId);
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (!codeVal) return;
                                setTooltip({
                                  x: e.clientX,
                                  y: e.clientY,
                                  badge: codeVal,
                                  badgeSwatch: sw,
                                  title: `${row.rseId} · ${row.name}`,
                                  subtitle: `${ver.phaseName}${ev ? ` (${ev.eventId})` : ''}`,
                                  description: ev?.stateDescription || master?.functionSummary,
                                  rationale: ev?.rationale || undefined,
                                });
                              }}
                              onMouseMove={(e) =>
                                setTooltip((prev) =>
                                  prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                                )
                              }
                              onMouseLeave={() => setTooltip(null)}
                              className={`border-l border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-800/80 ${
                                isColSelected ? 'bg-blue-50/50 dark:bg-blue-950/25' : ''
                              }`}
                            >
                              {codeVal ? (
                                <span
                                  style={{
                                    backgroundColor: sw.bg,
                                    borderColor: sw.border,
                                    color: sw.text,
                                    borderStyle: sw.dashed ? 'dashed' : 'solid',
                                  }}
                                  className={`inline-flex min-w-[58px] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-opacity ${
                                    activeColorFilters.length > 0 && !isCellHighlighted
                                      ? 'opacity-20'
                                      : 'opacity-100'
                                  }`}
                                >
                                  {colorMode === 'variation'
                                    ? `${codeVal} · ${getVariationShortLabel(codeVal)}`
                                    : codeVal}
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] text-slate-300 dark:text-slate-700">
                                  {isEdit ? '+' : '·'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Section 3: Bauteil-Integrationen (KOMBI-01 .. KOMBI-06) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Link2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Bauteil-Integrationen ({dataset.kombis.length} KOMBI-Bauteile)</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Spurübergreifende Funktionsintegrationen – Klick auf ein RSE öffnet direkt dessen
              Deep-Dive.
            </p>
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'upsert-kombi' })}
              className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Neues KOMBI</span>
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
          {dataset.kombis.map((kombi) => {
            const refKey = kombi.mediaRef || `kombi:${kombi.kombiId}`;
            return (
              <div
                key={kombi.kombiId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{
                        backgroundColor: palette.KOMBI.bg,
                        borderColor: palette.KOMBI.border,
                        color: palette.KOMBI.text,
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-bold"
                    >
                      <Link2 className="h-3 w-3" />
                      {kombi.kombiId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        ab {kombi.integratedFromPhase}
                      </span>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => onOpenModal({ kind: 'upsert-kombi', existing: kombi })}
                          title={`${kombi.kombiId} bearbeiten`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-2 text-xs font-bold leading-snug text-slate-900 dark:text-slate-100">
                    {kombi.partName}
                  </h3>
                  <div className="mt-1 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                    {kombi.variationType} · {kombi.involvedLanes}
                  </div>
                  {detailLevel >= 2 && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {kombi.rationale}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {kombi.involvedRseIds.map((rseId) => (
                      <button
                        key={rseId}
                        type="button"
                        onClick={() => onSelectRse(rseId)}
                        className="rounded border border-teal-200 bg-teal-50/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                      >
                        {rseId}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <MediaDropzone
                    refKey={refKey}
                    mediaRefLabel={kombi.mediaRef}
                    title={`${kombi.kombiId}: ${kombi.partName}`}
                    attachment={mediaMap[refKey] ?? mediaMap[`kombi:${kombi.kombiId}`]}
                    appMode={appMode}
                    compact
                    onUploadFile={onUploadMedia}
                    onUpdateCaption={onUpdateMediaCaption}
                    onDelete={onDeleteMedia}
                    onOpenLightbox={onOpenLightbox}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <HoverTooltip data={tooltip} />
    </div>
  );
};
