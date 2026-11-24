import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Flag,
  FlaskConical,
  GitBranch,
  Lightbulb,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  AppMode,
  ColorMode,
  ConnectionArrow,
  CustomPalette,
  DetailLevel,
  EdgeCategory,
  MediaAttachment,
  RsePhaseEvent,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import {
  getCausesForEvent,
  getLearningsForEvent,
} from '../utils/sgeAnalytics';
import {
  ALL_STATUS_CODES,
  EDGE_STYLES,
  formatLaneCodeAndLabel,
  getLaneDisplayName,
  getSwatchForStatus,
  statusCodeToColorGroup,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';
import { HoverTooltip, HoverTooltipData } from './HoverTooltip';

interface Swimlane2DGraphViewProps {
  dataset: SgeDataset;
  appMode: AppMode;
  detailLevel: DetailLevel;
  colorMode: ColorMode;
  palette: CustomPalette;
  activeColorFilters: StatusColorGroup[];
  searchQuery: string;
  darkMode: boolean;
  mediaMap: Record<string, MediaAttachment>;
  selectedRseId: string | null;
  selectedArrowId: string | null;
  onSelectRse: (rseId: string, versionIndex?: number) => void;
  onSelectArrow: (arrowId: string) => void;
  onQuickStatusChange: (rseId: string, versionKey: string, nextStatus: StatusCode) => void;
  onOpenModal: (modal: ModalState) => void;
}

interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface ResolvedArrow {
  arrow: ConnectionArrow;
  fromKey: string;
  toKey: string;
  fromRseId: string;
  toRseId: string;
  fromVerKey: string;
  toVerKey: string;
  sameVersion: boolean;
  sameNode: boolean;
}

const EDGE_ORDER: EdgeCategory[] = [
  'bugfix',
  'paradigmShift',
  'transfer',
  'crossLane',
  'optimization',
  'milestoneTest',
];

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.65;

export const Swimlane2DGraphView: React.FC<Swimlane2DGraphViewProps> = ({
  dataset,
  appMode,
  detailLevel,
  colorMode,
  palette,
  activeColorFilters,
  searchQuery,
  darkMode,
  mediaMap,
  selectedRseId,
  selectedArrowId,
  onSelectRse,
  onSelectArrow,
  onQuickStatusChange,
  onOpenModal,
}) => {
  const isEdit = appMode === 'edit';
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Collapsible swimlanes (all 9 lanes expanded by default, user can collapse any lane)
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [showArrows, setShowArrows] = useState(true);
  const [onlyChangeEvents, setOnlyChangeEvents] = useState(false);
  const [enabledArrowTypes, setEnabledArrowTypes] = useState<EdgeCategory[]>(EDGE_ORDER);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(0.88);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Measured node positions for SVG overlay
  const [nodeBoxes, setNodeBoxes] = useState<Map<string, BoxRect>>(new Map());
  const [contentSize, setContentSize] = useState({ width: 1800, height: 1200 });

  // Hover states & Tooltip
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<HoverTooltipData | null>(null);

  const dashboardBySpur = useMemo(
    () => new Map(dataset.dashboard.map((d) => [d.spurId, d])),
    [dataset.dashboard]
  );

  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );

  const causeById = useMemo(
    () => new Map(dataset.causes.map((c) => [c.id, c])),
    [dataset.causes]
  );

  const matrixByRse = useMemo(
    () => new Map(dataset.matrix.map((m) => [m.rseId, m])),
    [dataset.matrix]
  );

  const versionKeyByNr = useMemo(
    () => new Map(dataset.versions.map((v) => [v.sortOrder, v.versionKey])),
    [dataset.versions]
  );

  // Index events by `${rseId}::${versionKey}`
  const eventByNodeKey = useMemo(() => {
    const map = new Map<string, RsePhaseEvent>();
    for (const ev of dataset.events) {
      const vk = versionKeyByNr.get(ev.versionNr);
      if (vk) map.set(`${ev.rseId}::${vk}`, ev);
    }
    return map;
  }, [dataset.events, versionKeyByNr]);

  // Index micro-iterations by `${rseId}::${versionKey}`
  const microByNodeKey = useMemo(() => {
    const map = new Map<string, typeof dataset.microIterations>();
    for (const m of dataset.microIterations) {
      const vk = m.versionNr ? versionKeyByNr.get(m.versionNr) : undefined;
      if (!vk) continue;
      const k = `${m.rseId}::${vk}`;
      const list = map.get(k) ?? [];
      list.push(m);
      map.set(k, list);
    }
    return map;
  }, [dataset.microIterations, versionKeyByNr]);

  // Filter RSEs by search query
  const visibleRseByLane = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byLane = new Map<string, typeof dataset.rseList>();
    for (const lane of dataset.lanes) byLane.set(lane, []);
    for (const rse of dataset.rseList) {
      if (q) {
        const hay = `${rse.rseId} ${rse.name} ${rse.spur} ${rse.currentKombiIdRaw} ${rse.functionSummary}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const list = byLane.get(rse.spur) ?? [];
      list.push(rse);
      byLane.set(rse.spur, list);
    }
    return byLane;
  }, [dataset.lanes, dataset.rseList, searchQuery]);

  // Resolve all 50 causal arrows onto (RSE_ID, Version_Key) node keys
  const resolvedArrows = useMemo<ResolvedArrow[]>(() => {
    const stepMap = new Map(dataset.steps.map((s) => [s.id, s]));
    const list: ResolvedArrow[] = [];

    for (const arrow of dataset.arrows) {
      if (!enabledArrowTypes.includes(arrow.category)) continue;

      const sFrom = stepMap.get(arrow.from);
      const sTo = stepMap.get(arrow.to);

      const fromRseId = arrow.fromRseId || sFrom?.rseIds[0] || '';
      const toRseId = arrow.toRseId || sTo?.rseIds[0] || '';
      const fromVerKey =
        arrow.fromVersionKey || (sFrom?.versionNr ? versionKeyByNr.get(sFrom.versionNr) : '') || '';
      const toVerKey =
        arrow.toVersionKey || (sTo?.versionNr ? versionKeyByNr.get(sTo.versionNr) : '') || '';

      if (!fromRseId || !toRseId || !fromVerKey || !toVerKey) continue;

      const fromRse = rseById.get(fromRseId);
      const toRse = rseById.get(toRseId);
      const fromCollapsed = fromRse ? collapsedLanes.has(fromRse.spur) : false;
      const toCollapsed = toRse ? collapsedLanes.has(toRse.spur) : false;

      const fromKey = fromCollapsed
        ? `LANE::${fromRse!.spur}::${fromVerKey}`
        : `${fromRseId}::${fromVerKey}`;
      const toKey = toCollapsed
        ? `LANE::${toRse!.spur}::${toVerKey}`
        : `${toRseId}::${toVerKey}`;

      list.push({
        arrow,
        fromKey,
        toKey,
        fromRseId,
        toRseId,
        fromVerKey,
        toVerKey,
        sameVersion: fromVerKey === toVerKey,
        sameNode: fromKey === toKey,
      });
    }
    return list;
  }, [dataset.arrows, dataset.steps, enabledArrowTypes, versionKeyByNr, rseById, collapsedLanes]);

  // Measure DOM coordinates of all rendered nodes & lane summary cells
  const measureBoxes = useCallback(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const z = zoomRef.current || 1;
    const contentRect = contentEl.getBoundingClientRect();
    const els = contentEl.querySelectorAll<HTMLElement>('[data-node-key]');
    const next = new Map<string, BoxRect>();

    els.forEach((el) => {
      const key = el.dataset.nodeKey;
      if (!key) return;
      const rect = el.getBoundingClientRect();
      const left = (rect.left - contentRect.left) / z;
      const top = (rect.top - contentRect.top) / z;
      const width = rect.width / z;
      const height = rect.height / z;
      next.set(key, {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        cx: left + width / 2,
        cy: top + height / 2,
      });
    });

    setNodeBoxes(next);
    setContentSize({
      width: contentEl.scrollWidth,
      height: contentEl.scrollHeight,
    });
  }, []);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(measureBoxes);
    return () => cancelAnimationFrame(raf);
  }, [measureBoxes, dataset, collapsedLanes, detailLevel, onlyChangeEvents, searchQuery, isEdit]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const obs = new ResizeObserver(() => requestAnimationFrame(measureBoxes));
    obs.observe(contentEl);
    return () => obs.disconnect();
  }, [measureBoxes]);

  // Compute SVG paths for resolved arrows
  const computedArrowPaths = useMemo(() => {
    if (!showArrows) return [];
    const results: { resolved: ResolvedArrow; path: string }[] = [];

    for (const resolved of resolvedArrows) {
      const src = nodeBoxes.get(resolved.fromKey);
      const dst = nodeBoxes.get(resolved.toKey);
      if (!src || !dst) continue;

      let path = '';
      if (resolved.sameNode) {
        // Neat curved self-loop arc above the node (e.g. P_08, P_09)
        const x1 = src.left + src.width * 0.28;
        const x2 = src.left + src.width * 0.72;
        const y = src.top;
        path = `M ${x1} ${y} C ${x1} ${y - 26}, ${x2} ${y - 26}, ${x2} ${y - 2}`;
      } else if (resolved.sameVersion) {
        // Same version column -> curved S-arc bowing to the right of the column
        const x1 = src.right;
        const y1 = src.cy;
        const x2 = dst.right;
        const y2 = dst.cy;
        const dist = Math.abs(y2 - y1);
        const bow = Math.min(82, Math.max(30, dist * 0.16));
        path = `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 + bow} ${y2}, ${x2 + 2} ${y2}`;
      } else if (src.cx <= dst.cx) {
        // Forward cross-version arrow (left -> right)
        const x1 = src.right;
        const y1 = src.cy;
        const x2 = dst.left;
        const y2 = dst.cy;
        const dx = Math.max(42, (x2 - x1) * 0.45);
        path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 2} ${y2}`;
      } else {
        // Backward arrow
        const x1 = src.left;
        const y1 = src.cy;
        const x2 = dst.right;
        const y2 = dst.cy;
        const dx = Math.max(42, (x1 - x2) * 0.45);
        path = `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2 + 2} ${y2}`;
      }

      results.push({ resolved, path });
    }
    return results;
  }, [showArrows, resolvedArrows, nodeBoxes]);

  // Active highlight set when hovering a node or arrow
  const activeArrowIds = useMemo(() => {
    if (hoveredArrowId) return new Set([hoveredArrowId]);
    if (selectedArrowId) return new Set([selectedArrowId]);
    if (hoveredNodeKey) {
      const set = new Set<string>();
      for (const ra of resolvedArrows) {
        if (ra.fromKey === hoveredNodeKey || ra.toKey === hoveredNodeKey) {
          set.add(ra.arrow.id);
        }
      }
      return set;
    }
    return null;
  }, [hoveredArrowId, selectedArrowId, hoveredNodeKey, resolvedArrows]);

  const toggleLane = (spurId: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(spurId)) next.delete(spurId);
      else next.add(spurId);
      return next;
    });
  };

  const toggleArrowCategory = (cat: EdgeCategory) => {
    setEnabledArrowTypes((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleFitToView = () => {
    const vp = viewportRef.current;
    if (!vp || contentSize.width === 0) return;
    const scaleX = (vp.clientWidth - 40) / contentSize.width;
    const clamped = Math.min(1, Math.max(MIN_ZOOM, Number(scaleX.toFixed(2))));
    setZoom(clamped);
    setPan({ x: 16, y: 16 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + delta).toFixed(2)))));
    }
  };

  const handleMouseDownBg = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only pan when clicking empty canvas/grid background, not buttons/selects/cards
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, [data-interactive-node]')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMoveBg = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  };

  const handleMouseUpBg = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const colWidthPx = detailLevel === 3 ? 255 : detailLevel === 2 ? 210 : 172;
  const gridTemplateColumns = `220px repeat(${dataset.versions.length}, ${colWidthPx}px)`;

  const getMediaPreview = (ev: RsePhaseEvent | undefined, rseId: string): string | undefined => {
    if (ev?.mediaRef && mediaMap[ev.mediaRef]?.dataUrl) return mediaMap[ev.mediaRef].dataUrl;
    if (ev && mediaMap[`event:${ev.eventId}`]?.dataUrl) return mediaMap[`event:${ev.eventId}`].dataUrl;
    if (mediaMap[`rse:${rseId}`]?.dataUrl) return mediaMap[`rse:${rseId}`].dataUrl;
    return undefined;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* 2D Graph Controls & Arrow Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Left: Arrow Toggle + Legend Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowArrows((p) => !p)}
            aria-pressed={showArrows}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              showArrows
                ? 'border-slate-900 bg-slate-900 text-white dark:border-blue-500 dark:bg-blue-600'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {showArrows ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Pfeile ({computedArrowPaths.length})</span>
          </button>

          {showArrows &&
            EDGE_ORDER.map((cat) => {
              const st = EDGE_STYLES[cat];
              const active = enabledArrowTypes.includes(cat);
              const stroke = darkMode ? st.strokeDark : st.strokeLight;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleArrowCategory(cat)}
                  title={st.label}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-opacity ${
                    active
                      ? 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      : 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <svg width="20" height="8" aria-hidden="true">
                    <line
                      x1="0"
                      y1="4"
                      x2="15"
                      y2="4"
                      stroke={stroke}
                      strokeWidth={Math.min(3, st.strokeWidth)}
                      strokeDasharray={st.dashArray}
                    />
                    <polygon points="14,1.5 20,4 14,6.5" fill={stroke} />
                  </svg>
                  <span>{st.shortLabel}</span>
                </button>
              );
            })}
        </div>

        {/* Right: Edit Actions + Collapse/Expand + Only Changes + Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'add-rse' })}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>RSE</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-arrow' })}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>+ Pfeil</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOnlyChangeEvents((p) => !p)}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
              onlyChangeEvents
                ? 'border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-200'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
            title="Carry-over-Knoten (CV) ausblenden, um nur Änderungen hervorzuheben"
          >
            {onlyChangeEvents ? 'Nur Änderungen (ohne CV)' : 'Alle Knoten (inkl. CV)'}
          </button>

          <button
            type="button"
            onClick={() =>
              setCollapsedLanes(
                collapsedLanes.size > 0 ? new Set() : new Set(dataset.lanes)
              )
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {collapsedLanes.size > 0 ? 'Alle Spuren ausklappen' : 'Alle einklappen'}
          </button>

          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.1).toFixed(2))))}
              aria-label="Herauszoomen"
              className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center font-mono text-[10px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.1).toFixed(2))))}
              aria-label="Hineinzoomen"
              className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitToView}
              title="An Fensterbreite anpassen"
              className="border-l border-slate-200 px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.9);
                setPan({ x: 16, y: 16 });
              }}
              title="Zoom & Position zurücksetzen"
              className="border-l border-slate-200 px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Zoom/Pan 2D Canvas */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDownBg}
        onMouseMove={handleMouseMoveBg}
        onMouseUp={handleMouseUpBg}
        onMouseLeave={() => {
          handleMouseUpBg();
          setTooltip(null);
        }}
        className={`engineering-grid-bg relative flex-1 overflow-auto ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative inline-block min-w-max pb-24 pr-24"
        >
          {/* SVG Causal Arrow Overlay */}
          {showArrows && (
            <svg
              width={contentSize.width}
              height={contentSize.height}
              className="pointer-events-none absolute left-0 top-0 z-20 overflow-visible"
            >
              <defs>
                {EDGE_ORDER.map((cat) => {
                  const st = EDGE_STYLES[cat];
                  const fill = darkMode ? st.strokeDark : st.strokeLight;
                  return (
                    <marker
                      key={cat}
                      id={`sge-arrow-${cat}`}
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill={fill} />
                    </marker>
                  );
                })}
              </defs>

              {computedArrowPaths.map(({ resolved, path }) => {
                const { arrow } = resolved;
                const style = EDGE_STYLES[arrow.category];
                const stroke = darkMode ? style.strokeDark : style.strokeLight;
                const isSelected = selectedArrowId === arrow.id;
                const isHighlighted = !activeArrowIds || activeArrowIds.has(arrow.id);
                const strokeW = isSelected
                  ? style.strokeWidth + 1.4
                  : hoveredArrowId === arrow.id
                    ? style.strokeWidth + 1
                    : style.strokeWidth;

                const firstCause = arrow.causeIds.length > 0 ? causeById.get(arrow.causeIds[0]) : undefined;

                return (
                  <g
                    key={arrow.id}
                    className="pointer-events-auto cursor-pointer"
                    style={{ opacity: isHighlighted ? 0.92 : 0.14, transition: 'opacity 140ms' }}
                    onMouseEnter={(e) => {
                      setHoveredArrowId(arrow.id);
                      setTooltip({
                        x: e.clientX,
                        y: e.clientY,
                        badge: arrow.id,
                        title: `${resolved.fromRseId} (${resolved.fromVerKey}) → ${resolved.toRseId} (${resolved.toVerKey})`,
                        subtitle: arrow.arrowType,
                        rationale: arrow.rationale,
                        causeLabel: firstCause
                          ? `${firstCause.id}: ${firstCause.title}`
                          : arrow.causeIdRaw || undefined,
                      });
                    }}
                    onMouseMove={(e) => {
                      setTooltip((prev) =>
                        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                      );
                    }}
                    onMouseLeave={() => {
                      setHoveredArrowId(null);
                      setTooltip(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectArrow(arrow.id);
                    }}
                  >
                    {/* Wide invisible hit path for easy hover/click */}
                    <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
                    {/* Visible styled arrow */}
                    <path
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeW}
                      strokeDasharray={style.dashArray}
                      strokeLinecap="round"
                      markerEnd={`url(#sge-arrow-${arrow.category})`}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* X-Axis Header Row: Versions v0.0 .. v2.2 with Milestone Badges */}
          <div
            style={{ gridTemplateColumns }}
            className="sticky top-0 z-10 grid items-stretch rounded-t-xl border border-slate-300 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-r border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">
              <span>Systemspur / RSE</span>
              <span className="font-mono text-[10px] font-normal text-slate-400">
                {dataset.rseList.length} RSE
              </span>
            </div>

            {dataset.versions.map((ver) => (
              <div
                key={ver.versionKey}
                className={`border-r border-slate-200 px-2.5 py-2 last:border-r-0 dark:border-slate-800 ${
                  ver.isMilestone ? 'bg-amber-50/60 dark:bg-amber-950/25' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {ver.versionKey}
                  </span>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => onOpenModal({ kind: 'edit-version', version: ver })}
                      title="Version / Meilenstein bearbeiten"
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-800"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {ver.phaseName.replace(ver.versionKey, '').trim()}
                </div>
                {ver.milestoneBadge && (
                  <div
                    className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                      ver.isMilestone
                        ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
                        : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ver.isMilestone && <Flag className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate max-w-[140px]">{ver.milestoneBadge}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Y-Axis: 9 Collapsible Swimlanes with Individual RSE Rows */}
          <div className="divide-y divide-slate-300 rounded-b-xl border-x border-b border-slate-300 bg-white/95 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900/95">
            {dataset.lanes.map((spurId) => {
              const laneRses = visibleRseByLane.get(spurId) ?? [];
              if (searchQuery.trim() && laneRses.length === 0) return null;

              const isCollapsed = collapsedLanes.has(spurId);
              const dash = dashboardBySpur.get(spurId);
              const { code } = formatLaneCodeAndLabel(spurId);
              const laneName = getLaneDisplayName(spurId, dash?.name);

              return (
                <div key={spurId}>
                  {/* Spur Swimlane Header Row */}
                  <div
                    style={{ gridTemplateColumns }}
                    className="grid items-center bg-slate-100/90 dark:bg-slate-800/80"
                  >
                    <div className="flex items-center justify-between gap-1.5 border-r border-slate-200 px-2.5 py-2 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => toggleLane(spurId)}
                        className="flex items-center gap-1.5 min-w-0 text-left"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                        )}
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-slate-700 shrink-0">
                          {code}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {laneName}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEdit && dash && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'edit-spur', spur: dash })}
                            title="Spur bearbeiten"
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'add-rse', defaultSpur: spurId })}
                            title={`Neues RSE in ${laneName} anlegen`}
                            className="rounded bg-blue-600 p-0.5 text-white hover:bg-blue-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsed lane summary cells (act as arrow anchors when collapsed!) */}
                    {dataset.versions.map((ver) => {
                      if (!isCollapsed) {
                        return (
                          <div
                            key={ver.versionKey}
                            className="border-r border-slate-200/60 px-2 py-1.5 text-[10px] text-slate-400 last:border-r-0 dark:border-slate-700/60"
                          />
                        );
                      }

                      const activeInLane = laneRses.filter((r) => {
                        const st = matrixByRse.get(r.rseId)?.statusByVersionKey[ver.versionKey];
                        return Boolean(st) && st !== 'REM';
                      }).length;
                      const changedInLane = laneRses.filter((r) => {
                        const st = matrixByRse.get(r.rseId)?.statusByVersionKey[ver.versionKey];
                        return Boolean(st) && st !== 'CV' && st !== 'BASE';
                      }).length;

                      return (
                        <div
                          key={ver.versionKey}
                          data-node-key={`LANE::${spurId}::${ver.versionKey}`}
                          className="border-r border-slate-200/70 px-2 py-1.5 text-center last:border-r-0 dark:border-slate-700/70"
                        >
                          <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shadow-2xs dark:bg-slate-900 dark:text-slate-200">
                            <span>{activeInLane} aktiv</span>
                            {changedInLane > 0 && (
                              <span className="text-orange-700 dark:text-orange-300">
                                · {changedInLane} Δ
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Individual RSE Rows (Y-Axis) */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {laneRses.map((rse) => {
                        const matRow = matrixByRse.get(rse.rseId);
                        const isSelectedRow = selectedRseId === rse.rseId;

                        return (
                          <div
                            key={rse.rseId}
                            style={{ gridTemplateColumns }}
                            className={`grid items-stretch transition-colors ${
                              isSelectedRow
                                ? 'bg-blue-50/45 dark:bg-blue-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            {/* Sticky-feeling RSE Row Label */}
                            <div className="flex items-center justify-between gap-1.5 border-r border-slate-200 px-3 py-2 dark:border-slate-800">
                              <button
                                type="button"
                                data-interactive-node="true"
                                onClick={() => onSelectRse(rse.rseId)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                                    {rse.rseId}
                                  </span>
                                  {rse.currentKombiIds.map((kId) => (
                                    <span
                                      key={kId}
                                      style={{
                                        backgroundColor: palette.KOMBI.bg,
                                        borderColor: palette.KOMBI.border,
                                        color: palette.KOMBI.text,
                                      }}
                                      className="rounded border px-1 py-0.2 font-mono text-[9px] font-bold"
                                    >
                                      {kId.replace('KOMBI-', 'K')}
                                    </span>
                                  ))}
                                </div>
                                <div
                                  className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300"
                                  title={rse.name}
                                >
                                  {rse.name}
                                </div>
                              </button>

                              {isEdit && (
                                <button
                                  type="button"
                                  data-interactive-node="true"
                                  onClick={() => onOpenModal({ kind: 'edit-rse', rse })}
                                  title={`RSE ${rse.rseId} bearbeiten`}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 shrink-0"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              )}
                            </div>

                            {/* Version Cells (v0.0 .. v2.2) */}
                            {dataset.versions.map((ver, verIdx) => {
                              const nodeKey = `${rse.rseId}::${ver.versionKey}`;
                              const statusCode = matRow?.statusByVersionKey[ver.versionKey] ?? '';
                              const ev = eventByNodeKey.get(nodeKey);
                              const micros = microByNodeKey.get(nodeKey) ?? [];
                              const hasPhoto = Boolean(getMediaPreview(ev, rse.rseId));

                              const shouldHideCv =
                                onlyChangeEvents && statusCode === 'CV' && !ev;

                              if (!statusCode || shouldHideCv) {
                                return (
                                  <div
                                    key={ver.versionKey}
                                    className="group/cell flex items-center justify-center border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800/70"
                                  >
                                    {isEdit && (
                                      <button
                                        type="button"
                                        data-interactive-node="true"
                                        onClick={() =>
                                          onOpenModal({
                                            kind: 'upsert-event',
                                            rseId: rse.rseId,
                                            versionKey: ver.versionKey,
                                          })
                                        }
                                        title={`Neues Event für ${rse.rseId} in ${ver.versionKey} hinzufügen`}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 opacity-0 transition-opacity hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 group-hover/cell:opacity-100 dark:border-slate-700"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              const sw = getSwatchForStatus(
                                statusCode,
                                colorMode,
                                palette,
                                rse.currentLifecycle
                              );
                              const kombisAtNode = ev?.kombiPartIds ?? [];
                              const matchesFilter =
                                activeColorFilters.length === 0 ||
                                activeColorFilters.some((g) =>
                                  g === 'KOMBI'
                                    ? kombisAtNode.length > 0 || rse.currentKombiIds.length > 0
                                    : statusCodeToColorGroup(statusCode) === g
                                );
                              const isCvGhost = statusCode === 'CV' && !ev;
                              const linkedCauses = ev ? getCausesForEvent(ev, dataset) : [];
                              const linkedLearnings = ev ? getLearningsForEvent(ev, dataset) : [];

                              return (
                                <div
                                  key={ver.versionKey}
                                  className="flex items-center border-r border-slate-100 px-2.5 py-2 last:border-r-0 dark:border-slate-800/70"
                                >
                                  <div
                                    data-node-key={nodeKey}
                                    data-interactive-node="true"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelectRse(rse.rseId, verIdx)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelectRse(rse.rseId, verIdx);
                                      }
                                    }}
                                    onMouseEnter={(e) => {
                                      setHoveredNodeKey(nodeKey);
                                      const firstCause = linkedCauses[0];
                                      setTooltip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        badge: statusCode,
                                        badgeSwatch: sw,
                                        title: `${rse.rseId} · ${rse.name}`,
                                        subtitle: `${ver.phaseName}${ev ? ` (${ev.eventId})` : ' (Carry over)'}`,
                                        description: ev?.stateDescription || rse.functionSummary,
                                        rationale: ev?.rationale || undefined,
                                        causeLabel: firstCause
                                          ? `${firstCause.id}: ${firstCause.title}`
                                          : undefined,
                                        previewImageUrl: getMediaPreview(ev, rse.rseId),
                                      });
                                    }}
                                    onMouseMove={(e) => {
                                      setTooltip((prev) =>
                                        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                                      );
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredNodeKey(null);
                                      setTooltip(null);
                                    }}
                                    style={{
                                      backgroundColor: sw.bg,
                                      borderColor: sw.border,
                                      color: sw.text,
                                      borderStyle: sw.dashed ? 'dashed' : 'solid',
                                    }}
                                    className={`relative z-10 w-full cursor-pointer rounded-lg border-2 px-2 py-1.5 text-left transition-all ${
                                      isCvGhost ? 'opacity-75 hover:opacity-100' : 'shadow-2xs'
                                    } ${!matchesFilter ? 'opacity-20 hover:opacity-80' : ''} ${
                                      hoveredNodeKey === nodeKey
                                        ? 'ring-2 ring-slate-900 dark:ring-white'
                                        : ''
                                    }`}
                                  >
                                    {/* Top Row: Status Code (or Quick Picker in Edit Mode) + Icons */}
                                    <div className="flex items-center justify-between gap-1">
                                      {isEdit ? (
                                        <select
                                          value={statusCode}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) =>
                                            onQuickStatusChange(
                                              rse.rseId,
                                              ver.versionKey,
                                              e.target.value as StatusCode
                                            )
                                          }
                                          aria-label={`ISEM-Farbcode für ${rse.rseId} in ${ver.versionKey}`}
                                          className="rounded border border-black/20 bg-white/90 px-1 py-0.5 font-mono text-[10px] font-bold text-slate-900"
                                        >
                                          {ALL_STATUS_CODES.map((c) => (
                                            <option key={c} value={c}>
                                              {c}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span
                                          style={{ borderColor: sw.border }}
                                          className="rounded border bg-white/80 px-1.5 py-0.2 font-mono text-[10px] font-bold leading-tight"
                                        >
                                          {statusCode}
                                        </span>
                                      )}

                                      <div className="flex items-center gap-1 shrink-0">
                                        {kombisAtNode.length > 0 && (
                                          <span
                                            style={{
                                              backgroundColor: palette.KOMBI.bg,
                                              borderColor: palette.KOMBI.border,
                                              color: palette.KOMBI.text,
                                            }}
                                            title={kombisAtNode.join(', ')}
                                            className="inline-flex items-center rounded border px-1 py-0.2 font-mono text-[9px] font-bold"
                                          >
                                            <Link2 className="h-2.5 w-2.5" />
                                          </span>
                                        )}
                                        {micros.length > 0 && (
                                          <span
                                            title={`${micros.length} Mikro-Iterationen`}
                                            className="inline-flex items-center gap-0.5 rounded bg-white/80 px-1 font-mono text-[9px] font-bold text-blue-800"
                                          >
                                            <RefreshCw className="h-2.5 w-2.5" />
                                            {micros.length}
                                          </span>
                                        )}
                                        {hasPhoto && (
                                          <span
                                            title="Foto hinterlegt"
                                            className="inline-flex items-center rounded bg-white/80 p-0.5 text-slate-700"
                                          >
                                            <Camera className="h-2.5 w-2.5" />
                                          </span>
                                        )}
                                        {isEdit && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenModal({
                                                kind: 'upsert-event',
                                                rseId: rse.rseId,
                                                versionKey: ver.versionKey,
                                                existing: ev,
                                              });
                                            }}
                                            title="Knoten-Details bearbeiten"
                                            className="rounded bg-white/80 p-0.5 text-slate-700 hover:bg-white"
                                          >
                                            <Edit3 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stufe 2 & 3: Short description */}
                                    {detailLevel >= 2 && ev?.stateDescription && (
                                      <p className="mt-1 line-clamp-2 text-[10px] leading-snug opacity-95">
                                        {ev.stateDescription}
                                      </p>
                                    )}

                                    {/* Stufe 3 (Deep Dive): Inline Causes, Micro-Iterations, Learnings & Photo */}
                                    {detailLevel === 3 && (
                                      <div className="mt-1.5 space-y-1 border-t border-black/10 pt-1 text-[10px]">
                                        {linkedCauses.length > 0 && (
                                          <div className="space-y-0.5">
                                            {linkedCauses.map((c) => (
                                              <div
                                                key={c.id}
                                                className="rounded bg-white/75 px-1.5 py-0.5 text-[9px] text-slate-800"
                                              >
                                                <span className="inline-flex items-center gap-0.5 font-mono font-bold text-amber-800">
                                                  <FlaskConical className="h-2.5 w-2.5" />
                                                  {c.id}:
                                                </span>{' '}
                                                <span className="font-medium">{c.title}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {micros.length > 0 && (
                                          <div className="rounded bg-blue-50/90 px-1.5 py-0.5 text-[9px] text-blue-950">
                                            <strong>↻ {micros.length} Mikro-It.:</strong>{' '}
                                            {micros.map((m) => m.subVersionId).join(', ')}
                                          </div>
                                        )}
                                        {linkedLearnings.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {linkedLearnings.map((l) => (
                                              <span
                                                key={l.id}
                                                className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-900"
                                              >
                                                <Lightbulb className="h-2.5 w-2.5" />
                                                {l.id}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {getMediaPreview(ev, rse.rseId) && (
                                          <img
                                            src={getMediaPreview(ev, rse.rseId)}
                                            alt={rse.name}
                                            className="mt-1 h-16 w-full rounded object-cover"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover Tooltip Popover */}
      <HoverTooltip data={tooltip} />
    </div>
  );
};
