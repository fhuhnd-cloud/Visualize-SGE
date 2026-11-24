import React, { useMemo } from 'react';
import { Flag, Link2, RefreshCw } from 'lucide-react';
import {
  ColorMode,
  CustomPalette,
  PhaseVersionConfig,
  SgeDataset,
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

interface RseMatrixViewProps {
  dataset: SgeDataset;
  selectedVersionIndex: number;
  selectedVersion: PhaseVersionConfig;
  activeColorFilters: StatusColorGroup[];
  colorMode: ColorMode;
  palette: CustomPalette;
  searchQuery: string;
  selectedRseId: string | null;
  onSelectRse: (rseId: string) => void;
  onSelectVersionIndex: (index: number) => void;
}

export const RseMatrixView: React.FC<RseMatrixViewProps> = ({
  dataset,
  selectedVersionIndex,
  selectedVersion,
  activeColorFilters,
  colorMode,
  palette,
  searchQuery,
  selectedRseId,
  onSelectRse,
  onSelectVersionIndex,
}) => {
  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );

  const dashboardBySpur = useMemo(
    () => new Map(dataset.dashboard.map((d) => [d.spurId, d])),
    [dataset.dashboard]
  );

  const kpisByVersionKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeVersionKpis>>();
    for (const v of dataset.versions) {
      map.set(v.versionKey, computeVersionKpis(dataset, v));
    }
    return map;
  }, [dataset]);

  const filteredMatrixRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataset.matrix.filter((row) => {
      if (!q) return true;
      const master = rseById.get(row.rseId);
      const hay = `${row.rseId} ${row.name} ${row.spur} ${row.kombiIdRaw} ${master?.functionSummary ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [dataset.matrix, rseById, searchQuery]);

  // Group rows by lane
  const groupedRows = useMemo(() => {
    const groups: { spurId: string; rows: typeof filteredMatrixRows }[] = [];
    for (const lane of dataset.lanes) {
      const rows = filteredMatrixRows.filter((r) => r.spur === lane);
      if (rows.length > 0) {
        groups.push({ spurId: lane, rows });
      }
    }
    return groups;
  }, [dataset.lanes, filteredMatrixRows]);

  const cellMatchesFilter = (
    statusCode: string,
    kombiIds: string[]
  ): boolean => {
    if (activeColorFilters.length === 0) return true;
    for (const grp of activeColorFilters) {
      if (grp === 'KOMBI' && kombiIds.length > 0) return true;
      if (statusCode && statusCodeToColorGroup(statusCode as never) === grp) return true;
    }
    return false;
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-5">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="sticky left-0 z-20 min-w-[74px] bg-slate-50 px-3 py-2.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                RSE_ID
              </th>
              <th className="min-w-[230px] px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                RSE_Bezeichnung
              </th>
              <th className="min-w-[100px] px-2.5 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
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
                  {/* Lane Group Header Row */}
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
                    const rowMatchesSelectedVersionFilter = cellMatchesFilter(
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
                        } ${!rowMatchesSelectedVersionFilter ? 'opacity-35 hover:opacity-85' : ''}`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {row.rseId}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          <div className="line-clamp-1" title={row.name}>
                            {row.name}
                          </div>
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
                              <span
                                title={`${master.microIterationsCount} Mikro-Iterationen`}
                                className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 font-mono text-[9px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              >
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

                          return (
                            <td
                              key={ver.versionKey}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectVersionIndex(idx);
                                onSelectRse(row.rseId);
                              }}
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
                                  ·
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

          {/* Live SGE Rollup Footer */}
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-mono text-[11px] tabular-nums dark:border-slate-700 dark:bg-slate-950">
            <tr>
              <td colSpan={3} className="px-3 py-2 font-sans font-bold text-slate-800 dark:text-slate-200">
                Aktive RSE (ohne REM)
              </td>
              {dataset.versions.map((ver, idx) => (
                <td
                  key={ver.versionKey}
                  className={`border-l border-slate-200 px-2 py-2 text-center font-bold dark:border-slate-800 ${
                    idx === selectedVersionIndex ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100' : ''
                  }`}
                >
                  {kpisByVersionKey.get(ver.versionKey)?.activeCount ?? 0}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-800">
              <td colSpan={3} className="px-3 py-1.5 font-sans font-semibold text-orange-800 dark:text-orange-300">
                Geplante Änderungen (EC-GV + EC-PV)
              </td>
              {dataset.versions.map((ver) => (
                <td key={ver.versionKey} className="border-l border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">
                  {kpisByVersionKey.get(ver.versionKey)?.plannedChanges ?? 0}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-800">
              <td colSpan={3} className="px-3 py-1.5 font-sans font-semibold text-amber-800 dark:text-amber-300">
                Ungeplante Abweichungen (UD-GV + UD-PV)
              </td>
              {dataset.versions.map((ver) => {
                const k = kpisByVersionKey.get(ver.versionKey);
                return (
                  <td key={ver.versionKey} className="border-l border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">
                    {k ? `${k.unplannedDeviations} (${Math.round(k.unplannedRatio * 100)}%)` : '0'}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-slate-200 dark:border-slate-800">
              <td colSpan={3} className="px-3 py-1.5 font-sans font-semibold text-blue-800 dark:text-blue-300">
                Carryover-Quote (CV / Aktiv)
              </td>
              {dataset.versions.map((ver) => {
                const k = kpisByVersionKey.get(ver.versionKey);
                return (
                  <td key={ver.versionKey} className="border-l border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">
                    {k ? `${Math.round(k.carryoverRatio * 100)}%` : '0%'}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
