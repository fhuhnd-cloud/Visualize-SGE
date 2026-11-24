import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  FlaskConical,
  GitBranch,
  Lightbulb,
  Search,
  X,
} from 'lucide-react';
import { SgeDataset } from '../types/sge';
import { EDGE_STYLES, getLaneDisplayName } from '../utils/sgeVisualConfig';

interface CausalGraphViewProps {
  dataset: SgeDataset;
  onSelectRse: (rseId: string) => void;
}

export const CausalGraphView: React.FC<CausalGraphViewProps> = ({
  dataset,
  onSelectRse,
}) => {
  const [selectedLearningId, setSelectedLearningId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const causeMap = useMemo(
    () => new Map(dataset.causes.map((c) => [c.id, c])),
    [dataset.causes]
  );
  const stepMap = useMemo(
    () => new Map(dataset.steps.map((s) => [s.id, s])),
    [dataset.steps]
  );

  const selectedLearning = selectedLearningId
    ? dataset.learnings.find((l) => l.id === selectedLearningId) ?? null
    : null;

  const highlightedStepIds = useMemo(() => {
    if (!selectedLearning) return null;
    const set = new Set<string>(selectedLearning.linkedStepIds);
    for (const s of dataset.steps) {
      if (s.learnings.includes(selectedLearning.id)) set.add(s.id);
    }
    return set;
  }, [selectedLearning, dataset.steps]);

  const filteredSteps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dataset.steps.filter((s) => {
      if (highlightedStepIds && !highlightedStepIds.has(s.id)) return false;
      if (!q) return true;
      return `${s.id} ${s.title} ${s.spur} ${s.version} ${s.rseIdRaw} ${s.implementation}`
        .toLowerCase()
        .includes(q);
    });
  }, [dataset.steps, highlightedStepIds, query]);

  const selectedStep = selectedStepId ? stepMap.get(selectedStepId) ?? null : null;

  const incomingArrows = useMemo(
    () => (selectedStepId ? dataset.arrows.filter((a) => a.to === selectedStepId) : []),
    [dataset.arrows, selectedStepId]
  );
  const outgoingArrows = useMemo(
    () => (selectedStepId ? dataset.arrows.filter((a) => a.from === selectedStepId) : []),
    [dataset.arrows, selectedStepId]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top Learning & Search Strip */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>
              Kausalketten: {dataset.steps.length} Entwicklungsschritte · {dataset.arrows.length}{' '}
              Pfeile · {dataset.causes.length} Ursachen · {dataset.learnings.length} Methodik-Learnings
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E01, RSE, Spur suchen..."
              className="h-7 w-48 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-6 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Methodik-Learnings M01..M16 Chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            <Lightbulb className="h-3.5 w-3.5" />
            Learnings:
          </span>
          {dataset.learnings.map((l) => {
            const active = selectedLearningId === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLearningId(active ? null : l.id)}
                title={`${l.id}: ${l.title} (${l.topic})`}
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200'
                }`}
              >
                {l.id}
              </button>
            );
          })}
        </div>

        {selectedLearning && (
          <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs dark:border-indigo-800 dark:bg-indigo-950/40">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200">
                  {selectedLearning.id} · {selectedLearning.title}
                </span>
                <span className="ml-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                  ({selectedLearning.topic})
                </span>
                <p className="mt-1 text-slate-800 dark:text-slate-200">
                  {selectedLearning.principle}
                </p>
                {selectedLearning.scientificContext && (
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    DRM: {selectedLearning.scientificContext}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedLearningId(null)}
                className="rounded p-1 text-slate-500 hover:bg-indigo-200/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Split: Steps by Version Matrix + Right Causal Inspector */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dataset.versions.map((ver) => {
              const verSteps = filteredSteps.filter(
                (s) => s.versionNr === ver.sortOrder || s.version.startsWith(ver.versionKey)
              );
              if (verSteps.length === 0) return null;
              return (
                <div
                  key={ver.versionKey}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {ver.phaseName}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {verSteps.length} Schritte
                    </span>
                  </div>
                  <div className="space-y-2">
                    {verSteps.map((step) => {
                      const isSel = selectedStepId === step.id;
                      return (
                        <div
                          key={step.id}
                          onClick={() => setSelectedStepId(step.id)}
                          className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-all ${
                            isSel
                              ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/35'
                              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {step.id}
                            </span>
                            <span className="truncate text-[10px] text-slate-500">
                              {getLaneDisplayName(step.spur)}
                            </span>
                          </div>
                          <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                            {step.title}
                          </div>
                          {step.rseIds.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {step.rseIds.map((rId) => (
                                <button
                                  key={rId}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectRse(rId);
                                  }}
                                  className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                                >
                                  {rId}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Causal Chain Panel */}
        {selectedStep && (
          <aside className="flex w-full flex-col border-l border-slate-200 bg-white p-4 overflow-y-auto dark:border-slate-800 dark:bg-slate-900 sm:w-[400px] shrink-0">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <div className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                  {selectedStep.id} · {selectedStep.version}
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {selectedStep.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStepId(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {selectedStep.implementation}
            </p>

            {/* Incoming Arrows */}
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Auslöser / Vorgänger ({incomingArrows.length})
              </div>
              <div className="mt-2 space-y-2">
                {incomingArrows.map((a) => {
                  const style = EDGE_STYLES[a.category];
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStepId(a.from)}
                          className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 hover:underline dark:text-blue-400"
                        >
                          <span>{a.from}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{a.to}</span>
                        </button>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.badgeClass}`}>
                          {style.shortLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                        {a.rationale}
                      </p>
                      {a.causeIds.map((cId) => {
                        const c = causeMap.get(cId);
                        if (!c) return null;
                        return (
                          <div
                            key={cId}
                            className="mt-1.5 rounded bg-amber-50/70 p-2 text-[11px] dark:bg-amber-950/30"
                          >
                            <div className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200">
                              <FlaskConical className="h-3 w-3" />
                              <span>
                                {c.id}: {c.title}
                              </span>
                            </div>
                            <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                              {c.observation}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outgoing Arrows */}
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Folgeschritte ({outgoingArrows.length})
              </div>
              <div className="mt-2 space-y-2">
                {outgoingArrows.map((a) => {
                  const style = EDGE_STYLES[a.category];
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStepId(a.to)}
                          className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 hover:underline dark:text-blue-400"
                        >
                          <span>{a.from}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{a.to}</span>
                        </button>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.badgeClass}`}>
                          {style.shortLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                        {a.rationale}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
