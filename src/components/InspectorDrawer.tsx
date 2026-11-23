import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Flag,
  FlaskConical,
  GitCommitHorizontal,
  Layers,
  Lightbulb,
  X,
} from 'lucide-react';
import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  MethodikLearning,
  MicroIteration,
  PhaseConfig,
} from '../types/duckomat';
import {
  LinkedCauseItem,
  getLearningIdsForCause,
  getLearningIdsForStep,
} from '../utils/graphAlgorithms';
import { EDGE_STYLES, STAND_STYLES, formatCodeAndLabel } from '../utils/visualConfig';

interface InspectorDrawerProps {
  selectedStep: DevelopmentStep | null;
  selectedArrow: ConnectionArrow | null;
  allSteps: DevelopmentStep[];
  allArrows: ConnectionArrow[];
  phases: PhaseConfig[];
  learnings: MethodikLearning[];
  selectedLearningId: string | null;
  stepCauses: LinkedCauseItem[];
  arrowCauses: CauseFinding[];
  microIterations: MicroIteration[];
  darkMode: boolean;
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
  onSelectArrow: (arrowId: string) => void;
  onSelectLearning: (learningId: string | null) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  selectedStep,
  selectedArrow,
  allSteps,
  allArrows,
  phases,
  learnings,
  selectedLearningId,
  stepCauses,
  arrowCauses,
  microIterations,
  darkMode,
  onClose,
  onSelectStep,
  onSelectArrow,
  onSelectLearning,
}) => {
  const [causesOpen, setCausesOpen] = useState(true);
  const [microOpen, setMicroOpen] = useState(true);

  if (!selectedStep && !selectedArrow) return null;

  const stepMap = new Map(allSteps.map((s) => [s.id, s]));
  const phaseMap = new Map(phases.map((p) => [p.phaseKey, p]));
  const learningMap = new Map(learnings.map((l) => [l.id, l]));

  const renderLearningBadges = (ids: string[]) => {
    if (ids.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {ids.map((lId) => {
          const lObj = learningMap.get(lId);
          const isActive = selectedLearningId === lId;
          return (
            <button
              key={lId}
              type="button"
              onClick={() => onSelectLearning(isActive ? null : lId)}
              title={
                lObj
                  ? `${lObj.id}: ${lObj.title} (${lObj.topic || 'Methodik'})`
                  : `Methodik-Learning ${lId} hervorheben`
              }
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none transition-colors ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:border-indigo-500'
              }`}
            >
              <Lightbulb className="h-2.5 w-2.5 shrink-0" />
              <span>{lId}</span>
              {lObj && (
                <span className="max-w-[140px] truncate font-sans font-medium">
                  {lObj.title}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // MODE A: Arrow / Connection Inspector
  if (selectedArrow) {
    const eStyle = EDGE_STYLES[selectedArrow.category];
    const stroke = darkMode ? eStyle.strokeDark : eStyle.strokeLight;
    const fromStep = stepMap.get(selectedArrow.from);
    const toStep = stepMap.get(selectedArrow.to);

    return (
      <aside
        aria-label={`Pfeil-Inspector für ${selectedArrow.id}`}
        className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:w-[410px] shrink-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <GitCommitHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {selectedArrow.id}
              </span>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${eStyle.badgeClass}`}
              >
                {eStyle.shortLabel}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <svg width="36" height="10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="28"
                  y2="5"
                  stroke={stroke}
                  strokeWidth={eStyle.strokeWidth}
                  strokeDasharray={eStyle.dashArray}
                  strokeLinecap="round"
                />
                <polygon points="28,2 35,5 28,8" fill={stroke} />
              </svg>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {selectedArrow.arrowType}
              </span>
            </div>

            {selectedArrow.laneRef && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Spur-Bezug: {selectedArrow.laneRef}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Inspector schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4 text-sm">
          {/* Connected Steps */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Verbundene Entwicklungsschritte
            </h3>
            <div className="mt-2 space-y-2 text-xs">
              <button
                type="button"
                disabled={!fromStep}
                onClick={() => fromStep && onSelectStep(fromStep.id)}
                className="flex w-full items-start justify-between gap-2 rounded-md border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-400 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-slate-400">Von Schritt</div>
                  <div className="mt-0.5 font-mono font-semibold text-blue-700 dark:text-blue-400">
                    {selectedArrow.from}
                  </div>
                  {fromStep && (
                    <div className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {fromStep.title}
                    </div>
                  )}
                </div>
                <ArrowRight className="mt-3 h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>

              <button
                type="button"
                disabled={!toStep}
                onClick={() => toStep && onSelectStep(toStep.id)}
                className="flex w-full items-start justify-between gap-2 rounded-md border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-400 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-slate-400">Nach Schritt</div>
                  <div className="mt-0.5 font-mono font-semibold text-blue-700 dark:text-blue-400">
                    {selectedArrow.to}
                  </div>
                  {toStep && (
                    <div className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {toStep.title}
                    </div>
                  )}
                </div>
                <ArrowRight className="mt-3 h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>
            </div>
          </section>

          {/* Rationale shown on arrow */}
          <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Begründung des Entwicklungsschritts
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-900 dark:text-slate-100">
              {selectedArrow.rationale || 'Keine Begründung am Pfeil hinterlegt.'}
            </p>
          </section>

          {/* Linked Ursachen_Tests_Befunde */}
          <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <FlaskConical className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Verknüpfte Ursachen, Tests & Befunde</span>
              </h3>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {arrowCauses.length}
              </span>
            </div>

            {arrowCauses.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {selectedArrow.causeIdRaw
                  ? `Verweis "${selectedArrow.causeIdRaw}" konnte nicht in Ursachen_Tests_Befunde gefunden werden.`
                  : 'Diesem Pfeil ist keine Begruendung_Ursache_ID zugeordnet.'}
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {arrowCauses.map((cause) => {
                  const causeLearningIds = getLearningIdsForCause(cause, learnings);
                  const isLearningCause =
                    selectedLearningId !== null && causeLearningIds.includes(selectedLearningId);
                  return (
                    <div
                      key={cause.id}
                      className={`border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 dark:border-slate-800 text-xs ${
                        isLearningCause
                          ? 'rounded-md bg-indigo-50/60 p-2.5 dark:bg-indigo-950/35'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {cause.id}
                        </span>
                        {cause.category && (
                          <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                            {cause.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {cause.title}
                      </div>

                      <div className="mt-2.5">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Dokumentierte Beobachtung (Fakt)
                        </div>
                        <p className="mt-0.5 leading-relaxed text-slate-800 dark:text-slate-200">
                          {cause.observation || 'Keine Beobachtung dokumentiert.'}
                        </p>
                      </div>

                      <div className="mt-2.5">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Hypothese / Grenze der Nachweiskraft
                        </div>
                        <p className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">
                          {cause.hypothesis || 'Keine Hypothese oder Nachweisgrenze hinterlegt.'}
                        </p>
                      </div>

                      {renderLearningBadges(causeLearningIds)}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </aside>
    );
  }

  // MODE B: DevelopmentStep Inspector
  const step = selectedStep!;
  const standStyle = STAND_STYLES[step.standCategory];
  const phaseCfg = phaseMap.get(step.phase);
  const laneFormatted = formatCodeAndLabel(step.spur);
  const incomingArrows = allArrows.filter((a) => a.to === step.id);
  const outgoingArrows = allArrows.filter((a) => a.from === step.id);
  const stepLearningIds = getLearningIdsForStep(step, learnings);

  return (
    <aside
      aria-label={`Detail-Inspector für Entwicklungsschritt ${step.id}`}
      className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:w-[410px] shrink-0"
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {step.id}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none ${standStyle.badgeClass}`}
            >
              {step.standCategory === 'milestone' && <Flag className="h-2.5 w-2.5 shrink-0" />}
              <span>
                {step.standCategory === 'final'
                  ? 'FINAL'
                  : step.standCategory === 'milestone'
                    ? 'Meilenstein (Prüfpunkt)'
                    : step.stand}
              </span>
            </span>
            {step.stepType && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {step.stepType}
              </span>
            )}
          </div>

          <h2 className="mt-2 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {step.title || '(Ohne Kurz_Titel)'}
          </h2>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {laneFormatted.code ? `${laneFormatted.code} ` : ''}
              {laneFormatted.label}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {phaseCfg?.phaseType === 'Meilenstein' && (
                <Flag className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              )}
              {phaseCfg ? `${phaseCfg.sortOrder}. ${phaseCfg.name}` : step.phase}
            </span>
          </div>

          {renderLearningBadges(stepLearningIds)}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Inspector schließen"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Detail Content */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4 text-sm">
        {/* Section 1: Constructive / Logical Implementation */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
            {step.implementation || 'Für diesen Schritt wurde keine Ausführung hinterlegt.'}
          </p>
        </section>

        {/* Section 2: Linked Ursachen_Tests_Befunde */}
        <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCausesOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <FlaskConical className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Verknüpfte Ursachen, Tests & Befunde</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              <span>{stepCauses.length}</span>
              {causesOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {causesOpen && (
            <div className="mt-3">
              {stepCauses.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Keine Einträge aus Ursachen_Tests_Befunde direkt mit diesem Schritt verknüpft.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stepCauses.map(({ cause, relation }) => {
                    const causeLearningIds = getLearningIdsForCause(cause, learnings);
                    const isLearningCause =
                      selectedLearningId !== null && causeLearningIds.includes(selectedLearningId);
                    return (
                      <div
                        key={cause.id}
                        className={`py-3 first:pt-0 last:pb-0 text-xs ${
                          isLearningCause
                            ? 'my-1 rounded-md bg-indigo-50/60 px-2.5 py-2.5 dark:bg-indigo-950/35'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {cause.id}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cause.category ? `${cause.category} · ` : ''}
                            {relation}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {cause.title}
                        </div>

                        <div className="mt-2">
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Dokumentierte Beobachtung (Fakt)
                          </div>
                          <p className="mt-0.5 leading-relaxed text-slate-800 dark:text-slate-200">
                            {cause.observation || '—'}
                          </p>
                        </div>

                        <div className="mt-2">
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Hypothese / Grenze der Nachweiskraft
                          </div>
                          <p className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">
                            {cause.hypothesis || '—'}
                          </p>
                        </div>

                        {renderLearningBadges(causeLearningIds)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 3: Micro-Iterations */}
        <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMicroOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                Ausgelagerte Mikro-Iterationen
                {step.detailBox ? ` (${step.detailBox})` : ''}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              <span>{microIterations.length}</span>
              {microOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {microOpen && (
            <div className="mt-3">
              {microIterations.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {step.detailBox
                    ? `Detail_Box "${step.detailBox}" enthält keine Einträge in Mikro_Iterationen.`
                    : 'Keine ausgelagerte Detail_Box für diesen Schritt vorhanden.'}
                </p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                  {microIterations.map((m, idx) => (
                    <li
                      key={`${m.detailBox}-${m.stepNumber}-${idx}`}
                      className="py-3 first:pt-0 last:pb-0 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          Schritt {m.stepNumber || idx + 1}
                        </span>
                        {m.evaluation && (
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {m.evaluation}
                          </span>
                        )}
                      </div>
                      {m.change && (
                        <div className="mt-1.5">
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            Änderung:{' '}
                          </span>
                          <span className="leading-relaxed text-slate-800 dark:text-slate-200">
                            {m.change}
                          </span>
                        </div>
                      )}
                      {m.result && (
                        <div className="mt-1">
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            Ergebnis:{' '}
                          </span>
                          <span className="leading-relaxed text-slate-700 dark:text-slate-300">
                            {m.result}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>

        {/* Section 4: Incoming & Outgoing Arrows */}
        <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Begründete Verbindungen (Pfeile)
          </h3>

          {/* Incoming */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Eingehende Verbindungen ({incomingArrows.length})</span>
            </div>
            {incomingArrows.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Keine eingehenden Pfeile.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {incomingArrows.map((arrow) => {
                  const sourceStep = stepMap.get(arrow.from);
                  const eStyle = EDGE_STYLES[arrow.category];
                  return (
                    <li
                      key={arrow.id}
                      className="rounded-md border border-slate-200/80 p-2.5 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => sourceStep && onSelectStep(sourceStep.id)}
                            disabled={!sourceStep}
                            className="font-mono font-semibold text-blue-700 hover:underline disabled:text-red-600 dark:text-blue-400"
                          >
                            {arrow.from}
                          </button>
                          <span className="text-slate-400">via</span>
                          <button
                            type="button"
                            onClick={() => onSelectArrow(arrow.id)}
                            className="font-mono text-[11px] font-medium text-slate-600 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:text-white"
                          >
                            {arrow.id}
                          </button>
                        </div>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${eStyle.badgeClass}`}
                        >
                          {eStyle.shortLabel}
                        </span>
                      </div>
                      {sourceStep && (
                        <div className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                          {sourceStep.title}
                        </div>
                      )}
                      {arrow.rationale && (
                        <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                          {arrow.rationale}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Outgoing */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Ausgehende Verbindungen ({outgoingArrows.length})</span>
            </div>
            {outgoingArrows.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Keine ausgehenden Pfeile.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {outgoingArrows.map((arrow) => {
                  const targetStep = stepMap.get(arrow.to);
                  const eStyle = EDGE_STYLES[arrow.category];
                  return (
                    <li
                      key={arrow.id}
                      className="rounded-md border border-slate-200/80 p-2.5 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => targetStep && onSelectStep(targetStep.id)}
                            disabled={!targetStep}
                            className="font-mono font-semibold text-blue-700 hover:underline disabled:text-red-600 dark:text-blue-400"
                          >
                            {arrow.to}
                          </button>
                          <span className="text-slate-400">via</span>
                          <button
                            type="button"
                            onClick={() => onSelectArrow(arrow.id)}
                            className="font-mono text-[11px] font-medium text-slate-600 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:text-white"
                          >
                            {arrow.id}
                          </button>
                        </div>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${eStyle.badgeClass}`}
                        >
                          {eStyle.shortLabel}
                        </span>
                      </div>
                      {targetStep && (
                        <div className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                          {targetStep.title}
                        </div>
                      )}
                      {arrow.rationale && (
                        <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                          {arrow.rationale}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
};
