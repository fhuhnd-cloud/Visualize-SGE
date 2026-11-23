import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Filter,
  GitBranch,
  Lightbulb,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  EdgeCategory,
  FilterState,
  MethodikLearning,
  StepperMode,
} from '../types/duckomat';
import {
  EDGE_CATEGORY_ORDER,
  EDGE_STYLES,
  formatCodeAndLabel,
} from '../utils/visualConfig';

interface ToolbarProps {
  stepperMode: StepperMode;
  onStepperModeChange: (mode: StepperMode) => void;
  stepValue: number;
  maxStep: number;
  stepLabel: string;
  onStepChange: (value: number) => void;
  lanes: string[];
  learnings: MethodikLearning[];
  selectedLearningId: string | null;
  learningBarOpen: boolean;
  onToggleLearningBar: () => void;
  onSelectLearning: (learningId: string | null) => void;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  visibleStepCount: number;
  totalStepCount: number;
  finalStepCount: number;
  expandedCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  stepperMode,
  onStepperModeChange,
  stepValue,
  maxStep,
  stepLabel,
  onStepChange,
  lanes,
  learnings,
  selectedLearningId,
  learningBarOpen,
  onToggleLearningBar,
  onSelectLearning,
  filters,
  onFiltersChange,
  visibleStepCount,
  totalStepCount,
  finalStepCount,
  expandedCount,
  onExpandAll,
  onCollapseAll,
}) => {
  const [openMenu, setOpenMenu] = useState<'lanes' | 'arrows' | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.selectedLanes.length > 0 ||
    filters.selectedArrowTypes.length > 0 ||
    filters.hideSuperseded ||
    filters.finalOverviewMode ||
    selectedLearningId !== null;

  const toggleLane = (lane: string) => {
    const exists = filters.selectedLanes.includes(lane);
    const next = exists
      ? filters.selectedLanes.filter((l) => l !== lane)
      : [...filters.selectedLanes, lane];
    onFiltersChange({ ...filters, selectedLanes: next });
  };

  const toggleArrowType = (cat: EdgeCategory) => {
    const exists = filters.selectedArrowTypes.includes(cat);
    const next = exists
      ? filters.selectedArrowTypes.filter((c) => c !== cat)
      : [...filters.selectedArrowTypes, cat];
    onFiltersChange({ ...filters, selectedArrowTypes: next });
  };

  const toggleFinalOverview = () => {
    const nextFinal = !filters.finalOverviewMode;
    onFiltersChange({
      ...filters,
      finalOverviewMode: nextFinal,
      hideSuperseded: nextFinal ? true : false,
    });
  };

  const toggleHideSuperseded = () => {
    const nextHide = !filters.hideSuperseded;
    onFiltersChange({
      ...filters,
      hideSuperseded: nextHide,
      finalOverviewMode: nextHide ? filters.finalOverviewMode : false,
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      search: '',
      selectedLanes: [],
      selectedArrowTypes: [],
      hideSuperseded: false,
      finalOverviewMode: false,
    });
    onSelectLearning(null);
  };

  const isAllSteps = stepValue >= maxStep;

  return (
    <div className="z-20 border-b border-slate-200 bg-slate-50/95 px-5 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        {/* Left: Storytelling Stepper */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
            role="group"
            aria-label="Stepper-Modus"
          >
            <button
              type="button"
              onClick={() => onStepperModeChange('phase')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                stepperMode === 'phase'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Phasenweise
            </button>
            <button
              type="button"
              onClick={() => onStepperModeChange('step')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                stepperMode === 'step'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Schrittweise
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStepChange(Math.max(0, stepValue - 1))}
              disabled={stepValue <= 0}
              aria-label="Vorheriger Schritt"
              title="Vorheriger Schritt (Pfeil links)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
              <input
                type="range"
                min={0}
                max={Math.max(0, maxStep)}
                step={1}
                value={Math.min(stepValue, Math.max(0, maxStep))}
                onChange={(e) => onStepChange(Number(e.target.value))}
                aria-label="Entwicklungsverlauf schrittweise einblenden"
                className="h-1.5 w-24 cursor-pointer accent-blue-600 dark:accent-blue-400 sm:w-32"
              />
              <span className="min-w-[118px] text-xs font-medium text-slate-800 tabular-nums dark:text-slate-200 whitespace-nowrap">
                {stepLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onStepChange(Math.min(maxStep, stepValue + 1))}
              disabled={stepValue >= maxStep}
              aria-label="Nächster Schritt"
              title="Nächster Schritt (Pfeil rechts)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {!isAllSteps && (
              <button
                type="button"
                onClick={() => onStepChange(maxStep)}
                className="rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/60 whitespace-nowrap shrink-0"
              >
                Alle
              </button>
            )}
          </div>
        </div>

        {/* Right: Final Overview, Predecessor Toggle, Filters & Search */}
        <div ref={menuContainerRef} className="flex flex-wrap items-center gap-2">
          {/* Prominent Toggle: Final Overview */}
          <button
            type="button"
            onClick={toggleFinalOverview}
            aria-pressed={filters.finalOverviewMode}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              filters.finalOverviewMode
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Gesamtübersicht Finaler Stand ({finalStepCount})</span>
          </button>

          {/* Toggle: Methodik-Learnings hervorheben */}
          {learnings.length > 0 && (
            <button
              type="button"
              onClick={onToggleLearningBar}
              aria-expanded={learningBarOpen}
              aria-pressed={selectedLearningId !== null || learningBarOpen}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedLearningId
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 dark:border-indigo-400 dark:bg-indigo-500 dark:text-slate-950 dark:hover:bg-indigo-400'
                  : learningBarOpen
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-200'
                    : 'border-indigo-200 bg-indigo-50/80 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/45 dark:text-indigo-200 dark:hover:bg-indigo-950/80'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 shrink-0" />
              <span>
                {selectedLearningId
                  ? `Learning: ${selectedLearningId}`
                  : `Methodik-Learnings (${learnings.length})`}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  learningBarOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}

          {/* Toggle: Hide Superseded Predecessors */}
          <button
            type="button"
            onClick={toggleHideSuperseded}
            aria-pressed={filters.hideSuperseded}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filters.hideSuperseded && !filters.finalOverviewMode
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
            <span>Vorgängerstände ausblenden</span>
          </button>

          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              placeholder="Schritt, Ursache, Pfeil suchen..."
              aria-label="Freitext-Suche"
              className="h-8 w-44 rounded-md border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:w-52"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, search: '' })}
                aria-label="Suche leeren"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lane Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'lanes' ? null : 'lanes')}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filters.selectedLanes.length > 0
                  ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>
                Spur
                {filters.selectedLanes.length > 0 ? ` (${filters.selectedLanes.length})` : ''}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>

            {openMenu === 'lanes' && (
              <div className="absolute right-0 top-9 z-40 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-1.5 flex items-center justify-between px-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>Spuren filtern (7 Spuren)</span>
                  {filters.selectedLanes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, selectedLanes: [] })}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Alle
                    </button>
                  )}
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {lanes.map((lane) => {
                    const { code, label } = formatCodeAndLabel(lane);
                    const checked = filters.selectedLanes.includes(lane);
                    return (
                      <label
                        key={lane}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLane(lane)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {code && (
                          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {code}
                          </span>
                        )}
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Arrow Type Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'arrows' ? null : 'arrows')}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filters.selectedArrowTypes.length > 0
                  ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>
                Pfeil-Typ
                {filters.selectedArrowTypes.length > 0
                  ? ` (${filters.selectedArrowTypes.length})`
                  : ''}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>

            {openMenu === 'arrows' && (
              <div className="absolute right-0 top-9 z-40 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-1.5 flex items-center justify-between px-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>Pfeiltypen filtern</span>
                  {filters.selectedArrowTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, selectedArrowTypes: [] })}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Alle
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {EDGE_CATEGORY_ORDER.map((cat) => {
                    const style = EDGE_STYLES[cat];
                    const checked = filters.selectedArrowTypes.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArrowType(cat)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className="h-2 w-2 rounded-xs shrink-0"
                          style={{ backgroundColor: style.strokeLight }}
                        />
                        <span className="truncate">{style.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Expand / Collapse all cards */}
          <button
            type="button"
            onClick={expandedCount > 0 ? onCollapseAll : onExpandAll}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            {expandedCount > 0 ? 'Alle einklappen' : 'Alle aufklappen'}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              title="Alle Filter zurücksetzen"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}

          <span className="hidden 2xl:inline text-xs text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
            {visibleStepCount} / {totalStepCount} Schritte
          </span>
        </div>
      </div>

      {/* Expandable Methodik-Learnings Chip Strip (M01..M12) */}
      {learningBarOpen && learnings.length > 0 && (
        <div className="mt-2.5 border-t border-slate-200/90 pt-2.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Methodik-Learnings hervorheben:
            </span>
            {learnings.map((learning) => {
              const isActive = selectedLearningId === learning.id;
              return (
                <button
                  key={learning.id}
                  type="button"
                  onClick={() => onSelectLearning(isActive ? null : learning.id)}
                  aria-pressed={isActive}
                  title={`${learning.id} (${learning.topic || 'Methodik'}): ${learning.title}`}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs dark:border-indigo-400 dark:bg-indigo-500 dark:text-slate-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/60'
                  }`}
                >
                  <span
                    className={`font-mono font-semibold ${
                      isActive
                        ? 'text-white dark:text-slate-950'
                        : 'text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {learning.id}
                  </span>
                  <span className="max-w-[200px] truncate font-medium">
                    {learning.title}
                  </span>
                </button>
              );
            })}
            {selectedLearningId && (
              <button
                type="button"
                onClick={() => onSelectLearning(null)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 whitespace-nowrap"
              >
                <X className="h-3 w-3" />
                <span>Auswahl aufheben</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
