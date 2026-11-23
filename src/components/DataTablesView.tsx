import React, { useState } from 'react';
import { DuckomatDataset } from '../types/duckomat';
import { EDGE_STYLES, STAND_STYLES } from '../utils/visualConfig';

interface DataTablesViewProps {
  dataset: DuckomatDataset;
  invalidStepIds: Set<string>;
  invalidArrowIds: Set<string>;
  onJumpToStepInGraph: (stepId: string) => void;
  onJumpToLearningInGraph: (learningId: string) => void;
}

type SheetTab = 'phases' | 'steps' | 'causes' | 'arrows' | 'micro' | 'learnings';

export const DataTablesView: React.FC<DataTablesViewProps> = ({
  dataset,
  invalidStepIds,
  invalidArrowIds,
  onJumpToStepInGraph,
  onJumpToLearningInGraph,
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>('steps');

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* 6 Sheet Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 pt-2.5 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            {
              key: 'phases',
              label: 'Phasen_Konfiguration',
              count: dataset.phases.length,
            },
            {
              key: 'steps',
              label: 'Entwicklungsschritte',
              count: dataset.steps.length,
            },
            {
              key: 'causes',
              label: 'Ursachen_Tests_Befunde',
              count: dataset.causes.length,
            },
            {
              key: 'arrows',
              label: 'Verbindungen_Pfeile',
              count: dataset.arrows.length,
            },
            {
              key: 'micro',
              label: 'Mikro_Iterationen',
              count: dataset.microIterations.length,
            },
            {
              key: 'learnings',
              label: 'Methodik_Learnings',
              count: dataset.learnings.length,
            },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-blue-600 text-slate-950 dark:border-blue-400 dark:text-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="ml-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto p-5">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {activeTab === 'phases' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Sortier_Nr</th>
                  <th className="px-3 py-2.5">Phase_Key</th>
                  <th className="px-3 py-2.5">Phasen_Name</th>
                  <th className="px-3 py-2.5">Phasen_Typ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.phases.map((p, i) => (
                  <tr
                    key={`${p.phaseKey}-${i}`}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      p.phaseType === 'Meilenstein'
                        ? 'bg-amber-50/40 dark:bg-amber-950/15'
                        : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {p.sortOrder}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {p.phaseKey}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${
                          p.phaseType === 'Meilenstein'
                            ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {p.phaseType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'steps' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Schritt_ID</th>
                  <th className="px-3 py-2.5">Spur</th>
                  <th className="px-3 py-2.5">Phase</th>
                  <th className="px-3 py-2.5">Schritt_Typ</th>
                  <th className="px-3 py-2.5">Automatischer_Stand</th>
                  <th className="px-3 py-2.5">Kurz_Titel</th>
                  <th className="px-3 py-2.5">Konstruktive / Logische Ausführung</th>
                  <th className="px-3 py-2.5">Detail_Box</th>
                  <th className="px-3 py-2.5">Learnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.steps.map((s, i) => {
                  const hasIssue = invalidStepIds.has(s.id);
                  const stStyle = STAND_STYLES[s.standCategory];
                  return (
                    <tr
                      key={`${s.id}-${i}`}
                      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        hasIssue ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 align-top font-mono font-semibold tabular-nums whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onJumpToStepInGraph(s.id)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {s.id || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {s.spur}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {s.phase}
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {s.stepType || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] leading-none ${stStyle.badgeClass}`}
                        >
                          {s.standCategory === 'final' ? 'FINAL' : s.stand}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 align-top font-medium text-slate-900 dark:text-slate-100">
                        {s.title}
                      </td>
                      <td className="max-w-[340px] px-3 py-2.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
                        {s.implementation || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {s.detailBox || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        {s.learnings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.learnings.map((lId) => (
                              <button
                                key={lId}
                                type="button"
                                onClick={() => onJumpToLearningInGraph(lId)}
                                className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                              >
                                {lId}
                              </button>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'causes' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Ursache_ID</th>
                  <th className="px-3 py-2.5">Kategorie</th>
                  <th className="px-3 py-2.5">Betroffener_Schritt</th>
                  <th className="px-3 py-2.5">Ausgeloester_Schritt</th>
                  <th className="px-3 py-2.5">Kurz_Titel</th>
                  <th className="px-3 py-2.5">Dokumentierte Beobachtung / Fakt</th>
                  <th className="px-3 py-2.5">Hypothese / Grenze der Nachweiskraft</th>
                  <th className="px-3 py-2.5">Learnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.causes.map((c, i) => (
                  <tr
                    key={`${c.id}-${i}`}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-3 py-2.5 align-top font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {c.id || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {c.category || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">
                      {c.affectedStepId ? (
                        <button
                          type="button"
                          onClick={() => onJumpToStepInGraph(c.affectedStepId)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {c.affectedStepId}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">
                      {c.triggeredStepId ? (
                        <button
                          type="button"
                          onClick={() => onJumpToStepInGraph(c.triggeredStepId)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {c.triggeredStepId}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 align-top font-medium text-slate-900 dark:text-slate-100">
                      {c.title || '—'}
                    </td>
                    <td className="max-w-[280px] px-3 py-2.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
                      {c.observation || '—'}
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5 align-top leading-relaxed text-slate-600 dark:text-slate-400">
                      {c.hypothesis || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      {c.learnings.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.learnings.map((lId) => (
                            <button
                              key={lId}
                              type="button"
                              onClick={() => onJumpToLearningInGraph(lId)}
                              className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                            >
                              {lId}
                            </button>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'arrows' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Pfeil_ID</th>
                  <th className="px-3 py-2.5">Von_Schritt_ID</th>
                  <th className="px-3 py-2.5">Nach_Schritt_ID</th>
                  <th className="px-3 py-2.5">Pfeil_Typ</th>
                  <th className="px-3 py-2.5">Begruendung_Ursache_ID</th>
                  <th className="px-3 py-2.5">Begründung des Entwicklungsschritts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.arrows.map((a, i) => {
                  const hasIssue = invalidArrowIds.has(a.id);
                  const eStyle = EDGE_STYLES[a.category];
                  return (
                    <tr
                      key={`${a.id}-${i}`}
                      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        hasIssue ? 'bg-red-50/60 dark:bg-red-950/25' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 align-top font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100 whitespace-nowrap">
                        {a.id}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onJumpToStepInGraph(a.from)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {a.from || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onJumpToStepInGraph(a.to)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {a.to || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${eStyle.badgeClass}`}
                        >
                          {a.arrowType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-amber-800 dark:text-amber-300 whitespace-nowrap">
                        {a.causeIdRaw || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
                        {a.rationale || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'micro' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Detail_Box</th>
                  <th className="px-3 py-2.5">Gehört_zu_Schritt</th>
                  <th className="px-3 py-2.5">Spur</th>
                  <th className="px-3 py-2.5">Schritt_Nr</th>
                  <th className="px-3 py-2.5">Konstruktive / Fertigungstechnische Änderung</th>
                  <th className="px-3 py-2.5">Beobachtetes Ergebnis</th>
                  <th className="px-3 py-2.5">Bewertung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.microIterations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Keine Mikro-Iterationen im aktuellen Datensatz vorhanden.
                    </td>
                  </tr>
                ) : (
                  dataset.microIterations.map((m, i) => (
                    <tr
                      key={`${m.detailBox}-${m.stepNumber}-${i}`}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2.5 align-top font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {m.detailBox || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">
                        {m.parentStepId ? (
                          <button
                            type="button"
                            onClick={() => onJumpToStepInGraph(m.parentStepId)}
                            className="text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {m.parentStepId}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {m.spur || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {m.stepNumber || '—'}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5 align-top leading-relaxed text-slate-800 dark:text-slate-200">
                        {m.change || '—'}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
                        {m.result || '—'}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 align-top font-medium text-slate-800 dark:text-slate-200">
                        {m.evaluation || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'learnings' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-3 py-2.5">Learning_ID</th>
                  <th className="px-3 py-2.5">Themenfeld</th>
                  <th className="px-3 py-2.5">Kurz_Titel_Learning</th>
                  <th className="px-3 py-2.5">Übertragbares Prinzip</th>
                  <th className="px-3 py-2.5">Projektbeispiel</th>
                  <th className="px-3 py-2.5">Verknuepfte_Schritte</th>
                  <th className="px-3 py-2.5">Verknuepfte_Ursachen</th>
                  <th className="px-3 py-2.5">Wissenschaftliche Einordnung (DRM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.learnings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Keine Methodik-Learnings (Blatt Methodik_Learnings) im Datensatz vorhanden.
                    </td>
                  </tr>
                ) : (
                  dataset.learnings.map((l, i) => (
                    <tr
                      key={`${l.id}-${i}`}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2.5 align-top font-mono font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onJumpToLearningInGraph(l.id)}
                          title="Learning im Graph hervorheben"
                          className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                        >
                          {l.id}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {l.topic || '—'}
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 align-top font-semibold text-slate-900 dark:text-slate-100">
                        {l.title || '—'}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5 align-top leading-relaxed text-slate-800 dark:text-slate-200">
                        {l.principle || '—'}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5 align-top leading-relaxed text-slate-700 dark:text-slate-300">
                        {l.projectExample || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {l.linkedStepIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {l.linkedStepIds.map((sId) => (
                              <button
                                key={sId}
                                type="button"
                                onClick={() => onJumpToStepInGraph(sId)}
                                className="font-mono text-[11px] font-medium text-blue-700 hover:underline dark:text-blue-400"
                              >
                                {sId}
                              </button>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-amber-800 dark:text-amber-300">
                        {l.linkedCauseIds.length > 0 ? l.linkedCauseIds.join(', ') : '—'}
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5 align-top leading-relaxed text-slate-600 dark:text-slate-400">
                        {l.scientificContext || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
