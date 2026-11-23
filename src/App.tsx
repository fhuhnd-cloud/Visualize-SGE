import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { DataTablesView } from './components/DataTablesView';
import { Header, WorkspaceView } from './components/Header';
import { InspectorDrawer } from './components/InspectorDrawer';
import { LearningBanner } from './components/LearningBanner';
import { SwimlaneGraph } from './components/SwimlaneGraph';
import { Toolbar } from './components/Toolbar';
import { ValidationBanner } from './components/ValidationBanner';
import { createSampleDataset } from './data/sampleDataset';
import {
  DuckomatDataset,
  FilterState,
  StepperMode,
  ValidationReport,
} from './types/duckomat';
import { exportDatasetToXlsx, parseExcelFile, validateDataset } from './utils/excelParser';
import {
  computeDependencyFocus,
  computeLearningHighlight,
  getCausesForArrow,
  getCausesForStep,
  getInterimLatestStepIdsPerLane,
  getLearningIdsForStep,
  getMicroIterationsForStep,
  getOrderedStepsForStepper,
} from './utils/graphAlgorithms';

const INITIAL_FILTERS: FilterState = {
  search: '',
  selectedLanes: [],
  selectedArrowTypes: [],
  hideSuperseded: false,
  finalOverviewMode: false,
};

export default function App() {
  const initialSample = useMemo(() => createSampleDataset(), []);
  const initialReport = useMemo(() => validateDataset(initialSample), [initialSample]);

  const [dataset, setDataset] = useState<DuckomatDataset>(initialSample);
  const [report, setReport] = useState<ValidationReport>(initialReport);
  const [datasetKey, setDatasetKey] = useState('sample-v2-0');

  const [activeView, setActiveView] = useState<WorkspaceView>('graph');
  const [darkMode, setDarkMode] = useState(false);

  const [validationExpanded, setValidationExpanded] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Filters & Stepper
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [stepperMode, setStepperMode] = useState<StepperMode>('phase');
  const [stepValue, setStepValue] = useState<number>(initialSample.phases.length);

  // Focus, Selection (Step OR Arrow), Methodik-Learnings & Inline Expansion
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [selectedLearningId, setSelectedLearningId] = useState<string | null>(null);
  const [learningBarOpen, setLearningBarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const orderedSteps = useMemo(() => getOrderedStepsForStepper(dataset), [dataset]);

  const maxStep = useMemo(() => {
    if (stepperMode === 'phase') {
      return Math.max(0, dataset.phases.length);
    }
    return Math.max(0, orderedSteps.length);
  }, [stepperMode, dataset.phases.length, orderedSteps.length]);

  const handleStepperModeChange = useCallback(
    (nextMode: StepperMode) => {
      setStepperMode(nextMode);
      if (nextMode === 'phase') {
        setStepValue(dataset.phases.length);
      } else {
        setStepValue(orderedSteps.length);
      }
    },
    [dataset.phases.length, orderedSteps.length]
  );

  const stepLabel = useMemo(() => {
    if (stepperMode === 'phase') {
      if (dataset.phases.length === 0) return 'Keine Phasen';
      if (stepValue >= dataset.phases.length) {
        return `1 – ${dataset.phases.length} (Alle)`;
      }
      const currentPhase = dataset.phases[Math.min(stepValue, dataset.phases.length - 1)];
      return `Bis #${currentPhase.sortOrder} · ${currentPhase.name}`;
    } else {
      if (orderedSteps.length === 0) return '0 / 0';
      if (stepValue >= orderedSteps.length) {
        return `Alle (${orderedSteps.length} / ${orderedSteps.length})`;
      }
      if (stepValue === 0) {
        return `0 / ${orderedSteps.length} Schritte`;
      }
      const lastStep = orderedSteps[stepValue - 1];
      return `${stepValue} / ${orderedSteps.length} · ${lastStep?.id ?? ''}`;
    }
  }, [stepperMode, stepValue, dataset.phases, orderedSteps]);

  // Stepper visibility
  const { steppedStepIds, newlyRevealedStepIds } = useMemo(() => {
    const allowed = new Set<string>();
    const newlyRevealed = new Set<string>();

    if (stepperMode === 'phase') {
      if (stepValue >= dataset.phases.length) {
        dataset.steps.forEach((s) => allowed.add(s.id));
      } else {
        const allowedPhaseKeys = new Set(
          dataset.phases.slice(0, stepValue + 1).map((p) => p.phaseKey)
        );
        const activePhaseKey = dataset.phases[stepValue]?.phaseKey;
        dataset.steps.forEach((s) => {
          if (allowedPhaseKeys.has(s.phase)) {
            allowed.add(s.id);
            if (s.phase === activePhaseKey) newlyRevealed.add(s.id);
          }
        });
      }
    } else {
      const count = Math.min(stepValue, orderedSteps.length);
      for (let i = 0; i < count; i++) {
        allowed.add(orderedSteps[i].id);
        if (i === count - 1 && count < orderedSteps.length) {
          newlyRevealed.add(orderedSteps[i].id);
        }
      }
    }

    return { steppedStepIds: allowed, newlyRevealedStepIds: newlyRevealed };
  }, [stepperMode, stepValue, dataset.phases, dataset.steps, orderedSteps]);

  // Apply filters + Final Overview Mode + Stepper
  const visibleSteps = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return dataset.steps.filter((step) => {
      if (!steppedStepIds.has(step.id)) return false;

      if (
        filters.selectedLanes.length > 0 &&
        !filters.selectedLanes.includes(step.spur)
      ) {
        return false;
      }

      if (filters.finalOverviewMode) {
        if (step.standCategory !== 'final') return false;
      } else if (filters.hideSuperseded && step.standCategory === 'superseded') {
        return false;
      }

      if (query) {
        const linkedCausesText = getCausesForStep(step.id, dataset.causes, dataset.arrows)
          .map(
            ({ cause }) =>
              `${cause.id} ${cause.category} ${cause.title} ${cause.observation} ${cause.hypothesis}`
          )
          .join(' ');
        const microText = getMicroIterationsForStep(step, dataset.microIterations)
          .map((m) => `${m.detailBox} ${m.stepNumber} ${m.change} ${m.result} ${m.evaluation}`)
          .join(' ');
        const arrowText = dataset.arrows
          .filter((a) => a.from === step.id || a.to === step.id)
          .map((a) => `${a.id} ${a.arrowType} ${a.rationale}`)
          .join(' ');
        const stepLearningIds = getLearningIdsForStep(step, dataset.learnings);
        const learningText = stepLearningIds
          .map((lId) => {
            const found = dataset.learnings.find((l) => l.id === lId);
            return found ? `${found.id} ${found.topic} ${found.title}` : lId;
          })
          .join(' ');

        const haystack =
          `${step.id} ${step.spur} ${step.phase} ${step.stepType} ${step.stand} ${step.title} ${step.implementation} ${step.detailBox} ${linkedCausesText} ${microText} ${arrowText} ${learningText}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    dataset.steps,
    dataset.causes,
    dataset.arrows,
    dataset.microIterations,
    dataset.learnings,
    steppedStepIds,
    filters,
  ]);

  const visibleStepIdSet = useMemo(
    () => new Set(visibleSteps.map((s) => s.id)),
    [visibleSteps]
  );

  const visibleArrows = useMemo(() => {
    return dataset.arrows.filter((arrow) => {
      if (!visibleStepIdSet.has(arrow.from) || !visibleStepIdSet.has(arrow.to)) {
        return false;
      }
      if (
        filters.selectedArrowTypes.length > 0 &&
        !filters.selectedArrowTypes.includes(arrow.category)
      ) {
        return false;
      }
      return true;
    });
  }, [dataset.arrows, visibleStepIdSet, filters.selectedArrowTypes]);

  const visibleLanes = useMemo(() => {
    if (filters.selectedLanes.length > 0) {
      return dataset.lanes.filter((l) => filters.selectedLanes.includes(l));
    }
    if (filters.search.trim().length > 0) {
      const lanesWithSteps = new Set(visibleSteps.map((s) => s.spur));
      return dataset.lanes.filter((l) => lanesWithSteps.has(l));
    }
    return dataset.lanes;
  }, [dataset.lanes, filters.selectedLanes, filters.search, visibleSteps]);

  const visiblePhases = useMemo(() => {
    if (stepperMode === 'phase' && stepValue < dataset.phases.length) {
      return dataset.phases.slice(0, stepValue + 1);
    }
    return dataset.phases;
  }, [dataset.phases, stepperMode, stepValue]);

  const activeFocusStepId = hoveredStepId ?? selectedStepId;
  const focusSubgraph = useMemo(() => {
    if (!activeFocusStepId || !visibleStepIdSet.has(activeFocusStepId)) return null;
    return computeDependencyFocus(activeFocusStepId, visibleArrows, visibleStepIdSet);
  }, [activeFocusStepId, visibleArrows, visibleStepIdSet]);

  const learningHighlight = useMemo(() => {
    if (!selectedLearningId) return null;
    const learning = dataset.learnings.find((l) => l.id === selectedLearningId);
    if (!learning) return null;
    return computeLearningHighlight(learning, visibleSteps, visibleArrows, dataset.causes);
  }, [selectedLearningId, dataset.learnings, visibleSteps, visibleArrows, dataset.causes]);

  // When stepping through intermediate phases/steps, compute the latest reached step per lane
  // solely as an interim indicator ("Zwischenstand") — never treating Milestones as Final.
  const isSteppingIntermediate = stepValue < maxStep;
  const interimLatestStepIds = useMemo(() => {
    if (!isSteppingIntermediate) return new Set<string>();
    return getInterimLatestStepIdsPerLane(visibleSteps, visiblePhases);
  }, [isSteppingIntermediate, visibleSteps, visiblePhases]);

  const { invalidStepIds, invalidArrowIds, allStepIdsSet } = useMemo(() => {
    const sSet = new Set<string>();
    const aSet = new Set<string>();
    for (const issue of report.issues) {
      if (!issue.referenceId) continue;
      if (issue.sheet === 'Entwicklungsschritte') sSet.add(issue.referenceId);
      if (issue.sheet === 'Verbindungen_Pfeile') aSet.add(issue.referenceId);
    }
    return {
      invalidStepIds: sSet,
      invalidArrowIds: aSet,
      allStepIdsSet: new Set(dataset.steps.map((s) => s.id)),
    };
  }, [report.issues, dataset.steps]);

  const handleFileLoad = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setImportError(
        `Ungültiges Dateiformat ("${file.name}"). Bitte laden Sie eine Excel-Datei (.xlsx oder .xls).`
      );
      return;
    }

    try {
      setImportError(null);
      const { dataset: parsed, report: nextReport } = await parseExcelFile(file);
      setDataset(parsed);
      setReport(nextReport);
      setDatasetKey(`file-${Date.now()}`);
      setFilters(INITIAL_FILTERS);
      setStepperMode('phase');
      setStepValue(parsed.phases.length);
      setSelectedStepId(null);
      setSelectedArrowId(null);
      setHoveredStepId(null);
      setSelectedLearningId(null);
      setInspectorOpen(false);
      setExpandedStepIds(new Set());
      setValidationExpanded(nextReport.errorCount > 0 || nextReport.warningCount > 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Lesefehler';
      setImportError(`Die Excel-Datei konnte nicht verarbeitet werden: ${msg}`);
    }
  }, []);

  const handleResetToSample = useCallback(() => {
    const sample = createSampleDataset();
    setDataset(sample);
    setReport(validateDataset(sample));
    setDatasetKey(`sample-v5-${Date.now()}`);
    setFilters(INITIAL_FILTERS);
    setStepperMode('phase');
    setStepValue(sample.phases.length);
    setSelectedStepId(null);
    setSelectedArrowId(null);
    setHoveredStepId(null);
    setSelectedLearningId(null);
    setInspectorOpen(false);
    setExpandedStepIds(new Set());
    setValidationExpanded(false);
    setImportError(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setSelectedStepId(null);
        setSelectedArrowId(null);
        setSelectedLearningId(null);
        setInspectorOpen(false);
      } else if (e.key === 'ArrowRight' && activeView === 'graph') {
        setStepValue((prev) => Math.min(maxStep, prev + 1));
      } else if (e.key === 'ArrowLeft' && activeView === 'graph') {
        setStepValue((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, maxStep]);

  // Global Drag-and-Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      if (!isDraggingFile) setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
  };

  const handleToggleExpandStep = useCallback((stepId: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const handleSelectStep = useCallback((stepId: string | null) => {
    setSelectedArrowId(null);
    setSelectedStepId(stepId);
    setInspectorOpen(Boolean(stepId));
  }, []);

  const handleSelectArrow = useCallback((arrowId: string | null) => {
    setSelectedStepId(null);
    setSelectedArrowId(arrowId);
    setInspectorOpen(Boolean(arrowId));
  }, []);

  const handleOpenStepInspector = useCallback((stepId: string) => {
    setSelectedArrowId(null);
    setSelectedStepId(stepId);
    setInspectorOpen(true);
  }, []);

  const handleJumpToStep = useCallback(
    (stepId: string) => {
      if (!allStepIdsSet.has(stepId)) return;
      setActiveView('graph');
      setStepValue(maxStep);
      setFilters(INITIAL_FILTERS);
      setSelectedArrowId(null);
      setSelectedStepId(stepId);
      setInspectorOpen(true);
    },
    [allStepIdsSet, maxStep]
  );

  const handleSelectLearning = useCallback((learningId: string | null) => {
    setSelectedLearningId(learningId);
    if (learningId) {
      setSelectedStepId(null);
      setSelectedArrowId(null);
    }
  }, []);

  const handleJumpToLearning = useCallback(
    (learningId: string) => {
      setActiveView('graph');
      setStepValue(maxStep);
      setFilters(INITIAL_FILTERS);
      setSelectedStepId(null);
      setSelectedArrowId(null);
      setSelectedLearningId(learningId);
      setLearningBarOpen(true);
    },
    [maxStep]
  );

  const selectedStep = useMemo(
    () => (selectedStepId ? dataset.steps.find((s) => s.id === selectedStepId) ?? null : null),
    [dataset.steps, selectedStepId]
  );

  const selectedArrow = useMemo(
    () => (selectedArrowId ? dataset.arrows.find((a) => a.id === selectedArrowId) ?? null : null),
    [dataset.arrows, selectedArrowId]
  );

  const selectedStepCauses = useMemo(
    () =>
      selectedStep ? getCausesForStep(selectedStep.id, dataset.causes, dataset.arrows) : [],
    [selectedStep, dataset.causes, dataset.arrows]
  );

  const selectedArrowCauses = useMemo(
    () => (selectedArrow ? getCausesForArrow(selectedArrow, dataset.causes) : []),
    [selectedArrow, dataset.causes]
  );

  const selectedStepMicroIterations = useMemo(
    () =>
      selectedStep ? getMicroIterationsForStep(selectedStep, dataset.microIterations) : [],
    [selectedStep, dataset.microIterations]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100"
    >
      {/* Top Bar */}
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        onFileSelected={handleFileLoad}
        onExportTemplate={() => exportDatasetToXlsx(dataset)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      {/* Workspace Controls */}
      {activeView === 'graph' && (
        <Toolbar
          stepperMode={stepperMode}
          onStepperModeChange={handleStepperModeChange}
          stepValue={stepValue}
          maxStep={maxStep}
          stepLabel={stepLabel}
          onStepChange={setStepValue}
          lanes={dataset.lanes}
          learnings={dataset.learnings}
          selectedLearningId={selectedLearningId}
          learningBarOpen={learningBarOpen}
          onToggleLearningBar={() => setLearningBarOpen((prev) => !prev)}
          onSelectLearning={handleSelectLearning}
          filters={filters}
          onFiltersChange={setFilters}
          visibleStepCount={visibleSteps.length}
          totalStepCount={dataset.steps.length}
          finalStepCount={report.stats.finalStepCount}
          expandedCount={expandedStepIds.size}
          onExpandAll={() => setExpandedStepIds(new Set(visibleSteps.map((s) => s.id)))}
          onCollapseAll={() => setExpandedStepIds(new Set())}
        />
      )}

      {/* Import Error Alert */}
      {importError && (
        <div className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="font-medium underline hover:no-underline whitespace-nowrap shrink-0"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Collapsible 6-Sheet Validation Banner */}
      <ValidationBanner
        sourceName={dataset.sourceName}
        isSample={dataset.isSample}
        report={report}
        isExpanded={validationExpanded}
        onToggleExpand={() => setValidationExpanded((prev) => !prev)}
        onSelectStepId={handleJumpToStep}
        onResetToSample={handleResetToSample}
        stepIdsSet={allStepIdsSet}
      />

      {/* Selected Methodik-Learning Compact Info Card */}
      {activeView === 'graph' && learningHighlight && (
        <LearningBanner
          highlight={learningHighlight}
          allSteps={dataset.steps}
          allCauses={dataset.causes}
          onClose={() => setSelectedLearningId(null)}
          onSelectStep={(stepId) => {
            setSelectedArrowId(null);
            setSelectedStepId(stepId);
            setInspectorOpen(true);
          }}
        />
      )}

      {/* Main Workspace */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {activeView === 'graph' ? (
          <>
            <SwimlaneGraph
              lanes={visibleLanes}
              phases={visiblePhases}
              steps={visibleSteps}
              arrows={visibleArrows}
              allArrows={dataset.arrows}
              causes={dataset.causes}
              microIterations={dataset.microIterations}
              learnings={dataset.learnings}
              darkMode={darkMode}
              finalOverviewMode={filters.finalOverviewMode}
              selectedStepId={selectedStepId}
              selectedArrowId={selectedArrowId}
              hoveredStepId={hoveredStepId}
              selectedLearningId={selectedLearningId}
              focusSubgraph={focusSubgraph}
              learningHighlight={learningHighlight}
              interimLatestStepIds={interimLatestStepIds}
              expandedStepIds={expandedStepIds}
              newlyRevealedStepIds={newlyRevealedStepIds}
              invalidStepIds={invalidStepIds}
              datasetKey={datasetKey}
              onSelectStep={handleSelectStep}
              onSelectArrow={handleSelectArrow}
              onSelectLearning={handleSelectLearning}
              onHoverStep={setHoveredStepId}
              onToggleExpandStep={handleToggleExpandStep}
              onOpenStepInspector={handleOpenStepInspector}
            />

            {inspectorOpen && (selectedStep || selectedArrow) && (
              <InspectorDrawer
                selectedStep={selectedStep}
                selectedArrow={selectedArrow}
                allSteps={dataset.steps}
                allArrows={dataset.arrows}
                phases={dataset.phases}
                learnings={dataset.learnings}
                selectedLearningId={selectedLearningId}
                stepCauses={selectedStepCauses}
                arrowCauses={selectedArrowCauses}
                microIterations={selectedStepMicroIterations}
                darkMode={darkMode}
                onClose={() => setInspectorOpen(false)}
                onSelectStep={(id) => {
                  setSelectedArrowId(null);
                  setSelectedStepId(id);
                  setInspectorOpen(true);
                }}
                onSelectArrow={(id) => {
                  setSelectedStepId(null);
                  setSelectedArrowId(id);
                  setInspectorOpen(true);
                }}
                onSelectLearning={handleSelectLearning}
              />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <DataTablesView
              dataset={dataset}
              invalidStepIds={invalidStepIds}
              invalidArrowIds={invalidArrowIds}
              onJumpToStepInGraph={handleJumpToStep}
              onJumpToLearningInGraph={handleJumpToLearning}
            />
          </div>
        )}
      </main>

      {/* Drag-and-Drop Overlay */}
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 text-center shadow-2xl dark:border-blue-400 dark:bg-slate-900">
            <Upload className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Duckomat v5 Excel-Datei (.xlsx) hier ablegen
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Liest Phasen_Konfiguration, Entwicklungsschritte, Ursachen_Tests_Befunde,
              Verbindungen_Pfeile, Mikro_Iterationen und Methodik_Learnings automatisch aus
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
