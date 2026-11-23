import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  X,
} from 'lucide-react';
import { CauseFinding, DevelopmentStep } from '../types/duckomat';
import { LearningHighlight } from '../utils/graphAlgorithms';

interface LearningBannerProps {
  highlight: LearningHighlight;
  allSteps: DevelopmentStep[];
  allCauses: CauseFinding[];
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
}

export const LearningBanner: React.FC<LearningBannerProps> = ({
  highlight,
  allSteps,
  allCauses,
  onClose,
  onSelectStep,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { learning, directStepIds, chainStepIds, activeCauseIds } = highlight;

  const stepMap = new Map(allSteps.map((s) => [s.id, s]));
  const causeMap = new Map(allCauses.map((c) => [c.id, c]));

  const sortedDirectSteps = Array.from(
    new Set([...learning.linkedStepIds, ...Array.from(directStepIds)])
  ).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));

  const sortedLinkedCauses = Array.from(
    new Set([...learning.linkedCauseIds, ...Array.from(activeCauseIds)])
  ).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));

  return (
    <section
      aria-label={`Methodik-Learning ${learning.id}`}
      className="z-20 border-b border-indigo-200 bg-indigo-50/90 text-xs text-slate-900 dark:border-indigo-900/80 dark:bg-indigo-950/50 dark:text-slate-100"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded border border-indigo-600 bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-semibold text-white dark:border-indigo-400 dark:bg-indigo-500 dark:text-slate-950">
            <Lightbulb className="h-3 w-3 shrink-0" />
            <span>{learning.id}</span>
          </span>

          <h2 className="text-[13px] font-semibold text-slate-950 dark:text-white">
            {learning.title}
          </h2>

          {learning.topic && (
            <span className="rounded border border-indigo-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200">
              {learning.topic}
            </span>
          )}

          <span className="text-[11px] text-indigo-900/75 tabular-nums dark:text-indigo-200/80 whitespace-nowrap">
            · {directStepIds.size} direkte Schritte
            {chainStepIds.size > 0 ? ` + ${chainStepIds.size} Kausalkette` : ''}
            {activeCauseIds.size > 0 ? ` · ${activeCauseIds.size} Befunde` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-indigo-900 transition-colors hover:bg-white dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/70 whitespace-nowrap"
          >
            <span>{collapsed ? 'Details einblenden' : 'Kompakt'}</span>
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Learning-Fokus aufheben"
            title="Learning-Fokus aufheben (Esc)"
            className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            <span>Fokus beenden</span>
          </button>
        </div>
      </div>

      {/* Expanded Structured Info Body */}
      {!collapsed && (
        <div className="grid grid-cols-1 gap-4 border-t border-indigo-200/70 bg-white/80 px-5 py-3 dark:border-indigo-900/70 dark:bg-slate-950/55 lg:grid-cols-3">
          {/* Column 1: Transferable Principle */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>Übertragbares Prinzip (losgelöst vom Duckomat)</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {learning.principle || 'Kein übertragbares Prinzip hinterlegt.'}
            </p>
          </div>

          {/* Column 2: Scientific Context (DRM) */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span>Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {learning.scientificContext || 'Keine wissenschaftliche Einordnung hinterlegt.'}
            </p>
          </div>

          {/* Column 3: Concrete Project Example & Anchors */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" />
              <span>Projektbeispiel &amp; Datenbank-Anker</span>
            </div>
            {learning.projectExample && (
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {learning.projectExample}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {sortedDirectSteps.map((stepId) => {
                const step = stepMap.get(stepId);
                return (
                  <button
                    key={stepId}
                    type="button"
                    disabled={!step}
                    onClick={() => step && onSelectStep(step.id)}
                    title={step ? `${step.id}: ${step.title}` : stepId}
                    className="rounded border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200 dark:hover:bg-indigo-900"
                  >
                    {stepId}
                  </button>
                );
              })}

              {sortedLinkedCauses.map((causeId) => {
                const cause = causeMap.get(causeId);
                return (
                  <span
                    key={causeId}
                    title={cause ? `${cause.id}: ${cause.title}` : causeId}
                    className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    {causeId}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
