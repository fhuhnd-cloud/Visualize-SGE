import React, { useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FlaskConical,
  Layers,
  Lightbulb,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  AppMode,
  ColorMode,
  CustomPalette,
  DetailLevel,
  MediaAttachment,
  NomenclatureLang,
  PhaseVersionConfig,
  RseReferenceLink,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import {
  RseStateAtVersion,
  getCausesForEvent,
  getLearningsForEvent,
  getMicroIterationsForRse,
} from '../utils/sgeAnalytics';
import {
  ALL_STATUS_CODES,
  VARIATION_MARKER_COLORS,
  formatLaneCodeAndLabel,
  formatStatusCodeDisplay,
  formatVariationCode,
  getLaneDisplayName,
  getSwatchForStatus,
  getVariationShortLabel,
  statusCodeToColorGroup,
  statusCodeToVariationKind,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';
import { HoverTooltip, HoverTooltipData } from './HoverTooltip';
import { ReferenceBarAndTable } from './ReferenceBarAndTable';

interface SwimlaneBoardProps {
  dataset: SgeDataset;
  selectedVersion: PhaseVersionConfig;
  rseStates: Map<string, RseStateAtVersion>;
  appMode: AppMode;
  detailLevel: DetailLevel;
  lang: NomenclatureLang;
  activeColorFilters: StatusColorGroup[];
  colorMode: ColorMode;
  palette: CustomPalette;
  searchQuery: string;
  selectedRseId: string | null;
  mediaMap: Record<string, MediaAttachment>;
  onSelectRse: (rseId: string) => void;
  onQuickStatusChange: (rseId: string, versionKey: string, nextStatus: StatusCode) => void;
  onAddEventReference: (eventId: string, ref: Omit<RseReferenceLink, 'id'>) => void;
  onUpdateEventReference: (
    eventId: string,
    refId: string,
    patch: Partial<Omit<RseReferenceLink, 'id'>>
  ) => void;
  onDeleteEventReference: (eventId: string, refId: string) => void;
  onOpenModal: (modal: ModalState) => void;
}

export const SwimlaneBoard: React.FC<SwimlaneBoardProps> = ({
  dataset,
  selectedVersion,
  rseStates,
  appMode,
  detailLevel,
  lang,
  activeColorFilters,
  colorMode,
  palette,
  searchQuery,
  selectedRseId,
  mediaMap,
  onSelectRse,
  onQuickStatusChange,
  onAddEventReference,
  onUpdateEventReference,
  onDeleteEventReference,
  onOpenModal,
}) => {
  const isEdit = appMode === 'edit';
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());
  const [showFutureSection, setShowFutureSection] = useState(false);
  const [tooltip, setTooltip] = useState<HoverTooltipData | null>(null);

  const dashboardBySpur = useMemo(
    () => new Map(dataset.dashboard.map((d) => [d.spurId, d])),
    [dataset.dashboard]
  );

  const photoInfoByRse = useMemo(() => {
    const countMap = new Map<string, number>();
    const previewMap = new Map<string, string>();
    const addPhoto = (rseId: string, url: string) => {
      countMap.set(rseId, (countMap.get(rseId) ?? 0) + 1);
      if (!previewMap.has(rseId)) previewMap.set(rseId, url);
    };
    for (const r of dataset.rseList) {
      const att = mediaMap[`rse:${r.rseId}`];
      if (att?.dataUrl) addPhoto(r.rseId, att.dataUrl);
    }
    for (const ev of dataset.events) {
      const att = (ev.mediaRef ? mediaMap[ev.mediaRef] : undefined) ?? mediaMap[`event:${ev.eventId}`];
      if (att?.dataUrl) addPhoto(ev.rseId, att.dataUrl);
    }
    for (const m of dataset.microIterations) {
      const att = (m.mediaRef ? mediaMap[m.mediaRef] : undefined) ?? mediaMap[`micro:${m.id}`];
      if (att?.dataUrl) addPhoto(m.rseId, att.dataUrl);
    }
    return { countMap, previewMap };
  }, [dataset.rseList, dataset.events, dataset.microIterations, mediaMap]);

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
    const effectiveCode = (isRemoved ? 'REM' : statusCode) as StatusCode | '';
    const swatch = getSwatchForStatus(effectiveCode, colorMode, palette, rse.currentLifecycle);
    const photoCount = photoInfoByRse.countMap.get(rse.rseId) ?? 0;
    const previewImg = photoInfoByRse.previewMap.get(rse.rseId);
    const activeEvent = eventAtVersion ?? latestEventUpToVersion;
    const activeDescription = activeEvent?.stateDescription || rse.functionSummary;

    const showShortDesc = detailLevel >= 2 || isLaneExpanded;
    const showDeepDiveInline = detailLevel === 3;
    const linkedCauses = activeEvent ? getCausesForEvent(activeEvent, dataset) : [];
    const linkedLearnings = activeEvent ? getLearningsForEvent(activeEvent, dataset) : [];
    const rseMicros = showDeepDiveInline ? getMicroIterationsForRse(rse.rseId, dataset) : [];

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
        onMouseEnter={(e) => {
          const c0 = linkedCauses[0];
          setTooltip({
            x: e.clientX,
            y: e.clientY,
            badge: effectiveCode || undefined,
            badgeSwatch: swatch,
            title: `${rse.rseId} · ${rse.name}`,
            subtitle: `${selectedVersion.phaseName}${eventAtVersion ? ` (${eventAtVersion.eventId})` : ''}`,
            description: activeDescription,
            rationale: activeEvent?.rationale || undefined,
            causeLabel: c0 ? `${c0.id}: ${c0.title}` : undefined,
            previewImageUrl: previewImg,
          });
        }}
        onMouseMove={(e) =>
          setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))
        }
        onMouseLeave={() => setTooltip(null)}
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
        <div>
          {/* Top Row: RSE_ID + Status Code (or ISEM Picker in Edit Mode) */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                style={{ color: swatch.text }}
                className="font-mono text-xs font-bold tracking-tight"
              >
                {rse.rseId}
              </span>
              {isEdit && effectiveCode ? (
                <select
                  value={effectiveCode}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    onQuickStatusChange(
                      rse.rseId,
                      selectedVersion.versionKey,
                      e.target.value as StatusCode
                    )
                  }
                  aria-label={`ISEM-Farbcode für ${rse.rseId}`}
                  className="rounded border border-black/20 bg-white/90 px-1 py-0.5 font-mono text-[10px] font-bold text-slate-900"
                >
                  {ALL_STATUS_CODES.map((c) => (
                    <option key={c} value={c}>
                      {formatStatusCodeDisplay(c, lang)}
                    </option>
                  ))}
                </select>
              ) : (
                effectiveCode && (
                  <span
                    style={{ borderColor: swatch.border, color: swatch.text }}
                    className="rounded border bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
                  >
                    {formatStatusCodeDisplay(effectiveCode, lang)}
                  </span>
                )
              )}
              {colorMode === 'variation' && effectiveCode && (
                <span
                  style={{ color: VARIATION_MARKER_COLORS[effectiveCode === 'BASE' ? 'BASE' : statusCodeToVariationKind(effectiveCode)].text }}
                  className="font-mono text-[10px] font-semibold opacity-85"
                >
                  {getVariationShortLabel(effectiveCode, lang)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {photoCount > 0 && (
                <span
                  title={`${photoCount} Foto(s)`}
                  className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                >
                  <Camera className="h-2.5 w-2.5" />
                  {photoCount}
                </span>
              )}
              {isEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenModal({ kind: 'edit-rse', rse });
                  }}
                  title={`RSE ${rse.rseId} bearbeiten`}
                  className="rounded bg-white/80 p-1 text-slate-700 hover:bg-white"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* RSE Name */}
          <h4
            style={{ color: swatch.text }}
            className="mt-1.5 text-[12px] font-semibold leading-snug line-clamp-2"
            title={rse.name}
          >
            {rse.name}
          </h4>

          {/* Stufe 2 & 3: Short state description */}
          {showShortDesc && activeDescription && (
            <p
              style={{ color: swatch.text }}
              className="mt-1.5 border-t border-black/10 pt-1.5 text-[11px] leading-relaxed opacity-90 line-clamp-2"
            >
              {activeDescription}
            </p>
          )}

          {/* Stufe 3 (Deep Dive): Inline Causes, Micro-Iterations, Learnings & Photo */}
          {showDeepDiveInline && (
            <div className="mt-2 space-y-1.5 border-t border-black/10 pt-1.5 text-[10px]">
              {linkedCauses.length > 0 && (
                <div className="space-y-1">
                  {linkedCauses.map((c) => (
                    <div key={c.id} className="rounded bg-white/80 p-1.5 text-slate-800">
                      <div className="flex items-center gap-1 font-mono font-bold text-amber-800">
                        <FlaskConical className="h-2.5 w-2.5" />
                        <span>{c.id}: {c.title}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-700">
                        <strong>Fakt:</strong> {c.observation}
                      </p>
                      {c.hypothesis && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-600">
                          <strong>Hypothese:</strong> {c.hypothesis}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {rseMicros.length > 0 && (
                <div className="rounded bg-blue-50/90 p-1.5 text-blue-950">
                  <div className="font-bold">↻ {rseMicros.length} Mikro-Iterationen:</div>
                  <div className="mt-0.5 line-clamp-2">
                    {rseMicros.map((m) => `${m.subVersionId} (${m.detailBox})`).join(' · ')}
                  </div>
                </div>
              )}

              {linkedLearnings.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {linkedLearnings.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-900"
                    >
                      <Lightbulb className="h-2.5 w-2.5" />
                      {l.id}: {l.title.slice(0, 26)}
                    </span>
                  ))}
                </div>
              )}

              {previewImg && (
<<<<<<< HEAD
                <div className="flex justify-center rounded border border-black/10 bg-white/80 p-1">
                  <img
                    src={previewImg}
                    alt={rse.name}
                    className="max-h-24 w-full object-contain"
=======
                <div className="flex items-center justify-center overflow-hidden rounded border border-black/10 bg-white/75 p-1 dark:bg-slate-900/50">
                  <img
                    src={previewImg}
                    alt={rse.name}
                    className="mx-auto block max-h-36 w-auto max-w-full rounded-xs object-contain"
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                  />
                </div>
              )}
            </div>
          )}

          {/* Removal badge when in Removed section */}
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
        </div>

        {/* Bottom Badges: Events, Micro-Iterations, KOMBI */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {detailLevel >= 2 && (
            <span
              title={`${rse.versionEventsCount} Versions-Events`}
              className="inline-flex items-center gap-0.5 rounded bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700"
            >
              <Layers className="h-2.5 w-2.5 opacity-70" />
              <span>{rse.versionEventsCount} Ev.</span>
            </span>
          )}

          {rse.microIterationsCount > 0 && (
            <span
              title={`${rse.microIterationsCount} Mikro-Iterationen`}
              className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-800"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              <span>↻ {rse.microIterationsCount}</span>
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

        {/* Detached Compact Reference Bar & Expandable Reference Table */}
        {activeEvent && (
          <ReferenceBarAndTable
            eventId={activeEvent.eventId}
            references={activeEvent.references}
            rseList={dataset.rseList}
            appMode={appMode}
            lang={lang}
            compact
            onAddReference={onAddEventReference}
            onUpdateReference={onUpdateEventReference}
            onDeleteReference={onDeleteEventReference}
            onSelectRse={onSelectRse}
          />
        )}
      </article>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
      <div className="space-y-3">
        {dataset.lanes.map((spurId) => {
          const laneItems = activeByLane.get(spurId) ?? [];
          const dash = dashboardBySpur.get(spurId);
          const { code } = formatLaneCodeAndLabel(spurId);
          const laneTitle = getLaneDisplayName(spurId, dash?.name);
          const isExpanded = expandedLanes.has(spurId);

          if (searchMatchesRse && laneItems.length === 0) return null;

          const changedInVersion = laneItems.filter(
            (st) => st.eventAtVersion && st.statusCode !== 'CV' && st.statusCode !== 'BASE'
          ).length;
          const udInVersion = laneItems.filter(
            (st) => st.statusCode === 'UD-AV' || st.statusCode === 'UD-PV'
          ).length;
          const kombiCountInLane = laneItems.filter((st) => st.kombiIdsAtVersion.length > 0).length;

          return (
            <section
              key={spurId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Spur Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => toggleLaneDeepDive(spurId)}
                  aria-expanded={isExpanded}
                  className="flex flex-1 items-center gap-2.5 min-w-0 text-left"
                >
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
                  {detailLevel >= 2 && dash?.role && (
                    <span className="hidden lg:inline max-w-[440px] truncate text-xs text-slate-500 dark:text-slate-400">
                      — {dash.role}
                    </span>
                  )}
                </button>

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
                  {isEdit && dash && (
                    <button
                      type="button"
                      onClick={() => onOpenModal({ kind: 'edit-spur', spur: dash })}
                      title="Spur bearbeiten"
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenModal({
                          kind: 'add-rse',
                          defaultSpur: spurId,
                          defaultVersionKey: selectedVersion.versionKey,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      <Plus className="h-3 w-3" />
                      <span>RSE</span>
                    </button>
                  )}
                </div>
              </div>

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
                        SGE-Reifegrad:{' '}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {dash.maturitySummary}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3">
                {laneItems.length === 0 ? (
                  <p className="py-2 text-xs italic text-slate-400 dark:text-slate-500">
                    Keine aktiven RSE in dieser Spur bei {selectedVersion.versionKey}.
                  </p>
                ) : (
                  <div
                    className={`grid grid-cols-1 gap-2.5 ${
                      detailLevel === 3
                        ? 'md:grid-cols-2 xl:grid-cols-3'
                        : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
                    }`}
                  >
                    {laneItems.map((st) => renderRseCard(st, isExpanded))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Removed / Replaced RSE Section */}
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
          </div>
          <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {removedList.map((st) => renderRseCard(st, false))}
          </div>
        </section>
      )}

      {/* Future RSE Collapse */}
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
                <strong className="font-mono">{futureList.length}</strong>
              </span>
            </span>
            {showFutureSection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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

      <HoverTooltip data={tooltip} />
    </div>
  );
};
