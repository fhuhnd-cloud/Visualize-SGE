import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Flag,
  FlaskConical,
  Info,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  EdgeCategory,
  MethodikLearning,
  MicroIteration,
  PhaseConfig,
} from '../types/duckomat';
import {
  FocusSubgraph,
  LearningHighlight,
  LinkedCauseItem,
  computeIntraPhaseSubSteps,
  getCausesForArrow,
  getCausesForStep,
  getLearningIdsForCause,
  getLearningIdsForStep,
  getMicroIterationsForStep,
} from '../utils/graphAlgorithms';
import {
  EDGE_CATEGORY_ORDER,
  EDGE_STYLES,
  formatCodeAndLabel,
} from '../utils/visualConfig';
import { NodeCard } from './NodeCard';

interface SwimlaneGraphProps {
  lanes: string[];
  phases: PhaseConfig[];
  steps: DevelopmentStep[];
  arrows: ConnectionArrow[];
  allArrows: ConnectionArrow[];
  causes: CauseFinding[];
  microIterations: MicroIteration[];
  learnings: MethodikLearning[];
  darkMode: boolean;
  finalOverviewMode: boolean;
  selectedStepId: string | null;
  selectedArrowId: string | null;
  hoveredStepId: string | null;
  selectedLearningId: string | null;
  focusSubgraph: FocusSubgraph | null;
  learningHighlight: LearningHighlight | null;
  interimLatestStepIds: Set<string>;
  expandedStepIds: Set<string>;
  newlyRevealedStepIds: Set<string>;
  invalidStepIds: Set<string>;
  datasetKey: string;
  onSelectStep: (stepId: string | null) => void;
  onSelectArrow: (arrowId: string | null) => void;
  onSelectLearning: (learningId: string | null) => void;
  onHoverStep: (stepId: string | null) => void;
  onToggleExpandStep: (stepId: string) => void;
  onOpenStepInspector: (stepId: string) => void;
}

interface NodeBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface ComputedArrowGeometry {
  arrow: ConnectionArrow;
  path: string;
  midX: number;
  midY: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.85;

function cubicPointAtHalf(
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x1: number,
  y1: number
) {
  return {
    x: 0.125 * x0 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x1,
    y: 0.125 * y0 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y1,
  };
}

export const SwimlaneGraph: React.FC<SwimlaneGraphProps> = ({
  lanes,
  phases,
  steps,
  arrows,
  allArrows,
  causes,
  microIterations,
  learnings,
  darkMode,
  finalOverviewMode,
  selectedStepId,
  selectedArrowId,
  hoveredStepId,
  selectedLearningId,
  focusSubgraph,
  learningHighlight,
  interimLatestStepIds,
  expandedStepIds,
  newlyRevealedStepIds,
  invalidStepIds,
  datasetKey,
  onSelectStep,
  onSelectArrow,
  onSelectLearning,
  onHoverStep,
  onToggleExpandStep,
  onOpenStepInspector,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 18 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [nodeBoxes, setNodeBoxes] = useState<Map<string, NodeBox>>(new Map());
  const [contentSize, setContentSize] = useState({ width: 1600, height: 800 });

  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [legendOpen, setLegendOpen] = useState(true);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Compute topological sub-columns inside each phase for intra-phase arrows (e.g. P_21: E27 -> E28)
  const { subStepByStepId, subColCountByPhaseKey } = useMemo(
    () => computeIntraPhaseSubSteps(phases, steps, arrows),
    [phases, steps, arrows]
  );

  const gridTemplateColumns = useMemo(() => {
    const colDefs = phases.map((phase) => {
      const subCols = subColCountByPhaseKey.get(phase.phaseKey) ?? 1;
      if (subCols <= 1) return 'minmax(278px, 296px)';
      // Widen phase column proportionally so sub-steps sit side by side with a 56px arrow channel
      const widthPx = subCols * 276 + (subCols - 1) * 56 + 48;
      return `${widthPx}px`;
    });
    return `200px ${colDefs.join(' ')}`;
  }, [phases, subColCountByPhaseKey]);

  const cellStepsMap = useMemo(() => {
    const map = new Map<string, DevelopmentStep[]>();
    for (const step of steps) {
      const key = `${step.spur}::${step.phase}`;
      const list = map.get(key) ?? [];
      list.push(step);
      map.set(key, list);
    }
    return map;
  }, [steps]);

  const stepById = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps]);

  const causesByStepId = useMemo(() => {
    const map = new Map<string, LinkedCauseItem[]>();
    for (const step of steps) {
      map.set(step.id, getCausesForStep(step.id, causes, allArrows));
    }
    return map;
  }, [steps, causes, allArrows]);

  const microIterationsByStepId = useMemo(() => {
    const map = new Map<string, MicroIteration[]>();
    for (const step of steps) {
      map.set(step.id, getMicroIterationsForStep(step, microIterations));
    }
    return map;
  }, [steps, microIterations]);

  const learningIdsByStepId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const step of steps) {
      map.set(step.id, getLearningIdsForStep(step, learnings));
    }
    return map;
  }, [steps, learnings]);

  const measureNodes = useCallback(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const currentZoom = zoomRef.current || 1;
    const contentRect = contentEl.getBoundingClientRect();
    const cardEls = contentEl.querySelectorAll<HTMLElement>('[data-node-id]');
    const nextBoxes = new Map<string, NodeBox>();

    cardEls.forEach((el) => {
      const id = el.dataset.nodeId;
      if (!id) return;
      const rect = el.getBoundingClientRect();
      const left = (rect.left - contentRect.left) / currentZoom;
      const top = (rect.top - contentRect.top) / currentZoom;
      const width = rect.width / currentZoom;
      const height = rect.height / currentZoom;
      nextBoxes.set(id, {
        id,
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

    setNodeBoxes(nextBoxes);
    setContentSize({
      width: contentEl.scrollWidth,
      height: contentEl.scrollHeight,
    });
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureNodes);
    return () => cancelAnimationFrame(frame);
  }, [measureNodes, steps, lanes, phases, expandedStepIds, subColCountByPhaseKey]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measureNodes);
    });
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [measureNodes]);

  const fitToScreen = useCallback(() => {
    const viewportEl = viewportRef.current;
    const contentEl = contentRef.current;
    if (!viewportEl || !contentEl) return;

    const vpW = viewportEl.clientWidth;
    const vpH = viewportEl.clientHeight;
    const cW = contentEl.scrollWidth;
    const cH = contentEl.scrollHeight;
    if (cW === 0 || cH === 0) return;

    const padding = 32;
    const scaleX = (vpW - padding * 2) / cW;
    const scaleY = (vpH - padding * 2) / cH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), 1.0);

    const nextPanX = Math.max(16, (vpW - cW * nextZoom) / 2);
    const nextPanY = Math.max(14, (vpH - cH * nextZoom) / 2);

    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      measureNodes();
      fitToScreen();
    }, 60);
    return () => clearTimeout(timer);
  }, [datasetKey, fitToScreen, measureNodes]);

  // Cursor-centered mouse wheel zoom
  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewportEl.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const deltaFactor = e.deltaY < 0 ? 1.09 : 0.91;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * deltaFactor));
        const ratio = nextZoom / prevZoom;
        setPan((prevPan) => ({
          x: cursorX - (cursorX - prevPan.x) * ratio,
          y: cursorY - (cursorY - prevPan.y) * ratio,
        }));
        return nextZoom;
      });
    };

    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewportEl.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button, input, a, [data-no-pan="true"]') ||
      (target.closest('[data-node-id]') && e.button === 0)
    ) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  // Compute SVG Bezier paths for all visible arrows.
  // MANDATORY DIRECTION RULE:
  // Every arrow ALWAYS exits the Right Handle of Von_Schritt_ID and enters the Left Handle of Nach_Schritt_ID
  // with a rightward-pointing arrowhead — including intra-phase and stacked connections.
  const arrowGeometries = useMemo<ComputedArrowGeometry[]>(() => {
    const validArrows = arrows.filter((a) => nodeBoxes.has(a.from) && nodeBoxes.has(a.to));

    const outGroups = new Map<string, string[]>();
    const inGroups = new Map<string, string[]>();
    for (const a of validArrows) {
      const oList = outGroups.get(a.from) ?? [];
      oList.push(a.id);
      outGroups.set(a.from, oList);

      const iList = inGroups.get(a.to) ?? [];
      iList.push(a.id);
      inGroups.set(a.to, iList);
    }

    return validArrows.map((arrow) => {
      const s = nodeBoxes.get(arrow.from)!;
      const t = nodeBoxes.get(arrow.to)!;

      const outIds = outGroups.get(arrow.from) ?? [arrow.id];
      const inIds = inGroups.get(arrow.to) ?? [arrow.id];
      const outIdx = outIds.indexOf(arrow.id);
      const inIdx = inIds.indexOf(arrow.id);
      const outOffset = outIds.length > 1 ? (outIdx - (outIds.length - 1) / 2) * 14 : 0;
      const inOffset = inIds.length > 1 ? (inIdx - (inIds.length - 1) / 2) * 14 : 0;

      // Always Right Handle -> Left Handle
      const x1 = s.right + 2;
      const y1 = s.cy + outOffset;
      const x2 = t.left - 7;
      const y2 = t.cy + inOffset;

      // Case 1: Forward left-to-right (cross-phase OR intra-phase subStep 0 -> subStep 1)
      if (t.left >= s.right + 18) {
        const dx = Math.max(36, (x2 - x1) * 0.45);
        const cx1 = x1 + dx;
        const cy1 = y1;
        const cx2 = x2 - dx;
        const cy2 = y2;
        const mid = cubicPointAtHalf(x1, y1, cx1, cy1, cx2, cy2, x2, y2);
        return {
          arrow,
          path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
          midX: mid.x,
          midY: mid.y,
        };
      }

      // Case 2: Same X-column or backward arrow -> C1-smooth S-curve Bezier
      // Exits >= +50px right from source Right Handle, swings through vertical corridor,
      // and enters from >= -50px left into target Left Handle.
      const stub = 50;
      const midX = (x1 + x2) / 2;
      const corridorY =
        Math.abs(y2 - y1) >= 48
          ? (y1 + y2) / 2 + outOffset * 0.35
          : Math.min(s.top, t.top) - 38 - Math.abs(outOffset) * 0.4;

      const path = `M ${x1} ${y1} C ${x1 + stub} ${y1}, ${x1 + stub} ${corridorY}, ${midX} ${corridorY} C ${x2 - stub} ${corridorY}, ${x2 - stub} ${y2}, ${x2} ${y2}`;
      return {
        arrow,
        path,
        midX,
        midY: corridorY,
      };
    });
  }, [arrows, nodeBoxes]);

  const activeArrowId = hoveredArrowId ?? selectedArrowId;
  const activeArrow = useMemo(
    () => (activeArrowId ? arrows.find((a) => a.id === activeArrowId) ?? null : null),
    [arrows, activeArrowId]
  );

  const hoveredArrow = useMemo(
    () => (hoveredArrowId ? arrows.find((a) => a.id === hoveredArrowId) ?? null : null),
    [arrows, hoveredArrowId]
  );

  const hoveredArrowCauses = useMemo(
    () => (hoveredArrow ? getCausesForArrow(hoveredArrow, causes) : []),
    [hoveredArrow, causes]
  );

  const handleZoomStep = (delta: number) => {
    setZoom((prev) => Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)).toFixed(2)));
  };

  const resetZoom100 = () => {
    setZoom(1);
    setPan({ x: 20, y: 18 });
  };

  const isEmpty = steps.length === 0;

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (selectedStepId) onSelectStep(null);
        if (selectedArrowId) onSelectArrow(null);
      }}
      className={`engineering-grid-bg relative flex-1 overflow-hidden select-none bg-[#F8FAFC] dark:bg-[#0B1120] ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {isEmpty ? (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Keine Entwicklungsschritte für die aktuellen Filter sichtbar
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Passen Sie Suchbegriff, Spur-/Pfeil-Filter, den Final-Modus oder den Stepper an, um
              Entwicklungsschritte einzublenden.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative inline-block min-w-max pb-20 pr-20"
        >
          {/* Swimlane Matrix Container */}
          <div className="rounded-xl border border-slate-200 bg-white/95 shadow-xs dark:border-slate-800 dark:bg-slate-900/95">
            {/* Matrix Context Strip */}
            <div
              className={`flex items-center justify-between gap-4 border-b px-5 py-2 text-xs rounded-t-xl ${
                finalOverviewMode
                  ? 'border-emerald-200 bg-emerald-50/85 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400'
              }`}
            >
              {finalOverviewMode ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    <strong className="font-semibold">
                      Gesamtübersicht Finaler Stand aktiv:
                    </strong>{' '}
                    Alle {steps.length} finalen Komponenten stehen in ihrer jeweiligen
                    Entstehungsphase – überarbeitete Zwischenstände sind ausgeblendet.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      Hinweis zur Phasen-Achse:
                    </strong>{' '}
                    Spalten folgen <code className="font-mono text-[11px]">Sortier_Nr</code> aus{' '}
                    <code className="font-mono text-[11px]">Phasen_Konfiguration</code> (logische
                    Arbeitsphasen &amp; hervorgehobene Meilenstein-Bänder, keine Kalenderdaten).
                  </span>
                </div>
              )}

              {focusSubgraph && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0">
                  <span>
                    Pfad-Fokus: {focusSubgraph.focusedStepId} ({focusSubgraph.upstreamStepIds.size}{' '}
                    Vorgänger · {focusSubgraph.downstreamStepIds.size} Nachfolger)
                  </span>
                  {selectedStepId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStep(null);
                      }}
                      className="rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Aufheben
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 7 Lanes × N Ordered Phases Grid (with automatic intra-phase sub-columns) */}
            <div
              className="grid"
              style={{
                gridTemplateColumns,
              }}
            >
              {/* Top-left corner header */}
              <div className="flex flex-col justify-end border-b border-r border-slate-200 bg-slate-50/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Spur (7 Baugruppen)
                </span>
                <span className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Phasen nach Sortier_Nr →
                </span>
              </div>

              {/* Phase column headers */}
              {phases.map((phase, pIdx) => {
                const isMilestone = phase.phaseType === 'Meilenstein';
                const countInPhase = steps.filter((s) => s.phase === phase.phaseKey).length;
                const subCols = subColCountByPhaseKey.get(phase.phaseKey) ?? 1;
                return (
                  <div
                    key={phase.phaseKey}
                    className={`border-b px-5 py-3 ${
                      pIdx < phases.length - 1
                        ? isMilestone
                          ? 'border-r border-amber-300/70 dark:border-amber-800/60'
                          : 'border-r border-slate-200/80 dark:border-slate-800/80'
                        : ''
                    } ${
                      isMilestone
                        ? 'border-b-amber-300 bg-amber-50/90 dark:border-b-amber-800/80 dark:bg-amber-950/35'
                        : 'border-b-slate-200 bg-slate-50/75 dark:border-b-slate-800 dark:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            isMilestone
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-blue-700 dark:text-blue-400'
                          }`}
                        >
                          #{phase.sortOrder}
                        </span>
                        {isMilestone && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            <Flag className="h-3 w-3" />
                            Meilenstein
                          </span>
                        )}
                        {subCols > 1 && (
                          <span
                            title={`Diese Phase enthält ${subCols} kausale Teilschritte (links → rechts)`}
                            className="font-mono text-[10px] text-slate-400 dark:text-slate-500"
                          >
                            · {subCols} Stufen
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums dark:text-slate-500">
                        {countInPhase}
                      </span>
                    </div>

                    <div
                      className={`mt-1 text-xs font-semibold leading-snug ${
                        isMilestone
                          ? 'text-amber-950 dark:text-amber-100'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {phase.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                      {phase.phaseKey}
                    </div>
                  </div>
                );
              })}

              {/* 7 Swimlane Rows */}
              {lanes.map((lane, lIdx) => {
                const { code, label } = formatCodeAndLabel(lane);
                const countInLane = steps.filter((s) => s.spur === lane).length;
                const finalInLane = steps.filter(
                  (s) => s.spur === lane && s.standCategory === 'final'
                ).length;
                const isEven = lIdx % 2 === 1;
                const isLastLane = lIdx === lanes.length - 1;

                const renderStepCard = (step: DevelopmentStep) => {
                  const isLearningDirect = learningHighlight
                    ? learningHighlight.directStepIds.has(step.id)
                    : false;
                  const isLearningChain = learningHighlight
                    ? learningHighlight.chainStepIds.has(step.id)
                    : false;

                  let focusRole:
                    | 'none'
                    | 'focused'
                    | 'upstream'
                    | 'downstream'
                    | 'dimmed' = 'none';
                  if (activeArrow) {
                    if (step.id === activeArrow.from || step.id === activeArrow.to) {
                      focusRole = 'focused';
                    } else {
                      focusRole = 'dimmed';
                    }
                  } else if (focusSubgraph) {
                    if (step.id === focusSubgraph.focusedStepId) {
                      focusRole = 'focused';
                    } else if (focusSubgraph.upstreamStepIds.has(step.id)) {
                      focusRole = 'upstream';
                    } else if (focusSubgraph.downstreamStepIds.has(step.id)) {
                      focusRole = 'downstream';
                    } else {
                      focusRole = 'dimmed';
                    }
                  } else if (learningHighlight) {
                    if (!learningHighlight.activeStepIds.has(step.id)) {
                      focusRole = 'dimmed';
                    }
                  }

                  return (
                    <NodeCard
                      key={step.id}
                      step={step}
                      linkedCauses={causesByStepId.get(step.id) ?? []}
                      microIterations={microIterationsByStepId.get(step.id) ?? []}
                      learningIds={learningIdsByStepId.get(step.id) ?? []}
                      selectedLearningId={selectedLearningId}
                      isLearningDirect={isLearningDirect}
                      isLearningChain={isLearningChain}
                      isInterimLatest={interimLatestStepIds.has(step.id)}
                      isExpanded={expandedStepIds.has(step.id)}
                      isSelected={selectedStepId === step.id}
                      finalOverviewMode={finalOverviewMode}
                      focusRole={focusRole}
                      isNewlyRevealed={newlyRevealedStepIds.has(step.id)}
                      hasValidationIssue={invalidStepIds.has(step.id)}
                      onSelect={(id) => onSelectStep(selectedStepId === id ? null : id)}
                      onSelectLearning={(lId) =>
                        onSelectLearning(selectedLearningId === lId ? null : lId)
                      }
                      onHoverChange={onHoverStep}
                      onToggleExpand={onToggleExpandStep}
                      onOpenInspector={onOpenStepInspector}
                    />
                  );
                };

                return (
                  <React.Fragment key={lane}>
                    {/* Lane Header Cell */}
                    <div
                      className={`flex flex-col justify-center border-r border-slate-200 px-4 py-4 dark:border-slate-800 ${
                        !isLastLane ? 'border-b border-slate-200/90 dark:border-slate-800' : ''
                      } ${
                        isEven
                          ? 'bg-slate-50/60 dark:bg-slate-900/60'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {code || 'Spur'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums dark:text-slate-500">
                          {finalInLane > 0 ? `${finalInLane} Final · ` : ''}
                          {countInLane}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        {label}
                      </div>
                    </div>

                    {/* Phase Cells in this Swimlane */}
                    {phases.map((phase, pIdx) => {
                      const isMilestone = phase.phaseType === 'Meilenstein';
                      const cellSteps = cellStepsMap.get(`${lane}::${phase.phaseKey}`) ?? [];
                      const subCols = subColCountByPhaseKey.get(phase.phaseKey) ?? 1;

                      return (
                        <div
                          key={`${lane}::${phase.phaseKey}`}
                          className={`relative z-10 flex min-h-[124px] flex-col justify-center px-6 py-4 ${
                            !isLastLane ? 'border-b border-slate-200/80 dark:border-slate-800/90' : ''
                          } ${
                            pIdx < phases.length - 1
                              ? isMilestone
                                ? 'border-r border-amber-300/60 dark:border-amber-800/50'
                                : 'border-r border-dashed border-slate-200/80 dark:border-slate-800/70'
                              : ''
                          } ${
                            isMilestone
                              ? 'bg-amber-50/45 dark:bg-amber-950/18'
                              : isEven
                                ? 'bg-slate-50/30 dark:bg-slate-950/20'
                                : 'bg-transparent'
                          }`}
                        >
                          {subCols <= 1 ? (
                            <div className="flex flex-col justify-center gap-4">
                              {cellSteps.map(renderStepCard)}
                            </div>
                          ) : (
                            <div
                              className="grid items-center gap-x-14"
                              style={{
                                gridTemplateColumns: `repeat(${subCols}, minmax(258px, 1fr))`,
                              }}
                            >
                              {Array.from({ length: subCols }, (_, subIdx) => {
                                const subSteps = cellSteps.filter(
                                  (s) => (subStepByStepId.get(s.id) ?? 0) === subIdx
                                );
                                return (
                                  <div
                                    key={subIdx}
                                    className="flex flex-col justify-center gap-4"
                                  >
                                    {subSteps.map(renderStepCard)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* SVG Directed Bezier Arrows Layer */}
          <svg
            width={contentSize.width}
            height={contentSize.height}
            className="pointer-events-none absolute inset-0 z-20 overflow-visible"
            aria-label="Begründete Entwicklungspfeile"
          >
            <defs>
              {EDGE_CATEGORY_ORDER.map((cat: EdgeCategory) => {
                const style = EDGE_STYLES[cat];
                const color = darkMode ? style.strokeDark : style.strokeLight;
                const size = cat === 'paradigmShift' ? 9 : 7.5;
                return (
                  <marker
                    key={cat}
                    id={`arrow-${cat}`}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth={size}
                    markerHeight={size}
                    orient="auto-start-reverse"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={color} />
                  </marker>
                );
              })}
            </defs>

            {arrowGeometries.map(({ arrow, path, midX, midY }) => {
              const style = EDGE_STYLES[arrow.category];
              const color = darkMode ? style.strokeDark : style.strokeLight;

              const isHovered = hoveredArrowId === arrow.id;
              const isSelected = selectedArrowId === arrow.id;
              const isInFocus = focusSubgraph
                ? focusSubgraph.activeArrowIds.has(arrow.id)
                : false;
              const isInLearning = learningHighlight
                ? learningHighlight.activeArrowIds.has(arrow.id)
                : false;

              let opacity = 0.82;
              if (activeArrowId) {
                opacity = isHovered || isSelected ? 1 : 0.12;
              } else if (focusSubgraph) {
                opacity = isInFocus ? 1 : 0.1;
              } else if (learningHighlight) {
                opacity = isInLearning ? 1 : 0.1;
              }

              const strokeWidth =
                isHovered || isSelected
                  ? style.strokeWidth + 1.5
                  : isInFocus || isInLearning
                    ? style.strokeWidth + 0.8
                    : style.strokeWidth;

              const showInlineLabel =
                Boolean(arrow.rationale) &&
                (isSelected ||
                  (focusSubgraph &&
                    isInFocus &&
                    (!hoveredStepId || focusSubgraph.activeArrowIds.size <= 6)) ||
                  (learningHighlight &&
                    !focusSubgraph &&
                    !activeArrowId &&
                    isInLearning &&
                    learningHighlight.activeArrowIds.size <= 8));

              return (
                <g key={arrow.id} style={{ opacity, transition: 'opacity 150ms ease' }}>
                  {(isHovered || isSelected || isInFocus || isInLearning) && (
                    <path
                      d={path}
                      fill="none"
                      stroke={darkMode ? '#0B1120' : '#FFFFFF'}
                      strokeWidth={strokeWidth + 3.5}
                      strokeLinecap="round"
                      opacity={0.78}
                    />
                  )}

                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={style.dashArray}
                    strokeLinecap="round"
                    markerEnd={`url(#arrow-${arrow.category})`}
                  />

                  {/* Generous invisible hit path for hover & click */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredArrowId(arrow.id);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredArrowId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectArrow(selectedArrowId === arrow.id ? null : arrow.id);
                    }}
                  />

                  {showInlineLabel && (
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      className="pointer-events-none"
                    >
                      <foreignObject x={-118} y={-22} width={236} height={44}>
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="max-w-[232px] truncate rounded border border-slate-300/90 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-slate-800 shadow-xs dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100">
                            <span className="font-mono font-semibold" style={{ color }}>
                              {arrow.id}
                            </span>{' '}
                            {arrow.rationale}
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Rich Hover Tooltip for Arrow + Linked Ursachen_Tests_Befunde */}
      {hoveredArrow && (
        <div
          role="tooltip"
          style={{
            left: Math.min(tooltipPos.x + 16, window.innerWidth - 390),
            top: Math.min(tooltipPos.y + 16, window.innerHeight - 300),
          }}
          className="pointer-events-none fixed z-50 w-[370px] max-w-[92vw] rounded-lg border border-slate-200 bg-white p-3.5 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {hoveredArrow.id}: {hoveredArrow.from} → {hoveredArrow.to}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                EDGE_STYLES[hoveredArrow.category].badgeClass
              }`}
            >
              {EDGE_STYLES[hoveredArrow.category].shortLabel}
            </span>
          </div>

          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {hoveredArrow.arrowType}
          </div>

          <p className="mt-1.5 leading-relaxed font-medium text-slate-900 dark:text-slate-100">
            {hoveredArrow.rationale || 'Keine Pfeil-Begründung hinterlegt.'}
          </p>

          {/* Linked Causes/Findings directly separated into Fakt & Hypothese */}
          {hoveredArrowCauses.length > 0 && (
            <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-800">
              {hoveredArrowCauses.slice(0, 2).map((cause) => {
                const cLearnings = getLearningIdsForCause(cause, learnings);
                const isLearningCause =
                  learningHighlight !== null && learningHighlight.activeCauseIds.has(cause.id);
                return (
                  <div
                    key={cause.id}
                    className={`space-y-1 ${
                      isLearningCause
                        ? 'rounded-md bg-indigo-50/75 p-2 dark:bg-indigo-950/45'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      <FlaskConical className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{cause.id}</span>
                      <span className="truncate text-slate-900 dark:text-slate-100">
                        {cause.title}
                      </span>
                    </div>
                    <div className="text-[11px] leading-snug text-slate-800 dark:text-slate-200">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        Beobachtung (Fakt):{' '}
                      </span>
                      {cause.observation || '—'}
                    </div>
                    <div className="text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        Hypothese / Grenze:{' '}
                      </span>
                      {cause.hypothesis || '—'}
                    </div>
                    {cLearnings.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {cLearnings.map((lId) => (
                          <span
                            key={lId}
                            className={`rounded border px-1 py-0.5 font-mono text-[9px] font-semibold leading-none ${
                              selectedLearningId === lId
                                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200'
                            }`}
                          >
                            {lId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {hoveredArrowCauses.length > 2 && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  + {hoveredArrowCauses.length - 2} weitere Befunde (Klicken zum Öffnen)
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400 dark:border-slate-800">
            <span className="truncate">
              {stepById.get(hoveredArrow.from)?.title ?? hoveredArrow.from} →{' '}
              {stepById.get(hoveredArrow.to)?.title ?? hoveredArrow.to}
            </span>
            <span className="ml-2 whitespace-nowrap font-medium text-blue-600 dark:text-blue-400">
              Klicken für Details
            </span>
          </div>
        </div>
      )}

      {/* Floating Legend (Bottom-Left) */}
      <div
        data-no-pan="true"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 z-30"
      >
        {legendOpen ? (
          <div className="w-[340px] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Legende: 6 Pfeiltypen &amp; Stand
              </span>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                aria-label="Legende einklappen"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {EDGE_CATEGORY_ORDER.map((cat) => {
                const st = EDGE_STYLES[cat];
                const stroke = darkMode ? st.strokeDark : st.strokeLight;
                return (
                  <div key={cat} className="flex items-center gap-2.5 text-[11px]">
                    <svg width="34" height="10" className="shrink-0">
                      <line
                        x1="0"
                        y1="5"
                        x2="26"
                        y2="5"
                        stroke={stroke}
                        strokeWidth={st.strokeWidth}
                        strokeDasharray={st.dashArray}
                        strokeLinecap="round"
                      />
                      <polygon points="26,2 33,5 26,8" fill={stroke} />
                    </svg>
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="inline-block h-3 w-3 rounded-xs border-2 border-emerald-500 bg-white dark:bg-slate-900" />
                <span>Aktueller Stand (FINAL)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-block h-3 w-3 rounded-xs border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
                <span>Überarbeitet</span>
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                <Flag className="h-3 w-3" />
                <span>Meilenstein (Prüfpunkt)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <span className="inline-block h-3 w-3 rounded-xs border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950" />
                <span>Methodik-Learning</span>
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Legende</span>
          </button>
        )}
      </div>

      {/* Floating Zoom & Fit Controls (Bottom-Right) */}
      <div
        data-no-pan="true"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95"
      >
        <button
          type="button"
          onClick={() => handleZoomStep(-0.15)}
          aria-label="Verkleinern"
          title="Verkleinern"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={resetZoom100}
          title="Auf 100 % zurücksetzen"
          className="min-w-[50px] rounded-md px-2 py-1 font-mono text-xs font-medium text-slate-700 tabular-nums hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {Math.round(zoom * 100)} %
        </button>

        <button
          type="button"
          onClick={() => handleZoomStep(0.15)}
          aria-label="Vergrößern"
          title="Vergrößern"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        <button
          type="button"
          onClick={fitToScreen}
          title="An Bildschirm anpassen (Fit to Screen)"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fit to Screen</span>
        </button>

        <button
          type="button"
          onClick={resetZoom100}
          aria-label="Ansicht zurücksetzen"
          title="Ansicht zurücksetzen (100 %)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
