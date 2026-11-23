import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Flag,
  FlaskConical,
  Layers,
  Minus,
  PanelRightOpen,
  Plus,
} from 'lucide-react';
import { DevelopmentStep, MicroIteration } from '../types/duckomat';
import { LinkedCauseItem } from '../utils/graphAlgorithms';
import { STAND_STYLES } from '../utils/visualConfig';

interface NodeCardProps {
  step: DevelopmentStep;
  linkedCauses: LinkedCauseItem[];
  microIterations: MicroIteration[];
  learningIds: string[];
  selectedLearningId: string | null;
  isLearningDirect: boolean;
  isLearningChain: boolean;
  isInterimLatest: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  finalOverviewMode: boolean;
  focusRole: 'none' | 'focused' | 'upstream' | 'downstream' | 'dimmed';
  isNewlyRevealed: boolean;
  hasValidationIssue: boolean;
  onSelect: (stepId: string) => void;
  onSelectLearning: (learningId: string) => void;
  onHoverChange: (stepId: string | null) => void;
  onToggleExpand: (stepId: string) => void;
  onOpenInspector: (stepId: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  step,
  linkedCauses,
  microIterations,
  learningIds,
  selectedLearningId,
  isLearningDirect,
  isLearningChain,
  isInterimLatest,
  isExpanded,
  isSelected,
  finalOverviewMode,
  focusRole,
  isNewlyRevealed,
  hasValidationIssue,
  onSelect,
  onSelectLearning,
  onHoverChange,
  onToggleExpand,
  onOpenInspector,
}) => {
  const [causesOpen, setCausesOpen] = useState(true);
  const [microListOpen, setMicroListOpen] = useState(true);

  const isFinal = step.standCategory === 'final';
  const isMilestone = step.standCategory === 'milestone';
  const isSuperseded = step.standCategory === 'superseded';
  const standStyle = STAND_STYLES[step.standCategory];
  const hasDetailBox = Boolean(step.detailBox) || microIterations.length > 0;
  const hasCauses = linkedCauses.length > 0;

  // Frame & Surface styling:
  // - Only explicit "Aktueller Stand (Final)" receives the green FINAL border/badge.
  // - Milestones receive an amber checkpoint border/badge (never green/FINAL).
  // - Direct Learning steps get an indigo highlight ring when a Methodik-Learning is active.
  let frameClass = '';
  if (isSelected) {
    frameClass = isLearningDirect
      ? 'border-2 border-indigo-600 ring-3 ring-indigo-500/30 dark:border-indigo-400 dark:ring-indigo-400/30'
      : isFinal
        ? 'border-2 border-emerald-600 ring-3 ring-emerald-500/25 dark:border-emerald-400 dark:ring-emerald-400/25'
        : isMilestone
          ? 'border-2 border-amber-500 ring-3 ring-amber-500/25 dark:border-amber-400 dark:ring-amber-400/25'
          : 'border-2 border-blue-600 ring-2 ring-blue-600/20 dark:border-blue-400 dark:ring-blue-400/25';
  } else if (isLearningDirect) {
    frameClass =
      'border-2 border-indigo-600 ring-2 ring-indigo-500/25 shadow-xs dark:border-indigo-400 dark:ring-indigo-400/25';
  } else if (isLearningChain) {
    frameClass =
      'border-2 border-indigo-400/85 hover:border-indigo-500 dark:border-indigo-500/80 dark:hover:border-indigo-400';
  } else if (focusRole === 'focused') {
    frameClass = isFinal
      ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/25 dark:border-emerald-400'
      : isMilestone
        ? 'border-2 border-amber-500 ring-2 ring-amber-500/20 dark:border-amber-400'
        : 'border-2 border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400';
  } else if (isFinal) {
    frameClass = finalOverviewMode
      ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm dark:border-emerald-400 dark:ring-emerald-400/20'
      : 'border-2 border-emerald-500/90 hover:border-emerald-600 dark:border-emerald-500/80 dark:hover:border-emerald-400';
  } else if (isMilestone) {
    frameClass =
      'border border-amber-400/90 hover:border-amber-500 dark:border-amber-600/80 dark:hover:border-amber-500';
  } else if (focusRole === 'upstream') {
    frameClass = 'border border-amber-500 dark:border-amber-400';
  } else if (focusRole === 'downstream') {
    frameClass = 'border border-blue-500 dark:border-blue-400';
  } else if (isNewlyRevealed) {
    frameClass = 'border border-blue-400 dark:border-blue-500';
  } else if (hasValidationIssue) {
    frameClass = 'border border-red-300 dark:border-red-800';
  } else if (isSuperseded) {
    frameClass =
      'border border-slate-200/90 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700';
  } else {
    frameClass =
      'border border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600';
  }

  const surfaceClass = isLearningDirect
    ? 'bg-indigo-50/45 dark:bg-indigo-950/30'
    : isMilestone
      ? 'bg-amber-50/55 dark:bg-amber-950/25'
      : isFinal
        ? 'bg-white dark:bg-slate-900'
        : isSuperseded
          ? 'bg-slate-50/90 dark:bg-slate-900/65'
          : 'bg-white dark:bg-slate-900';

  const opacityClass =
    focusRole === 'dimmed'
      ? 'opacity-20 hover:opacity-80'
      : isSuperseded && focusRole === 'none' && !isLearningDirect && !isLearningChain
        ? 'opacity-80 hover:opacity-100'
        : 'opacity-100';

  const standBadgeText = isFinal
    ? 'FINAL'
    : isMilestone
      ? 'Meilenstein'
      : isSuperseded
        ? 'Überarbeitet'
        : step.stand || standStyle.badgeText;

  return (
    <article
      data-node-id={step.id}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-expanded={isExpanded}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(step.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onToggleExpand(step.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(step.id);
        }
      }}
      onMouseEnter={() => onHoverChange(step.id)}
      onMouseLeave={() => onHoverChange(null)}
      className={`group relative w-full cursor-pointer select-none rounded-lg text-left transition-[opacity,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${frameClass} ${surfaceClass} ${opacityClass}`}
    >
      {/* Compact Header & Title */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-mono text-xs font-semibold tracking-tight tabular-nums ${
                isSuperseded && !isLearningDirect
                  ? 'text-slate-600 dark:text-slate-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {step.id || '—'}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${standStyle.badgeClass}`}
              title={step.stand}
            >
              {isMilestone && <Flag className="h-2.5 w-2.5 shrink-0" />}
              <span>{standBadgeText}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasCauses && (
              <span
                title={`${linkedCauses.length} verknüpfte Befunde / Ursachen`}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-medium text-amber-700 dark:text-amber-400"
              >
                <FlaskConical className="h-3 w-3" />
                <span className="tabular-nums">{linkedCauses.length}</span>
              </span>
            )}

            {hasDetailBox && (
              <span
                title={`Detail_Box ${step.detailBox || ''}${microIterations.length > 0 ? ` (${microIterations.length} Mikro-Iterationen)` : ''}`}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:text-blue-300"
              >
                <Layers className="h-3 w-3" />
                {microIterations.length > 0 && (
                  <span className="tabular-nums">{microIterations.length}</span>
                )}
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspector(step.id);
              }}
              aria-label={`Details für ${step.id} im Inspector öffnen`}
              title="Im Inspector öffnen"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/70 hover:text-slate-800 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(step.id);
              }}
              aria-label={isExpanded ? `${step.id} einklappen` : `${step.id} aufklappen`}
              title={isExpanded ? 'Einklappen' : 'Aufklappen (oder Doppelklick)'}
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <h3
          className={`mt-2 text-[13px] font-semibold leading-snug ${
            isSuperseded && !isLearningDirect
              ? 'text-slate-700 dark:text-slate-300'
              : 'text-slate-950 dark:text-slate-50'
          }`}
        >
          {step.title || '(Ohne Kurz_Titel)'}
        </h3>

        {/* Clickable Methodik-Learning Badges (M01..M12) */}
        {learningIds.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {learningIds.map((lId) => {
              const isActiveLearning = selectedLearningId === lId;
              return (
                <button
                  key={lId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLearning(lId);
                  }}
                  title={`Methodik-Learning ${lId} im Graph hervorheben`}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none transition-colors ${
                    isActiveLearning
                      ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950'
                      : 'border-indigo-200 bg-indigo-50/90 text-indigo-800 hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800/80 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:border-indigo-500'
                  }`}
                >
                  {lId}
                </button>
              );
            })}
          </div>
        )}

        {/* Quiet 1-line unboxed metadata footer */}
        {(step.stepType ||
          step.detailBox ||
          focusRole === 'upstream' ||
          focusRole === 'downstream' ||
          isLearningChain ||
          (isInterimLatest && !isFinal && !isMilestone)) && (
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="truncate">
              {step.stepType}
              {step.stepType && step.detailBox ? ' · ' : ''}
              {step.detailBox}
            </span>
            {focusRole === 'upstream' && (
              <span className="font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
                Vorgänger
              </span>
            )}
            {focusRole === 'downstream' && (
              <span className="font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0">
                Nachfolger
              </span>
            )}
            {focusRole === 'none' && isLearningChain && (
              <span className="font-medium text-indigo-700 dark:text-indigo-300 whitespace-nowrap shrink-0">
                Kausalkette
              </span>
            )}
            {focusRole === 'none' &&
              !isLearningChain &&
              isInterimLatest &&
              !isFinal &&
              !isMilestone && (
                <span className="font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                  Zwischenstand
                </span>
              )}
          </div>
        )}
      </div>

      {/* Inline Progressive Disclosure Body */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="cursor-default select-text border-t border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/50 rounded-b-lg"
        >
          {/* Implementation */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Konstruktive / Logische Ausführung
            </div>
            <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
              {step.implementation || 'Keine Ausführung dokumentiert.'}
            </p>
          </div>

          {/* Linked Ursachen_Tests_Befunde */}
          {linkedCauses.length > 0 && (
            <div className="mt-2.5 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCausesOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200"
              >
                <span className="flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                  <span>Ursachen, Tests & Befunde ({linkedCauses.length})</span>
                </span>
                {causesOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              {causesOpen && (
                <div className="mt-2 space-y-2.5">
                  {linkedCauses.map(({ cause, relation }) => (
                    <div
                      key={cause.id}
                      className="border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {cause.id}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {cause.category ? `${cause.category} · ` : ''}
                          {relation}
                        </span>
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                        {cause.title}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-slate-800 dark:text-slate-200">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Beobachtung (Fakt):{' '}
                        </span>
                        {cause.observation || '—'}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Hypothese / Nachweisgrenze:{' '}
                        </span>
                        {cause.hypothesis || '—'}
                      </div>
                      {cause.learnings.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {cause.learnings.map((lId) => {
                            const isActiveLearning = selectedLearningId === lId;
                            return (
                              <button
                                key={lId}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectLearning(lId);
                                }}
                                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none transition-colors ${
                                  isActiveLearning
                                    ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200'
                                }`}
                              >
                                {lId}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Micro-Iterations Sub-List */}
          {microIterations.length > 0 && (
            <div className="mt-2.5 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMicroListOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Mikro-Iterationen {step.detailBox ? `(${step.detailBox})` : ''} ·{' '}
                    {microIterations.length}
                  </span>
                </span>
                {microListOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              {microListOpen && (
                <ol className="mt-2 space-y-2">
                  {microIterations.map((m, idx) => (
                    <li
                      key={`${m.detailBox}-${m.stepNumber}-${idx}`}
                      className="border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0 dark:border-slate-800"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          Schritt {m.stepNumber || idx + 1}
                        </span>
                        {m.evaluation && (
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 text-right">
                            {m.evaluation}
                          </span>
                        )}
                      </div>
                      {m.change && (
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-800 dark:text-slate-200">
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            Änderung:{' '}
                          </span>
                          {m.change}
                        </p>
                      )}
                      {m.result && (
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            Ergebnis:{' '}
                          </span>
                          {m.result}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
