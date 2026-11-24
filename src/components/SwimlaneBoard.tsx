import React, { useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Link2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  ColorMode,
  CustomPalette,
  MediaAttachment,
  PhaseVersionConfig,
  SgeDataset,
  StatusColorGroup,
} from '../types/sge';
import { RseStateAtVersion } from '../utils/sgeAnalytics';
import {
  formatLaneCodeAndLabel,
  getLaneDisplayName,
  getSwatchForStatus,
  getVariationShortLabel,
  statusCodeToColorGroup,
} from '../utils/sgeVisualConfig';

interface SwimlaneBoardProps {
  dataset: SgeDataset;
  selectedVersion: PhaseVersionConfig;
  rseStates: Map<string, RseStateAtVersion>;
  activeColorFilters: StatusColorGroup[];
  colorMode: ColorMode;
  palette: CustomPalette;
  searchQuery: string;
  selectedRseId: string | null;
  mediaMap: Record<string, MediaAttachment>;
  onSelectRse: (rseId: string) => void;
  onSelectKombi?: (kombiId: string) => void;
}

export const SwimlaneBoard: React.FC<SwimlaneBoardProps> = ({
  dataset,
  selectedVersion,
  rseStates,
  activeColorFilters,
  colorMode,
  palette,
  searchQuery,
  selectedRseId,
  mediaMap,
  onSelectRse,
}) => {
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());
  const [showFutureSection, setShowFutureSection] = useState(false);

  const dashboardBySpur = useMemo(
    () => new Map(dataset.dashboard.map((d) => [d.spurId, d])),
    [dataset.dashboard]
  );

  // Count uploaded photos per RSE (from events + micro-iterations)
  const photoCountByRse = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of dataset.events) {
      const key = ev.mediaRef || `event:${ev.eventId}`;
      if (mediaMap[key] || mediaMap[`event:${ev.eventId}`]) {
        map.set(ev.rseId, (map.get(ev.rseId) ?? 0) + 1);
      }
    }
    for (const m of dataset.microIterations) {
      const key = m.mediaRef || `micro:${m.id}`;
      if (mediaMap[key] || mediaMap[`micro:${m.id}`]) {
        map.set(m.rseId, (map.get(m.rseId) ?? 0) + 1);
      }
    }
    return map;
  }, [dataset.events, dataset.microIterations, mediaMap]);

  // Search haystack per RSE
  const searchMatchesRse = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set<string>();
    const eventsByRse = new Map<string, string>();
    for (const ev of dataset.events) {
      const prev = eventsByRse.get(ev.rseId) ?? '';
      eventsByRse.set(
        ev.rseId,
        `${prev} ${ev.eventId} ${ev.statusCode} ${ev.stateDescription} ${ev.rationale} ${ev.causeIdRaw} ${ev.stepIdRaw} ${ev.kombiPartIdRaw}`
      );
    }
    for (const rse of dataset.rseList) {
      const text = `${rse.rseId} ${rse.name} ${rse.spur} ${rse.origin} ${rse.currentKombiIdRaw} ${rse.functionSummary} ${rse.predecessorOrReplacement} ${eventsByRse.get(rse.rseId) ?? ''}`.toLowerCase();
      if (text.includes(q)) matched.add(rse.rseId);
    }
    return matched;
  }, [dataset.rseList, dataset.events, searchQuery]);

  const matchesColorFilter = (st: RseStateAtVersion): boolean => {
    if (activeColorFilters.length === 0) return true;
    for (const filterGroup of activeColorFilters) {
      if (filterGroup === 'KOMBI') {
        if (st.kombiIdsAtVersion.length > 0) return true;
      } else if (st.statusCode && statusCodeToColorGroup(st.statusCode) === filterGroup) {
        return true;
      } else if (filterGroup === 'REM' && (st.presence === 'removed_here' || st.presence === 'removed_earlier')) {
        return true;
      }
    }
    return false;
  };

  // Partition RSE into: active per lane, removed/replaced, and future
  const { activeByLane, removedList, futureList } = useMemo(() => {
    const byLane = new Map<string, RseStateAtVersion[]>();
    for (const lane of dataset.lanes) byLane.set(lane, []);

    const removed: RseStateAtVersion[] = [];
    const future: RseStateAtVersion[] = [];

    for (const rse of dataset.rseList) {
      const st = rseStates.get(rse.rseId);
      if (!st) continue;
      if (searchMatchesRse && !searchMatchesRse.has(rse.rseId)) continue;

      if (st.presence === 'active') {
        const list = byLane.get(rse.spur) ?? [];
        list.push(st);
        byLane.set(rse.spur, list);
      } else if (st.presence === 'removed_here' || st.presence === 'removed_earlier') {
        removed.push(st);
      } else {
        future.push(st);
      }
    }

    // Sort removed: items removed IN this exact version come first
    removed.sort((a, b) => {
      if (a.presence === 'removed_here' && b.presence !== 'removed_here') return -1;
      if (a.presence !== 'removed_here' && b.presence === 'removed_here') return 1;
      return a.rse.rseId.localeCompare(b.rse.rseId, 'de', { numeric: true });
    });

    return { activeByLane: byLane, removedList: removed, futureList: future };
  }, [dataset.lanes, dataset.rseList, rseStates, searchMatchesRse]);

  const toggleLaneDeepDive = (spurId: string) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(spurId)) next.delete(spurId);
      else next.add(spurId);
      return next;
    });
  };

  const renderRseCard = (st: RseStateAtVersion, isLaneExpanded: boolean) => {
    const { rse, statusCode, eventAtVersion, latestEventUpToVersion, kombiIdsAtVersion, presence } =
      st;
    const isMatch = matchesColorFilter(st);
    const isSelected = selectedRseId === rse.rseId;
    const isRemoved = presence === 'removed_here' || presence === 'removed_earlier';
    const effectiveCode = isRemoved ? 'REM' : statusCode;
    const swatch = getSwatchForStatus(effectiveCode, colorMode, palette, rse.currentLifecycle);
    const photoCount = photoCountByRse.get(rse.rseId) ?? 0;
    const activeDescription =
      eventAtVersion?.stateDescription ||
      latestEventUpToVersion?.stateDescription ||
      rse.functionSummary;

    return (
      <article
        key={rse.rseId}
        role="button"
        tabIndex={0}
        onClick={() => onSelectRse(rse.rseId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectRse(rse.rseId);
          }
        }}
        style={{
          backgroundColor: swatch.bg,
          borderColor: swatch.border,
          borderStyle: swatch.dashed ? 'dashed' : 'solid',
        }}
        className={`group relative flex flex-col justify-between rounded-lg border-2 p-2.5 text-left transition-all cursor-pointer ${
          isSelected
            ? 'ring-2 ring-slate-900 ring-offset-2 shadow-md dark:ring-white dark:ring-offset-slate-950'
            : 'hover:shadow-sm hover:brightness-[0.98]'
        } ${!isMatch ? 'opacity-20 saturate-50 hover:opacity-75' : 'opacity-100'}`}
      >
        {/* Top line: RSE_ID + Status_Code badge + Variationsart */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              style={{ color: swatch.text }}
              className="font-mono text-xs font-bold tracking-tight"
            >
              {rse.rseId}
            </span>
            {effectiveCode && (
              <span
                style={{
                  borderColor: swatch.border,
                  color: swatch.text,
                }}
                className="rounded border bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
              >
                {effectiveCode}
              </span>
            )}
            {colorMode === 'variation' && effectiveCode && (
              <span
                style={{ color: swatch.text }}
                className="font-mono text-[10px] font-semibold opacity-80"
              >
                {getVariationShortLabel(effectiveCode)}
              </span>
            )}
          </div>

          {/* Right compact indicators */}
          <div className="flex items-center gap-1 shrink-0">
            {photoCount > 0 && (
              <span
                title={`${photoCount} Foto(s) hinterlegt`}
                className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
              >
                <Camera className="h-2.5 w-2.5" />
                {photoCount}
              </span>
            )}
            {eventAtVersion && !isRemoved && (
              <span
                title={`Direktes Event in ${selectedVersion.versionKey}: ${eventAtVersion.eventId}`}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: swatch.border }}
              />
            )}
          </div>
        </div>

        {/* Title */}
        <h4
          style={{ color: swatch.text }}
          className="mt-1.5 text-[12px] font-semibold leading-snug line-clamp-2"
          title={rse.name}
        >
          {rse.name}
        </h4>

        {/* Inline preview when Spur Deep-Dive is expanded */}
        {isLaneExpanded && activeDescription && (
          <p
            style={{ color: swatch.text }}
            className="mt-1.5 border-t border-black/10 pt-1.5 text-[11px] leading-relaxed opacity-90 line-clamp-3"
          >
            {activeDescription}
          </p>
        )}

        {/* Removal info if in Removed section */}
        {isRemoved && (
          <div className="mt-1.5 space-y-0.5 text-[10px] font-medium text-red-900">
            <div>
              {presence === 'removed_here'
                ? `Entfernt / ersetzt in ${selectedVersion.versionKey}`
                : `Bereits entfernt seit ${st.removedInVersionLabel ?? rse.removalVersion}`}
            </div>
            {rse.predecessorOrReplacement && (
              <div className="truncate opacity-85" title={rse.predecessorOrReplacement}>
                {rse.predecessorOrReplacement}
              </div>
            )}
          </div>
        )}

        {/* Bottom Badges: Events count, Micro-Iterations (↻ n Iterationen), KOMBI-xx */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span
            title={`${rse.versionEventsCount} Versions-Events in RSE_Phasenwechsel`}
            className="inline-flex items-center gap-0.5 rounded bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700"
          >
            <Layers className="h-2.5 w-2.5 opacity-70" />
            <span>{rse.versionEventsCount} Ev.</span>
          </span>

          {rse.microIterationsCount > 0 && (
            <span
              title={`${rse.microIterationsCount} Mikro-Iterationen`}
              className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-800"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              <span>↻ {rse.microIterationsCount} Iterationen</span>
            </span>
          )}

          {kombiIdsAtVersion.map((kId) => (
            <span
              key={kId}
              style={{
                backgroundColor: palette.KOMBI.bg,
                borderColor: palette.KOMBI.border,
                color: palette.KOMBI.text,
              }}
              title={`Funktionsintegration ${kId}`}
              className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
            >
              <Link2 className="h-2.5 w-2.5" />
              <span>{kId}</span>
            </span>
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
      {/* 9 Systemspuren Swimlanes */}
      <div className="space-y-3">
        {dataset.lanes.map((spurId) => {
          const laneItems = activeByLane.get(spurId) ?? [];
          const dash = dashboardBySpur.get(spurId);
          const { code } = formatLaneCodeAndLabel(spurId);
          const laneTitle = getLaneDisplayName(spurId, dash?.name);
          const isExpanded = expandedLanes.has(spurId);

          // If searching and lane has 0 active items, skip empty lanes
          if (searchMatchesRse && laneItems.length === 0) return null;

          // Lane-level summary badges for current version
          const changedInVersion = laneItems.filter(
            (st) => st.eventAtVersion && st.statusCode !== 'CV' && st.statusCode !== 'BASE'
          ).length;
          const udInVersion = laneItems.filter(
            (st) => st.statusCode === 'UD-GV' || st.statusCode === 'UD-PV'
          ).length;
          const kombiCountInLane = laneItems.filter((st) => st.kombiIdsAtVersion.length > 0).length;

          return (
            <section
              key={spurId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Clickable Spur Header (toggles Spur Deep-Dive) */}
              <button
                type="button"
                onClick={() => toggleLaneDeepDive(spurId)}
                aria-expanded={isExpanded}
                className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-slate-700 shrink-0">
                    {code || spurId}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {laneTitle}
                  </h3>
                  {dash?.role && (
                    <span className="hidden lg:inline max-w-[460px] truncate text-xs text-slate-500 dark:text-slate-400">
                      — {dash.role}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums shrink-0">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {laneItems.length} aktiv
                  </span>
                  {changedInVersion > 0 && (
                    <span
                      style={{
                        backgroundColor: palette.EC.bg,
                        borderColor: palette.EC.border,
                        color: palette.EC.text,
                      }}
                      className="rounded-md border px-2 py-0.5 font-semibold"
                    >
                      {changedInVersion} geändert
                    </span>
                  )}
                  {udInVersion > 0 && (
                    <span
                      style={{
                        backgroundColor: palette.UD.bg,
                        borderColor: palette.UD.border,
                        color: palette.UD.text,
                      }}
                      className="rounded-md border px-2 py-0.5 font-semibold"
                    >
                      {udInVersion} UD
                    </span>
                  )}
                  {kombiCountInLane > 0 && (
                    <span
                      style={{
                        backgroundColor: palette.KOMBI.bg,
                        borderColor: palette.KOMBI.border,
                        color: palette.KOMBI.text,
                      }}
                      className="rounded-md border px-2 py-0.5 font-semibold"
                    >
                      {kombiCountInLane} KOMBI
                    </span>
                  )}
                  {dash && dash.microIterationsCount > 0 && (
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                      ↻ {dash.microIterationsCount}
                    </span>
                  )}
                </div>
              </button>

              {/* Spur Deep-Dive Summary Drawer (Inline) */}
              {isExpanded && dash && (
                <div className="border-b border-slate-100 bg-blue-50/40 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-blue-950/20">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        Rolle im Gesamtsystem:{' '}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">{dash.role}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        SGE-Reifegrad (v2.2):{' '}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {dash.maturitySummary}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active RSE Cards Grid */}
              <div className="p-3">
                {laneItems.length === 0 ? (
                  <p className="py-2 text-xs italic text-slate-400 dark:text-slate-500">
                    Keine aktiven RSE in dieser Spur bei {selectedVersion.versionKey}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {laneItems.map((st) => renderRseCard(st, isExpanded))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Dedicated Section: Entfernte / Ersetzte RSE (REM) */}
      {removedList.length > 0 && (
        <section className="overflow-hidden rounded-xl border-2 border-dashed border-red-300 bg-red-50/40 dark:border-red-900/70 dark:bg-red-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200/80 bg-red-50/80 px-4 py-2.5 dark:border-red-900/60 dark:bg-red-950/40">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                Entfernte / Ersetzte RSE (Stand {selectedVersion.versionKey})
              </h3>
              <span className="rounded-full bg-red-200/80 px-2 py-0.5 font-mono text-[11px] font-bold text-red-900 dark:bg-red-900/70 dark:text-red-100">
                {removedList.length}
              </span>
            </div>
            <span className="text-xs text-red-700/90 dark:text-red-300">
              Elemente mit Status REM in {selectedVersion.versionKey} oder früheren Versionen
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {removedList.map((st) => renderRseCard(st, false))}
          </div>
        </section>
      )}

      {/* Collapsible Footer Pill for Not-Yet-Introduced RSE (when slider < v2.2) */}
      {futureList.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => setShowFutureSection((p) => !p)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <span className="inline-flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Noch nicht eingeführte RSE bei {selectedVersion.versionKey}:{' '}
                <strong className="font-mono">{futureList.length}</strong> (erscheinen in späteren
                Versionen)
              </span>
            </span>
            {showFutureSection ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {showFutureSection && (
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 dark:border-slate-800">
              {futureList.map(({ rse }) => (
                <button
                  key={rse.rseId}
                  type="button"
                  onClick={() => onSelectRse(rse.rseId)}
                  className="flex flex-col items-start rounded-lg border border-slate-200 bg-white p-2.5 text-left opacity-75 transition-opacity hover:opacity-100 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                      {rse.rseId}
                    </span>
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      ab {rse.firstVersion.split(' ')[0]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                    {rse.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
