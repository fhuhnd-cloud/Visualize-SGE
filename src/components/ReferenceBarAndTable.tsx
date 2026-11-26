import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Plus, Trash2, X } from 'lucide-react';
import {
  AppMode,
  NomenclatureLang,
  RseMaster,
  RseReferenceLink,
  SgeVariationKind,
} from '../types/sge';
import { countReferencesByVariation } from '../utils/sgeAnalytics';
import {
  VARIATION_MARKER_COLORS,
  formatVariationCode,
} from '../utils/sgeVisualConfig';

interface ReferenceBarAndTableProps {
  eventId: string;
  references: RseReferenceLink[];
  rseList: RseMaster[];
  appMode: AppMode;
  lang: NomenclatureLang;
  /** Default expanded state (e.g. true in Detail Level 3 or inside Deep-Dive Drawer) */
  defaultExpanded?: boolean;
  /** Compact layout for 2D Swimlane cells */
  compact?: boolean;
  onAddReference: (eventId: string, ref: Omit<RseReferenceLink, 'id'>) => void;
  onUpdateReference: (
    eventId: string,
    refId: string,
    patch: Partial<Omit<RseReferenceLink, 'id'>>
  ) => void;
  onDeleteReference: (eventId: string, refId: string) => void;
  onSelectRse?: (rseId: string) => void;
}

const VARIATION_OPTIONS: SgeVariationKind[] = ['CV', 'AV', 'PV', 'REM'];

export const ReferenceBarAndTable: React.FC<ReferenceBarAndTableProps> = ({
  eventId,
  references,
  rseList,
  appMode,
  lang,
  defaultExpanded = false,
  compact = false,
  onAddReference,
  onUpdateReference,
  onDeleteReference,
  onSelectRse,
}) => {
  const isEdit = appMode === 'edit';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [adding, setAdding] = useState(false);
  const [newRef, setNewRef] = useState<{
    refRseId: string;
    refName: string;
    originGeneration: string;
    variationType: SgeVariationKind;
    rationale: string;
  }>({
    refRseId: rseList[0]?.rseId ?? 'EXTERN',
    refName: rseList[0]?.name ?? '',
    originGeneration: 'G_0',
    variationType: 'AV',
    rationale: '',
  });

  const counts = countReferencesByVariation(references);

  if (counts.total === 0 && !isEdit) return null;

  const allBadgeItems: { kind: SgeVariationKind; count: number }[] = [
    { kind: 'CV', count: counts.CV },
    { kind: 'AV', count: counts.AV },
    { kind: 'PV', count: counts.PV },
    { kind: 'REM', count: counts.REM },
  ];
  const badgeItems = allBadgeItems.filter((b) => b.count > 0);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/95 text-[10px] dark:border-slate-700/80 dark:bg-slate-800/75"
    >
      {/* Detached Compact Reference Strip */}
      <div className="flex items-center justify-between gap-1.5 px-2 py-1">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {badgeItems.length === 0 ? (
            <span className="text-[10px] italic text-slate-400">Keine Referenzen</span>
          ) : (
            badgeItems.map(({ kind, count }) => {
              const col = VARIATION_MARKER_COLORS[kind];
              return (
                <span
                  key={kind}
                  style={{
                    backgroundColor: col.bg,
                    borderColor: col.border,
                    color: col.text,
                  }}
                  className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.2 font-mono text-[9.5px] font-bold leading-tight whitespace-nowrap"
                >
                  <span
                    style={{ backgroundColor: col.dot }}
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                  />
                  <span>
                    {formatVariationCode(kind, lang)} {count}
                  </span>
                </span>
              );
            })
          )}
        </div>

        {/* Prominent Expand Button: [Layers-Icon] N ▾ */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          title={expanded ? 'Referenz-Tabelle einklappen' : 'Referenz-Tabelle ausklappen'}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors shrink-0 ${
            expanded
              ? 'border-slate-900 bg-slate-900 text-white dark:border-blue-500 dark:bg-blue-600'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          <Layers className="h-3 w-3 shrink-0" />
          <span className="tabular-nums">{counts.total}</span>
          {expanded ? (
            <ChevronUp className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
        </button>
      </div>

      {/* Expandable Structured Reference Table */}
      {expanded && (
        <div
          className={
            compact
              ? 'absolute left-0 top-full z-40 mt-1.5 w-[500px] max-w-[85vw] rounded-lg border border-slate-300 bg-white p-2.5 shadow-2xl dark:border-slate-600 dark:bg-slate-900'
              : 'rounded-b-md border-t border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900'
          }
        >
          {compact && (
            <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Layers className="h-3 w-3 text-blue-600" />
                <span>Verwendete Referenzen ({counts.total})</span>
              </span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="Referenz-Tabelle schließen"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-200 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-1 pr-2 whitespace-nowrap">RSE_ID</th>
                  <th className="py-1 pr-2">Bezeichnung</th>
                  <th className="py-1 pr-2 whitespace-nowrap">Herkunft</th>
                  <th className="py-1 pr-2 whitespace-nowrap">Variationsart</th>
                  <th className="py-1">Begründung</th>
                  {isEdit && <th className="py-1 pl-1 text-right" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {references.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isEdit ? 6 : 5}
                      className="py-2 text-center italic text-slate-400"
                    >
                      Noch keine Referenzen verknüpft.
                    </td>
                  </tr>
                ) : (
                  references.map((ref) => {
                    const col = VARIATION_MARKER_COLORS[ref.variationType];
                    return (
                      <tr key={ref.id} className="align-top">
                        <td className="py-1.5 pr-2 font-mono font-bold whitespace-nowrap">
                          {onSelectRse && ref.refRseId !== 'EXTERN' ? (
                            <button
                              type="button"
                              onClick={() => onSelectRse(ref.refRseId)}
                              className="text-blue-700 hover:underline dark:text-blue-400"
                              title={ref.refName}
                            >
                              {ref.refRseId}
                            </button>
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200" title={ref.refName}>
                              {ref.refRseId}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[140px] py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                          <div className="line-clamp-2">{ref.refName || '—'}</div>
                        </td>
                        <td className="py-1.5 pr-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {ref.originGeneration}
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {isEdit ? (
                            <select
                              value={ref.variationType}
                              onChange={(e) =>
                                onUpdateReference(eventId, ref.id, {
                                  variationType: e.target.value as SgeVariationKind,
                                })
                              }
                              style={{
                                backgroundColor: col.bg,
                                borderColor: col.border,
                                color: col.text,
                              }}
                              className="rounded border px-1 py-0.5 font-mono text-[10px] font-bold"
                            >
                              {VARIATION_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {formatVariationCode(opt, lang)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              style={{
                                backgroundColor: col.bg,
                                borderColor: col.border,
                                color: col.text,
                              }}
                              className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold"
                            >
                              <span
                                style={{ backgroundColor: col.dot }}
                                className="h-1.5 w-1.5 rounded-full"
                              />
                              {formatVariationCode(ref.variationType, lang)}
                            </span>
                          )}
                        </td>
                        <td className="min-w-[120px] py-1.5 leading-snug text-slate-700 dark:text-slate-300">
                          {ref.rationale || '—'}
                        </td>
                        {isEdit && (
                          <td className="py-1.5 pl-1 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteReference(eventId, ref.id)}
                              title="Referenz entfernen"
                              className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Edit Mode: Inline Add Reference Form */}
          {isEdit && (
            <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              {!adding ? (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-blue-300 bg-blue-50/60 px-2 py-1 text-[10px] font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  <Plus className="h-3 w-3" />
                  <span>Referenz hinzufügen</span>
                </button>
              ) : (
                <div className="space-y-1.5 rounded-md border border-blue-200 bg-blue-50/40 p-2 dark:border-blue-800 dark:bg-blue-950/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={newRef.refRseId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = rseList.find((r) => r.rseId === val);
                        setNewRef({
                          ...newRef,
                          refRseId: val,
                          refName: found ? found.name : 'Externe Referenz',
                        });
                      }}
                      className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="EXTERN">EXTERN (Fremdsystem / Zukauf)</option>
                      {rseList.map((r) => (
                        <option key={r.rseId} value={r.rseId}>
                          {r.rseId} · {r.name.slice(0, 26)}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-1">
                      <select
                        value={newRef.originGeneration}
                        onChange={(e) =>
                          setNewRef({ ...newRef, originGeneration: e.target.value })
                        }
                        className="w-1/2 rounded border border-slate-300 bg-white px-1 py-1 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="G_0">G_0</option>
                        <option value="G_1">G_1</option>
                        <option value="G_2">G_2</option>
                        <option value="G_3">G_3</option>
                        <option value="Extern">Extern</option>
                      </select>
                      <select
                        value={newRef.variationType}
                        onChange={(e) =>
                          setNewRef({
                            ...newRef,
                            variationType: e.target.value as SgeVariationKind,
                          })
                        }
                        className="w-1/2 rounded border border-slate-300 bg-white px-1 py-1 font-mono text-[10px] font-bold dark:border-slate-700 dark:bg-slate-800"
                      >
                        {VARIATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {formatVariationCode(opt, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newRef.rationale}
                    onChange={(e) => setNewRef({ ...newRef, rationale: e.target.value })}
                    placeholder="Anpassungs- / Übernahme-Begründung..."
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-800"
                  />

                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddReference(eventId, newRef);
                        setAdding(false);
                        setNewRef({ ...newRef, rationale: '' });
                      }}
                      className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700"
                    >
                      Übernehmen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
