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
  ImagePlus,
  Lightbulb,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import {
  AppMode,
  ConnectionArrow,
  CustomPalette,
  DetailLevel,
  EdgeCategory,
  MediaAttachment,
  NomenclatureLang,
  PhaseVersionConfig,
  RsePhaseEvent,
  RseReferenceLink,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import {
  computeVersionKpis,
  getCausesForEvent,
  getLearningsForEvent,
  groupVersionsByGeneration,
} from '../utils/sgeAnalytics';
import {
  ALL_STATUS_CODES,
  EDGE_STYLES,
  VARIATION_MARKER_COLORS,
  formatLaneCodeAndLabel,
  formatStatusCodeDisplay,
  formatVariationCode,
  getLaneDisplayName,
  statusCodeToColorGroup,
  statusCodeToVariationKind,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';
import { HoverTooltip, HoverTooltipData } from './HoverTooltip';
<<<<<<< HEAD
import { ReferenceBarAndTable } from './ReferenceBarAndTable';
=======
import { LightboxPayload } from './LightboxModal';
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17

interface Swimlane2DGraphViewProps {
  dataset: SgeDataset;
  appMode: AppMode;
  detailLevel: DetailLevel;
  lang: NomenclatureLang;
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
  onAddEventReference: (eventId: string, ref: Omit<RseReferenceLink, 'id'>) => void;
  onUpdateEventReference: (
    eventId: string,
    refId: string,
    patch: Partial<Omit<RseReferenceLink, 'id'>>
  ) => void;
  onDeleteEventReference: (eventId: string, refId: string) => void;
  onOpenModal: (modal: ModalState) => void;
  onUploadNodeMedia: (rseId: string, versionKey: string, file: File) => void;
  onDeleteNodeMedia: (rseId: string, versionKey: string, refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
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

interface VisibleColumn {
  colId: string;                 // versionKey when expanded, or `GEN::${generationId}` when collapsed
  generationId: string;
  generationName: string;
  isCondensedGen: boolean;
  /** Underlying versions covered by this column */
  versions: PhaseVersionConfig[];
  primaryVersion: PhaseVersionConfig;
  labelTop: string;              // e.g. "E_{3,2}" or "G_3"
  labelSub: string;              // e.g. "v2.0 Ultraschall" or "Antrittsvorlesung / Aktuell"
  milestoneLabel: string;
  isMilestone: boolean;
}

interface ResolvedArrow {
  arrow: ConnectionArrow;
  fromKey: string;
  toKey: string;
  fromRseId: string;
  toRseId: string;
  fromLabel: string;
  toLabel: string;
  sameColumn: boolean;
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
  lang,
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
  onAddEventReference,
  onUpdateEventReference,
  onDeleteEventReference,
  onOpenModal,
  onUploadNodeMedia,
  onDeleteNodeMedia,
  onOpenLightbox,
}) => {
  const isEdit = appMode === 'edit';
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tileFileInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<{ rseId: string; versionKey: string } | null>(null);
  const [dragOverNodeKey, setDragOverNodeKey] = useState<string | null>(null);

  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [collapsedGenerations, setCollapsedGenerations] = useState<Set<string>>(new Set());
  const [showArrows, setShowArrows] = useState(true);
  const [enabledArrowTypes, setEnabledArrowTypes] = useState<EdgeCategory[]>(EDGE_ORDER);

  // Zoom & Pan
  const [zoom, setZoom] = useState(0.88);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [nodeBoxes, setNodeBoxes] = useState<Map<string, BoxRect>>(new Map());
  const [contentSize, setContentSize] = useState({ width: 1800, height: 1200 });
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
  const versionKeyByNr = useMemo(
    () => new Map(dataset.versions.map((v) => [v.sortOrder, v.versionKey])),
    [dataset.versions]
  );
  const versionIndexByKey = useMemo(
    () => new Map(dataset.versions.map((v, i) => [v.versionKey, i])),
    [dataset.versions]
  );

  // Two-level Generation Groups (G_0 .. G_3)
  const generationGroups = useMemo(
    () => groupVersionsByGeneration(dataset.versions),
    [dataset.versions]
  );

  // Compute visible columns based on which G_n groups are expanded vs collapsed
  const visibleColumns = useMemo<VisibleColumn[]>(() => {
    const cols: VisibleColumn[] = [];
    for (const grp of generationGroups) {
      const isCollapsed = collapsedGenerations.has(grp.generationId) && grp.versions.length > 1;
      if (isCollapsed) {
        const lastVer = grp.versions[grp.versions.length - 1];
        cols.push({
          colId: `GEN::${grp.generationId}`,
          generationId: grp.generationId,
          generationName: grp.generationName,
          isCondensedGen: true,
          versions: grp.versions,
          primaryVersion: lastVer,
          labelTop: grp.generationId,
          labelSub: grp.generationName,
          milestoneLabel: grp.milestoneLabel,
          isMilestone: Boolean(grp.milestoneLabel),
        });
      } else {
        for (const ver of grp.versions) {
          cols.push({
            colId: ver.versionKey,
            generationId: grp.generationId,
            generationName: grp.generationName,
            isCondensedGen: false,
            versions: [ver],
            primaryVersion: ver,
            labelTop: ver.engineeringGenId || ver.versionKey,
            labelSub: ver.phaseName,
            milestoneLabel: ver.milestoneLabel || ver.milestoneBadge,
            isMilestone: ver.isMilestone,
          });
        }
      }
    }
    return cols;
  }, [generationGroups, collapsedGenerations]);

  // Map every versionKey -> active colId (so arrows route accurately even when a G_n is collapsed!)
  const colIdByVersionKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of visibleColumns) {
      for (const v of col.versions) map.set(v.versionKey, col.colId);
    }
    return map;
  }, [visibleColumns]);

  // Precompute stacked CV / AV / PV variation shares per visible column (Model of SGE bar!)
  const variationSharesByColId = useMemo(() => {
    const map = new Map<string, { cv: number; av: number; pv: number; rem: number; total: number }>();
    for (const col of visibleColumns) {
      const kpi = computeVersionKpis(dataset, col.primaryVersion);
      const cv = kpi.countsByVariation.CV;
      const av = kpi.countsByVariation.AV;
      const pv = kpi.countsByVariation.PV;
      const rem = kpi.countsByVariation.REM;
      map.set(col.colId, { cv, av, pv, rem, total: Math.max(1, cv + av + pv + rem) });
    }
    return map;
  }, [visibleColumns, dataset]);

  // Index events by `${rseId}::${versionKey}`
  const eventByVerKey = useMemo(() => {
    const map = new Map<string, RsePhaseEvent>();
    for (const ev of dataset.events) {
      const vk = versionKeyByNr.get(ev.versionNr);
      if (vk) map.set(`${ev.rseId}::${vk}`, ev);
    }
    return map;
  }, [dataset.events, versionKeyByNr]);

  // Index micro-iterations by `${rseId}::${versionKey}`
  const microByVerKey = useMemo(() => {
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

<<<<<<< HEAD
  // Resolve causal arrows onto visible column IDs
=======
  // Track all existing same-RSE arrow connections regardless of type filters (for gap hover trigger)
  const connectedSameRsePairs = useMemo(() => {
    const stepMap = new Map(dataset.steps.map((s) => [s.id, s]));
    const set = new Set<string>();
    for (const arrow of dataset.arrows) {
      const sFrom = stepMap.get(arrow.from);
      const sTo = stepMap.get(arrow.to);
      const fromRseId = arrow.fromRseId || sFrom?.rseIds[0] || '';
      const toRseId = arrow.toRseId || sTo?.rseIds[0] || '';
      const fromVerKey =
        arrow.fromVersionKey || (sFrom?.versionNr ? versionKeyByNr.get(sFrom.versionNr) : '') || '';
      const toVerKey =
        arrow.toVersionKey || (sTo?.versionNr ? versionKeyByNr.get(sTo.versionNr) : '') || '';
      if (fromRseId && toRseId && fromRseId === toRseId && fromVerKey && toVerKey) {
        set.add(`${fromRseId}::${fromVerKey}::${toVerKey}`);
        set.add(`${fromRseId}::${toVerKey}::${fromVerKey}`);
      }
    }
    return set;
  }, [dataset.arrows, dataset.steps, versionKeyByNr]);

  // Resolve all causal arrows onto (RSE_ID, Version_Key) node keys
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
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

      const fromCol = colIdByVersionKey.get(fromVerKey);
      const toCol = colIdByVersionKey.get(toVerKey);
      if (!fromCol || !toCol) continue;

      const fromRse = rseById.get(fromRseId);
      const toRse = rseById.get(toRseId);
      const fromCollapsed = fromRse ? collapsedLanes.has(fromRse.spur) : false;
      const toCollapsed = toRse ? collapsedLanes.has(toRse.spur) : false;

      const fromKey = fromCollapsed ? `LANE::${fromRse!.spur}::${fromCol}` : `${fromRseId}::${fromCol}`;
      const toKey = toCollapsed ? `LANE::${toRse!.spur}::${toCol}` : `${toRseId}::${toCol}`;

      list.push({
        arrow,
        fromKey,
        toKey,
        fromRseId,
        toRseId,
        fromLabel: fromVerKey,
        toLabel: toVerKey,
        sameColumn: fromCol === toCol,
        sameNode: fromKey === toKey,
      });
    }
    return list;
  }, [
    dataset.arrows,
    dataset.steps,
    enabledArrowTypes,
    versionKeyByNr,
    colIdByVersionKey,
    rseById,
    collapsedLanes,
  ]);

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
<<<<<<< HEAD
  }, [measureBoxes, dataset, collapsedLanes, collapsedGenerations, detailLevel, searchQuery, isEdit]);
=======
  }, [measureBoxes, dataset, collapsedLanes, detailLevel, onlyChangeEvents, searchQuery, isEdit, mediaMap]);
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const obs = new ResizeObserver(() => requestAnimationFrame(measureBoxes));
    obs.observe(contentEl);
    return () => obs.disconnect();
  }, [measureBoxes]);

  const computedArrowPaths = useMemo(() => {
    if (!showArrows) return [];
    const results: { resolved: ResolvedArrow; path: string }[] = [];
    for (const resolved of resolvedArrows) {
      const src = nodeBoxes.get(resolved.fromKey);
      const dst = nodeBoxes.get(resolved.toKey);
      if (!src || !dst) continue;

      let path = '';
      if (resolved.sameNode) {
        const x1 = src.left + src.width * 0.28;
        const x2 = src.left + src.width * 0.72;
        const y = src.top;
        path = `M ${x1} ${y} C ${x1} ${y - 24}, ${x2} ${y - 24}, ${x2} ${y - 2}`;
      } else if (resolved.sameColumn) {
        const x1 = src.right;
        const y1 = src.cy;
        const x2 = dst.right;
        const y2 = dst.cy;
        const dist = Math.abs(y2 - y1);
        const bow = Math.min(76, Math.max(28, dist * 0.16));
        path = `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 + bow} ${y2}, ${x2 + 2} ${y2}`;
      } else if (src.cx <= dst.cx) {
        const x1 = src.right;
        const y1 = src.cy;
        const x2 = dst.left;
        const y2 = dst.cy;
        const dx = Math.max(42, (x2 - x1) * 0.45);
        path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 2} ${y2}`;
      } else {
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

  const arrowConnectedNodeKeys = useMemo(() => {
    const set = new Set<string>();
    if (!showArrows) return set;
    for (const ra of resolvedArrows) {
      set.add(ra.fromKey);
      set.add(ra.toKey);
    }
    return set;
  }, [showArrows, resolvedArrows]);

  const activeArrowIds = useMemo(() => {
    if (hoveredArrowId) return new Set([hoveredArrowId]);
    if (selectedArrowId) return new Set([selectedArrowId]);
    if (hoveredNodeKey) {
      const set = new Set<string>();
      for (const ra of resolvedArrows) {
        if (ra.fromKey === hoveredNodeKey || ra.toKey === hoveredNodeKey) set.add(ra.arrow.id);
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

  const toggleGeneration = (genId: string) => {
    setCollapsedGenerations((prev) => {
      const next = new Set(prev);
      if (next.has(genId)) next.delete(genId);
      else next.add(genId);
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
    setZoom(Math.min(1, Math.max(MIN_ZOOM, Number(scaleX.toFixed(2)))));
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
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, table, [data-interactive-node]')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handleMouseMoveBg = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    setPan({
      x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
    });
  };
  const handleMouseUpBg = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const colWidthPx = detailLevel === 3 ? 286 : detailLevel === 2 ? 236 : 204;
  const gridTemplateColumns = `224px repeat(${visibleColumns.length}, ${colWidthPx}px)`;

  const getNodeMediaInfo = (
    ev: RsePhaseEvent | undefined,
    rseId: string
  ): {
    nodeAttachment?: MediaAttachment;
    nodeRefKey?: string;
    previewUrl?: string;
  } => {
    if (ev?.mediaRef && mediaMap[ev.mediaRef]?.dataUrl) {
      return {
        nodeAttachment: mediaMap[ev.mediaRef],
        nodeRefKey: ev.mediaRef,
        previewUrl: mediaMap[ev.mediaRef].dataUrl,
      };
    }
    if (ev && mediaMap[`event:${ev.eventId}`]?.dataUrl) {
      return {
        nodeAttachment: mediaMap[`event:${ev.eventId}`],
        nodeRefKey: `event:${ev.eventId}`,
        previewUrl: mediaMap[`event:${ev.eventId}`].dataUrl,
      };
    }
    if (mediaMap[`rse:${rseId}`]?.dataUrl) {
      return {
        previewUrl: mediaMap[`rse:${rseId}`].dataUrl,
      };
    }
    return {};
  };

  const triggerTilePhotoPicker = (rseId: string, versionKey: string) => {
    photoTargetRef.current = { rseId, versionKey };
    tileFileInputRef.current?.click();
  };

  const handleTileImageDrop = (
    e: React.DragEvent,
    rseId: string,
    versionKey: string
  ) => {
    if (!isEdit) return;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeKey(null);
    onUploadNodeMedia(rseId, versionKey, file);
  };

  const expandableGenIds = generationGroups.filter((g) => g.versions.length > 1).map((g) => g.generationId);
  const anyGenCollapsed = collapsedGenerations.size > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#0B1120]">
<<<<<<< HEAD
      {/* Clean Top Controls Bar: Arrow Legend + G_n Collapse + Zoom */}
=======
      {isEdit && (
        <input
          ref={tileFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const target = photoTargetRef.current;
            if (file && target && file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
              onUploadNodeMedia(target.rseId, target.versionKey, file);
            }
            e.target.value = '';
          }}
        />
      )}
      {/* 2D Graph Controls & Arrow Legend Bar */}
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Left: Arrow Toggle + Legend */}
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
            <span>Wirkpfeile ({computedArrowPaths.length})</span>
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
                  <svg width="18" height="8" aria-hidden="true">
                    <line
                      x1="0"
                      y1="4"
                      x2="13"
                      y2="4"
                      stroke={stroke}
                      strokeWidth={Math.min(3, st.strokeWidth)}
                      strokeDasharray={st.dashArray}
                    />
                    <polygon points="12,1.5 18,4 12,6.5" fill={stroke} />
                  </svg>
                  <span>{st.shortLabel}</span>
                </button>
              );
            })}
        </div>

        {/* Right: Edit Actions + G_n / E_{n,m} Toggle + Lane Collapse + Zoom */}
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

          {expandableGenIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setCollapsedGenerations(anyGenCollapsed ? new Set() : new Set(expandableGenIds))
              }
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Zwischen verdichteter Generationensicht (G₀–G₃) und vollständigen Engineering Generations (Eₙ,ₘ) umschalten"
            >
              {anyGenCollapsed ? 'Eₙ,ₘ ausklappen' : 'Auf G₀–G₃ verdichten'}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setCollapsedLanes(collapsedLanes.size > 0 ? new Set() : new Set(dataset.lanes))
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {collapsedLanes.size > 0 ? 'Spuren ausklappen' : 'Spuren einklappen'}
          </button>

          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.1).toFixed(2))))}
              aria-label="Herauszoomen"
              className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[40px] text-center font-mono text-[10px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.1).toFixed(2))))}
              aria-label="Hineinzoomen"
              className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300"
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
                setZoom(0.88);
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

      {/* 2D Zoom/Pan Engineering Canvas */}
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
          className="relative inline-block min-w-max pb-28 pr-28"
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
                const firstCause =
                  arrow.causeIds.length > 0 ? causeById.get(arrow.causeIds[0]) : undefined;

                return (
                  <g
                    key={arrow.id}
                    className="pointer-events-auto cursor-pointer"
                    style={{ opacity: isHighlighted ? 0.9 : 0.12, transition: 'opacity 140ms' }}
                    onMouseEnter={(e) => {
                      setHoveredArrowId(arrow.id);
                      setTooltip({
                        x: e.clientX,
                        y: e.clientY,
                        badge: arrow.id,
                        title: `${resolved.fromRseId} (${resolved.fromLabel}) → ${resolved.toRseId} (${resolved.toLabel})`,
                        subtitle: arrow.arrowType,
                        rationale: arrow.rationale,
                        causeLabel: firstCause
                          ? `${firstCause.id}: ${firstCause.title}`
                          : arrow.causeIdRaw || undefined,
                      });
                    }}
                    onMouseMove={(e) =>
                      setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))
                    }
                    onMouseLeave={() => {
                      setHoveredArrowId(null);
                      setTooltip(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectArrow(arrow.id);
                    }}
                  >
                    <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
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

          {/* TWO-LEVEL SGE GENERATION HEADER (Level 1: System Generations G_0..G_3, Level 2: Engineering Generations E_{n,m} + CV/AV/PV Stacked Share Bar) */}
          <div className="sticky top-0 z-10 overflow-hidden rounded-t-xl border border-slate-300 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900">
            {/* Level 1: System Generations Band (G_0 .. G_3) */}
            <div
              style={{ gridTemplateColumns }}
              className="grid border-b border-slate-200 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-950/80"
            >
              <div className="flex items-center border-r border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800">
                Systemgeneration (Gₙ)
              </div>

              {generationGroups.map((grp) => {
                const isCollapsed =
                  collapsedGenerations.has(grp.generationId) && grp.versions.length > 1;
                const spanCols = isCollapsed ? 1 : grp.versions.length;
                const canCollapse = grp.versions.length > 1;

                return (
                  <div
                    key={grp.generationId}
                    style={{ gridColumn: `span ${spanCols} / span ${spanCols}` }}
                    className="flex items-center justify-between gap-2 border-r border-slate-200 px-3 py-1.5 last:border-r-0 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-blue-600 shrink-0">
                        {grp.generationId}
                      </span>
                      <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {grp.generationName}
                      </span>
                      {grp.milestoneLabel && (
                        <span className="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200 shrink-0">
                          <Flag className="h-2.5 w-2.5" />
                          {grp.milestoneLabel}
                        </span>
                      )}
                    </div>

                    {canCollapse && (
                      <button
                        type="button"
                        onClick={() => toggleGeneration(grp.generationId)}
                        className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0"
                        title={
                          isCollapsed
                            ? `Engineering Generations (${grp.versions.map((v) => v.engineeringGenId).join(', ')}) ausklappen`
                            : `Auf ${grp.generationId} verdichten`
                        }
                      >
                        {isCollapsed ? (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span>{grp.versions.length} Eₙ,ₘ</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            <span>Verdichten</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Level 2: Engineering Generations E_{n,m} + Stacked CV/AV/PV Share Bar */}
            <div style={{ gridTemplateColumns }} className="grid items-stretch">
              <div className="flex flex-col justify-center border-r border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                <span>Systemspur / RSE</span>
                <span className="text-[10px] font-normal text-slate-400">
                  Nur aktive Änderungen (keine {formatVariationCode('CV', lang)}-Kästen)
                </span>
              </div>

              {visibleColumns.map((col) => {
                const share = variationSharesByColId.get(col.colId) ?? {
                  cv: 0,
                  av: 0,
                  pv: 0,
                  rem: 0,
                  total: 1,
                };
                const cvPct = Math.round((share.cv / share.total) * 100);
                const avPct = Math.round((share.av / share.total) * 100);
                const pvPct = Math.round(((share.pv + share.rem) / share.total) * 100);

                return (
                  <div
                    key={col.colId}
                    className={`flex flex-col justify-between border-r border-slate-200 px-2.5 py-2 last:border-r-0 dark:border-slate-800 ${
                      col.isMilestone ? 'bg-amber-50/45 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {col.labelTop}
                        </span>
                        <div className="flex items-center gap-1">
                          {col.milestoneLabel && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                              {col.milestoneLabel}
                            </span>
                          )}
                          {isEdit && !col.isCondensedGen && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenModal({ kind: 'edit-version', version: col.primaryVersion })
                              }
                              title="Engineering Generation bearbeiten"
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        className="truncate text-[10.5px] font-medium text-slate-500 dark:text-slate-400"
                        title={col.labelSub}
                      >
                        {col.labelSub}
                      </div>
                    </div>

                    {/* Stacked CV / AV / PV Share Bar (Albers et al. Model of SGE) */}
                    <div className="mt-2">
                      <div
                        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                        title={`${formatVariationCode('CV', lang)} ${cvPct}% · AV ${avPct}% · PV ${pvPct}%`}
                      >
                        {share.cv > 0 && (
                          <div
                            style={{
                              width: `${(share.cv / share.total) * 100}%`,
                              backgroundColor: VARIATION_MARKER_COLORS.CV.dot,
                            }}
                          />
                        )}
                        {share.av > 0 && (
                          <div
                            style={{
                              width: `${(share.av / share.total) * 100}%`,
                              backgroundColor: VARIATION_MARKER_COLORS.AV.dot,
                            }}
                          />
                        )}
                        {share.pv > 0 && (
                          <div
                            style={{
                              width: `${(share.pv / share.total) * 100}%`,
                              backgroundColor: VARIATION_MARKER_COLORS.PV.dot,
                            }}
                          />
                        )}
                        {share.rem > 0 && (
                          <div
                            style={{
                              width: `${(share.rem / share.total) * 100}%`,
                              backgroundColor: VARIATION_MARKER_COLORS.REM.dot,
                            }}
                          />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
                        <span style={{ color: VARIATION_MARKER_COLORS.CV.dot }}>
                          {formatVariationCode('CV', lang)} {cvPct}%
                        </span>
                        <span style={{ color: VARIATION_MARKER_COLORS.AV.dot }}>AV {avPct}%</span>
                        <span style={{ color: VARIATION_MARKER_COLORS.PV.dot }}>PV {pvPct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Y-AXIS: 9 Collapsible Swimlanes with Individual RSE Rows */}
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

                    {visibleColumns.map((col) => {
                      if (!isCollapsed) {
                        return (
                          <div
                            key={col.colId}
                            className="border-r border-slate-200/60 px-2 py-1.5 last:border-r-0 dark:border-slate-700/60"
                          />
                        );
                      }

                      // Count real development activities (non-CV) inside this lane & column
                      let devCount = 0;
                      for (const r of laneRses) {
                        const hasActivity = col.versions.some((v) => {
                          const ev = eventByVerKey.get(`${r.rseId}::${v.versionKey}`);
                          return ev && ev.statusCode !== 'CV';
                        });
                        if (hasActivity) devCount++;
                      }

                      return (
                        <div
                          key={col.colId}
                          data-node-key={`LANE::${spurId}::${col.colId}`}
                          className="border-r border-slate-200/70 px-2 py-1.5 text-center last:border-r-0 dark:border-slate-700/70"
                        >
                          {devCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shadow-2xs dark:bg-slate-900 dark:text-slate-200">
                              <span>{devCount} Änderungen</span>
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-400">·</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Individual RSE Rows */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {laneRses.map((rse) => {
                        const isSelectedRow = selectedRseId === rse.rseId;

                        return (
                          <div
                            key={rse.rseId}
                            style={{ gridTemplateColumns }}
                            className={`grid items-stretch transition-colors ${
                              isSelectedRow
                                ? 'bg-blue-50/40 dark:bg-blue-950/20'
                                : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/25'
                            }`}
                          >
                            {/* RSE Row Label */}
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

<<<<<<< HEAD
                            {/* Version / Generation Cells: ZERO boxes for pure CV! */}
                            {visibleColumns.map((col) => {
                              const nodeKey = `${rse.rseId}::${col.colId}`;

                              // Find real (non-CV) development event(s) in this column
                              const colEvents = col.versions
                                .map((v) => eventByVerKey.get(`${rse.rseId}::${v.versionKey}`))
                                .filter((e): e is RsePhaseEvent => e !== undefined && e.statusCode !== 'CV');
=======
                            {/* Version Cells (v0.0 .. latest) */}
                            {dataset.versions.map((ver, verIdx) => {
                              const nodeKey = `${rse.rseId}::${ver.versionKey}`;
                              const statusCode = matRow?.statusByVersionKey[ver.versionKey] ?? '';
                              const ev = eventByNodeKey.get(nodeKey);
                              const micros = microByNodeKey.get(nodeKey) ?? [];
                              const mediaInfo = getNodeMediaInfo(ev, rse.rseId);
                              const hasPhoto = Boolean(mediaInfo.previewUrl);

                              const shouldHideCv =
                                onlyChangeEvents && statusCode === 'CV' && !ev;
                              const leftHasTile = Boolean(statusCode) && !shouldHideCv;

                              // Check adjacent right version for gap hover arrow trigger
                              const nextVer =
                                verIdx < dataset.versions.length - 1
                                  ? dataset.versions[verIdx + 1]
                                  : undefined;
                              const rightStatusCode = nextVer
                                ? matRow?.statusByVersionKey[nextVer.versionKey] ?? ''
                                : '';
                              const rightEv = nextVer
                                ? eventByNodeKey.get(`${rse.rseId}::${nextVer.versionKey}`)
                                : undefined;
                              const rightHasTile =
                                Boolean(rightStatusCode) &&
                                !(onlyChangeEvents && rightStatusCode === 'CV' && !rightEv);
                              const hasArrowToNext = nextVer
                                ? connectedSameRsePairs.has(
                                    `${rse.rseId}::${ver.versionKey}::${nextVer.versionKey}`
                                  )
                                : true;
                              const showGapTrigger =
                                isEdit &&
                                Boolean(nextVer) &&
                                (leftHasTile || rightHasTile) &&
                                !hasArrowToNext;

                              const gapTriggerEl = showGapTrigger && nextVer ? (
                                <div
                                  data-interactive-node="true"
                                  className="group/gap absolute -right-4 bottom-0 top-0 z-30 flex w-8 items-center justify-center"
                                >
                                  <button
                                    type="button"
                                    data-interactive-node="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenModal({
                                        kind: 'upsert-arrow',
                                        defaultFromRse: rse.rseId,
                                        defaultFromVer: ver.versionKey,
                                        defaultToRse: rse.rseId,
                                        defaultToVer: nextVer.versionKey,
                                      });
                                    }}
                                    title={`+ Kausalpfeil / Schritt hinzufügen (${rse.rseId}: ${ver.versionKey} → ${nextVer.versionKey})`}
                                    aria-label={`Kausalpfeil zwischen ${ver.versionKey} und ${nextVer.versionKey} für ${rse.rseId} hinzufügen`}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-violet-400 bg-white/95 text-violet-600 opacity-0 shadow-sm transition-all duration-150 hover:scale-110 hover:border-solid hover:border-violet-600 hover:bg-violet-600 hover:text-white focus:opacity-100 group-hover/gap:opacity-100 dark:border-violet-500 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-600 dark:hover:text-white"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : null;
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17

                              const activeEv = colEvents[colEvents.length - 1] ?? null;

                              // If pure CV or inactive -> CLEAN EMPTY CELL (no box, no text noise!)
                              if (!activeEv) {
                                return (
                                  <div
<<<<<<< HEAD
                                    key={col.colId}
                                    className="group/cell relative flex items-center justify-center border-r border-slate-100 p-2 last:border-r-0 dark:border-slate-800/70"
=======
                                    key={ver.versionKey}
                                    className="group/cell relative flex items-center justify-center border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800/70"
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                  >
                                    {/* Anchor for incoming/outgoing arrows: visible crisp junction dot ONLY if connected */}
                                    <span
                                      data-node-key={nodeKey}
                                      title={
                                        arrowConnectedNodeKeys.has(nodeKey)
                                          ? `${rse.rseId} (${col.labelTop}): Carryover-Ankerpunkt eines Wirkpfeils`
                                          : undefined
                                      }
                                      className={
                                        arrowConnectedNodeKeys.has(nodeKey)
                                          ? 'h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-white shadow-xs dark:border-slate-500 dark:bg-slate-900'
                                          : 'pointer-events-none h-1 w-1'
                                      }
                                    />
                                    {isEdit && (
                                      <button
                                        type="button"
                                        data-interactive-node="true"
                                        onClick={() =>
                                          onOpenModal({
                                            kind: 'upsert-event',
                                            rseId: rse.rseId,
                                            versionKey: col.primaryVersion.versionKey,
                                          })
                                        }
                                        title={`Neuen Entwicklungskasten (AV/PV) für ${rse.rseId} in ${col.labelTop} anlegen`}
                                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 group-hover/cell:opacity-100 dark:border-slate-700 dark:bg-slate-900"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span>AV / PV</span>
                                      </button>
                                    )}
                                    {gapTriggerEl}
                                  </div>
                                );
                              }

                              // Real development activity (BASE in G_0, AV, PV, NEW, REM)!
                              const statusCode = activeEv.statusCode;
                              const varKind = statusCodeToVariationKind(statusCode);
                              const markerKey = statusCode === 'BASE' ? 'BASE' : varKind;
                              const marker = VARIATION_MARKER_COLORS[markerKey];
                              const isRemoved = statusCode === 'REM';
                              const isUnplanned = statusCode === 'UD-AV' || statusCode === 'UD-PV';

                              const kombisAtNode = activeEv.kombiPartIds;
                              const micros = col.versions.flatMap(
                                (v) => microByVerKey.get(`${rse.rseId}::${v.versionKey}`) ?? []
                              );
                              const linkedCauses = getCausesForEvent(activeEv, dataset);
                              const linkedLearnings = getLearningsForEvent(activeEv, dataset);
                              const previewImg = getMediaPreview(activeEv, rse.rseId);

                              const matchesFilter =
                                activeColorFilters.length === 0 ||
                                activeColorFilters.some((g) =>
                                  g === 'KOMBI'
                                    ? kombisAtNode.length > 0 || rse.currentKombiIds.length > 0
                                    : statusCodeToColorGroup(statusCode) === g
                                );
<<<<<<< HEAD

                              const verIdx = versionIndexByKey.get(col.primaryVersion.versionKey);

                              return (
                                <div
                                  key={col.colId}
                                  className="group/cell relative flex flex-col justify-center border-r border-slate-100 px-2.5 py-2 last:border-r-0 dark:border-slate-800/70"
=======
                              const isCvGhost = statusCode === 'CV' && !ev;
                              const linkedCauses = ev ? getCausesForEvent(ev, dataset) : [];
                              const linkedLearnings = ev ? getLearningsForEvent(ev, dataset) : [];
                              const isDragOverTile = dragOverNodeKey === nodeKey;
                              const tileThumbUrl =
                                mediaInfo.nodeAttachment?.dataUrl ||
                                (detailLevel === 3 ? mediaInfo.previewUrl : undefined);

                              return (
                                <div
                                  key={ver.versionKey}
                                  className="relative flex items-center border-r border-slate-100 px-2.5 py-2 last:border-r-0 dark:border-slate-800/70"
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                >
                                  {/* Neutral High-Contrast Card with Color Dot + Subtle Corner Accent */}
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
                                    onDragOver={(e) => {
                                      if (!isEdit) return;
                                      if (e.dataTransfer.types.includes('Files')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (dragOverNodeKey !== nodeKey) setDragOverNodeKey(nodeKey);
                                      }
                                    }}
                                    onDragLeave={(e) => {
                                      if (!isEdit) return;
                                      e.stopPropagation();
                                      if (dragOverNodeKey === nodeKey) setDragOverNodeKey(null);
                                    }}
                                    onDrop={(e) => handleTileImageDrop(e, rse.rseId, ver.versionKey)}
                                    onMouseEnter={(e) => {
                                      setHoveredNodeKey(nodeKey);
                                      const c0 = linkedCauses[0];
                                      setTooltip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        badge: formatStatusCodeDisplay(statusCode, lang),
                                        badgeSwatch: {
                                          bg: marker.bg,
                                          border: marker.border,
                                          text: marker.text,
                                          dashed: isRemoved,
                                        },
                                        title: `${rse.rseId} · ${rse.name}`,
<<<<<<< HEAD
                                        subtitle: `${col.labelTop} · ${col.labelSub} (${activeEv.eventId})`,
                                        description: activeEv.stateDescription || rse.functionSummary,
                                        rationale: activeEv.rationale || undefined,
                                        causeLabel: c0 ? `${c0.id}: ${c0.title}` : undefined,
                                        previewImageUrl: previewImg,
=======
                                        subtitle: `${ver.phaseName}${ev ? ` (${ev.eventId})` : ' (Carry over)'}`,
                                        description: ev?.stateDescription || rse.functionSummary,
                                        rationale: ev?.rationale || undefined,
                                        causeLabel: firstCause
                                          ? `${firstCause.id}: ${firstCause.title}`
                                          : undefined,
                                        previewImageUrl: mediaInfo.previewUrl,
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                      });
                                    }}
                                    onMouseMove={(e) =>
                                      setTooltip((prev) =>
                                        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                                      )
                                    }
                                    onMouseLeave={() => {
                                      setHoveredNodeKey(null);
                                      setTooltip(null);
                                    }}
<<<<<<< HEAD
                                    className={`relative z-10 overflow-hidden rounded-lg border bg-white px-2.5 py-2 text-left shadow-2xs transition-all dark:bg-slate-900 ${
                                      isRemoved
                                        ? 'border-dashed border-red-400 bg-red-50/25 dark:border-red-700 dark:bg-red-950/20'
                                        : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
=======
                                    style={{
                                      backgroundColor: sw.bg,
                                      borderColor: isDragOverTile ? '#2563EB' : sw.border,
                                      color: sw.text,
                                      borderStyle: isDragOverTile
                                        ? 'dashed'
                                        : sw.dashed
                                          ? 'dashed'
                                          : 'solid',
                                    }}
                                    className={`relative z-10 w-full cursor-pointer rounded-lg border-2 px-2 py-1.5 text-left transition-all ${
                                      isCvGhost ? 'opacity-75 hover:opacity-100' : 'shadow-2xs'
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                    } ${!matchesFilter ? 'opacity-20 hover:opacity-80' : ''} ${
                                      isDragOverTile
                                        ? 'ring-2 ring-blue-500 ring-offset-1'
                                        : hoveredNodeKey === nodeKey
                                          ? 'ring-2 ring-slate-900 dark:ring-white'
                                          : ''
                                    }`}
                                  >
                                    {/* Subtle Colored Corner Accent Triangle (Top-Right) */}
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        borderTopColor: marker.dot,
                                      }}
                                      className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[14px] border-t-[14px] border-l-transparent"
                                    />

                                    {/* Card Header: Color Dot + Canonical Variation Code + Optional UD flag + Icons */}
                                    <div className="flex items-center justify-between gap-1 pr-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                          style={{ backgroundColor: marker.dot }}
                                          title={activeEv.variationType}
                                          className="h-2.5 w-2.5 rounded-full shrink-0"
                                        />
                                        {isEdit ? (
                                          <select
                                            value={statusCode}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) =>
                                              onQuickStatusChange(
                                                rse.rseId,
                                                col.primaryVersion.versionKey,
                                                e.target.value as StatusCode
                                              )
                                            }
                                            className="rounded border border-slate-300 bg-slate-50 px-1 py-0.2 font-mono text-[10px] font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                          >
                                            {ALL_STATUS_CODES.map((c) => (
                                              <option key={c} value={c}>
                                                {formatStatusCodeDisplay(c, lang)}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span
                                            style={{ color: marker.text }}
                                            className="font-mono text-[10.5px] font-bold tracking-tight"
                                          >
                                            {statusCode === 'BASE'
                                              ? 'G₀'
                                              : statusCode === 'NEW'
                                                ? 'PV · Neu'
                                                : formatVariationCode(varKind, lang)}
                                          </span>
                                        )}
                                        {isUnplanned && !isEdit && (
                                          <span
                                            title="Ungeplante Abweichung (UD)"
                                            className="rounded bg-amber-100 px-1 py-0.2 font-mono text-[9px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                                          >
                                            UD
                                          </span>
                                        )}
                                      </div>

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
                                            className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 font-mono text-[9px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                                          >
                                            <RefreshCw className="h-2.5 w-2.5" />
                                            {micros.length}
                                          </span>
                                        )}
<<<<<<< HEAD
                                        {previewImg && (
                                          <span
                                            title="Foto hinterlegt"
                                            className="inline-flex items-center rounded bg-slate-100 p-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
=======
                                        {isEdit ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerTilePhotoPicker(rse.rseId, ver.versionKey);
                                            }}
                                            title={
                                              mediaInfo.nodeAttachment
                                                ? 'Kachel-Foto austauschen (oder per Drag & Drop)'
                                                : 'Foto direkt auf diese Kachel hochladen (Klick oder Drag & Drop)'
                                            }
                                            className={`inline-flex items-center rounded p-0.5 transition-colors ${
                                              mediaInfo.nodeAttachment
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-white/80 text-slate-700 hover:bg-white hover:text-blue-600'
                                            }`}
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                          >
                                            {mediaInfo.nodeAttachment ? (
                                              <Camera className="h-2.5 w-2.5" />
                                            ) : (
                                              <ImagePlus className="h-2.5 w-2.5" />
                                            )}
                                          </button>
                                        ) : (
                                          hasPhoto && (
                                            <span
                                              title="Foto hinterlegt"
                                              className="inline-flex items-center rounded bg-white/80 p-0.5 text-slate-700"
                                            >
                                              <Camera className="h-2.5 w-2.5" />
                                            </span>
                                          )
                                        )}
                                        {isEdit && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenModal({
                                                kind: 'upsert-event',
                                                rseId: rse.rseId,
                                                versionKey: col.primaryVersion.versionKey,
                                                existing: activeEv,
                                              });
                                            }}
                                            title="Kasten bearbeiten"
                                            className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                          >
                                            <Edit3 className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stufe 2 & 3: Short state description */}
                                    {detailLevel >= 2 && activeEv.stateDescription && (
                                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-slate-700 dark:text-slate-300">
                                        {activeEv.stateDescription}
                                      </p>
                                    )}

<<<<<<< HEAD
                                    {/* Stufe 3 (Deep Dive): Micro-Iterations breakdown, Causes, Learnings & object-contain Photo */}
=======
                                    {/* Stufe 3 (Deep Dive): Inline Causes, Micro-Iterations & Learnings */}
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                    {detailLevel === 3 && (
                                      <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5 text-[10px] dark:border-slate-800">
                                        {linkedCauses.length > 0 && (
                                          <div className="space-y-0.5">
                                            {linkedCauses.map((c) => (
                                              <div
                                                key={c.id}
                                                className="rounded bg-amber-50/70 px-1.5 py-0.5 text-[9.5px] text-slate-800 dark:bg-amber-950/40 dark:text-slate-200"
                                              >
                                                <span className="inline-flex items-center gap-0.5 font-mono font-bold text-amber-800 dark:text-amber-300">
                                                  <FlaskConical className="h-2.5 w-2.5" />
                                                  {c.id}:
                                                </span>{' '}
                                                <span>{c.title}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {micros.length > 0 && (
                                          <div className="rounded bg-blue-50/80 px-1.5 py-1 text-[9.5px] text-blue-950 dark:bg-blue-950/40 dark:text-blue-200">
                                            <div className="font-bold">
                                              ↻ {micros.length} Mikro-Iterationen:
                                            </div>
                                            {micros.slice(0, 3).map((m) => (
                                              <div key={m.id} className="truncate">
                                                · {m.subVersionId} ({formatVariationCode(m.variationType ?? 'AV', lang)})
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {linkedLearnings.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {linkedLearnings.map((l) => (
                                              <span
                                                key={l.id}
                                                className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                                              >
                                                <Lightbulb className="h-2.5 w-2.5" />
                                                {l.id}
                                              </span>
                                            ))}
                                          </div>
                                        )}
<<<<<<< HEAD
                                        {previewImg && (
                                          <div className="flex justify-center rounded border border-slate-200 bg-slate-100/70 p-0.5 dark:border-slate-700 dark:bg-slate-950">
                                            <img
                                              src={previewImg}
                                              alt={rse.name}
                                              className="max-h-20 w-full object-contain"
                                            />
                                          </div>
                                        )}
=======
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
                                      </div>
                                    )}

                                    {/* Aspect-Ratio-Preserved Node Photo Preview & Quick Edit Controls */}
                                    {tileThumbUrl && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="group/img relative mt-1.5 flex items-center justify-center overflow-hidden rounded border border-black/10 bg-white/80 p-0.5"
                                      >
                                        <img
                                          src={tileThumbUrl}
                                          alt={mediaInfo.nodeAttachment?.caption || rse.name}
                                          onClick={() =>
                                            onOpenLightbox({
                                              src: tileThumbUrl,
                                              title: `${rse.rseId} (${ver.versionKey}) · ${rse.name}`,
                                              caption: mediaInfo.nodeAttachment?.caption || undefined,
                                              refPath: ev?.mediaRef || mediaInfo.nodeRefKey,
                                            })
                                          }
                                          className="mx-auto block max-h-24 w-auto max-w-full cursor-zoom-in rounded-xs object-contain"
                                        />
                                        <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/img:opacity-100">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onOpenLightbox({
                                                src: tileThumbUrl,
                                                title: `${rse.rseId} (${ver.versionKey}) · ${rse.name}`,
                                                caption: mediaInfo.nodeAttachment?.caption || undefined,
                                                refPath: ev?.mediaRef || mediaInfo.nodeRefKey,
                                              })
                                            }
                                            title="Vergrößern"
                                            className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900/80 text-white hover:bg-slate-900"
                                          >
                                            <ZoomIn className="h-2.5 w-2.5" />
                                          </button>
                                          {isEdit && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                triggerTilePhotoPicker(rse.rseId, ver.versionKey)
                                              }
                                              title="Foto austauschen"
                                              className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900/80 text-white hover:bg-slate-900"
                                            >
                                              <Camera className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                          {isEdit && mediaInfo.nodeRefKey && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (window.confirm('Foto von dieser Kachel entfernen?')) {
                                                  onDeleteNodeMedia(
                                                    rse.rseId,
                                                    ver.versionKey,
                                                    mediaInfo.nodeRefKey!
                                                  );
                                                }
                                              }}
                                              title="Foto entfernen"
                                              className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-600/90 text-white hover:bg-red-700"
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Compact Upload Dropzone Hint in Edit Mode when no node photo yet (Stufe 2+) */}
                                    {isEdit && !mediaInfo.nodeAttachment && detailLevel >= 2 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerTilePhotoPicker(rse.rseId, ver.versionKey);
                                        }}
                                        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-dashed border-black/20 bg-white/55 px-1.5 py-1 text-[9px] font-medium text-slate-700 transition-colors hover:border-blue-500 hover:bg-white/90 hover:text-blue-700"
                                      >
                                        <ImagePlus className="h-2.5 w-2.5 shrink-0" />
                                        <span>Foto ablegen / wählen</span>
                                      </button>
                                    )}
                                  </div>
<<<<<<< HEAD

                                  {/* Hover Gap Handle in Edit Mode: Quick Add Causal Arrow from this card */}
                                  {isEdit && (
                                    <button
                                      type="button"
                                      data-interactive-node="true"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenModal({
                                          kind: 'upsert-arrow',
                                          defaultFromRse: rse.rseId,
                                          defaultFromVer: col.primaryVersion.versionKey,
                                        });
                                      }}
                                      title="Kausalpfeil ab diesem Entwicklungskasten hinzufügen"
                                      className="absolute -right-2.5 top-1/2 z-30 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400 bg-white text-violet-700 opacity-0 shadow transition-opacity hover:bg-violet-600 hover:text-white group-hover/cell:opacity-100"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  )}

                                  {/* Detached Compact Reference Strip + Expandable Reference Table */}
                                  <ReferenceBarAndTable
                                    eventId={activeEv.eventId}
                                    references={activeEv.references}
                                    rseList={dataset.rseList}
                                    appMode={appMode}
                                    lang={lang}
                                    compact
                                    defaultExpanded={false}
                                    onAddReference={onAddEventReference}
                                    onUpdateReference={onUpdateEventReference}
                                    onDeleteReference={onDeleteEventReference}
                                    onSelectRse={(targetId) => onSelectRse(targetId)}
                                  />
=======
                                  {gapTriggerEl}
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
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

      <HoverTooltip data={tooltip} />
    </div>
  );
};
