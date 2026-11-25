import React, { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import { AppMode, CustomPalette, SgeDataset } from '../types/sge';
import { isPlaceholderMicroIteration } from '../utils/excelParser';
import { getSwatchForStatus } from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';

interface DataTablesViewProps {
  dataset: SgeDataset;
  appMode: AppMode;
  palette: CustomPalette;
  onSelectRse: (rseId: string) => void;
  onOpenModal: (modal: ModalState) => void;
}

type SheetTab =
  | 'dashboard'
  | 'phases'
  | 'rse'
  | 'events'
  | 'matrix'
  | 'kombi'
  | 'micro'
  | 'steps'
  | 'causes'
  | 'arrows'
  | 'learnings'
  | 'predim'
  | 'summary';

export const DataTablesView: React.FC<DataTablesViewProps> = ({
  dataset,
  appMode,
  palette,
  onSelectRse,
  onOpenModal,
}) => {
  const isEdit = appMode === 'edit';
  const [activeTab, setActiveTab] = useState<SheetTab>('rse');
  const cleanMicroIterations = dataset.microIterations.filter(
    (m) => !isPlaceholderMicroIteration(m)
  );
  const lastVerKey = dataset.versions[dataset.versions.length - 1]?.versionKey ?? 'Aktuell';

  const tabs: { key: SheetTab; label: string; count: number }[] = [
    { key: 'dashboard', label: 'Überblick_Dashboard', count: dataset.dashboard.length },
    { key: 'phases', label: 'Phasen_Konfiguration', count: dataset.versions.length },
    { key: 'rse', label: 'RSE_Stammdaten', count: dataset.rseList.length },
    { key: 'events', label: 'RSE_Phasenwechsel', count: dataset.events.length },
    { key: 'matrix', label: 'RSE_Phasenmatrix', count: dataset.matrix.length },
    { key: 'kombi', label: 'Bauteil_Integrationen', count: dataset.kombis.length },
    { key: 'micro', label: 'Mikro_Iterationen', count: cleanMicroIterations.length },
    { key: 'steps', label: 'Entwicklungsschritte', count: dataset.steps.length },
    { key: 'causes', label: 'Ursachen_Tests_Befunde', count: dataset.causes.length },
    { key: 'arrows', label: 'Verbindungen_Pfeile', count: dataset.arrows.length },
    { key: 'learnings', label: 'Methodik_Learnings', count: dataset.learnings.length },
    { key: 'predim', label: 'Vorab_Dimensionierung', count: dataset.preDimensioning.length },
    { key: 'summary', label: 'SGE_Auswertung', count: dataset.sgeSummary.length },
  ];

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* 13 Sheet Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 pt-2 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-blue-600 text-slate-950 dark:border-blue-400 dark:text-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="ml-1 font-mono text-[10px] text-slate-400 tabular-nums">
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        {isEdit && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
            <span className="font-medium text-amber-950 dark:text-amber-200">
              Tabellen-Bearbeitung aktiv – Einträge direkt hinzufügen oder über Klick auf ein RSE/Element bearbeiten:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'add-rse' })}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3 w-3" /> RSE
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-kombi' })}
                className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-3 w-3" /> KOMBI
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-arrow' })}
                className="inline-flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
              >
                <Plus className="h-3 w-3" /> Pfeil
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-cause' })}
                className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                <Plus className="h-3 w-3" /> Ursache
              </button>
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-learning' })}
                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-3 w-3" /> Learning
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {activeTab === 'dashboard' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Spur_ID</th>
                  <th className="px-3 py-2">Systemspur</th>
                  <th className="px-3 py-2">Rolle im Gesamtsystem</th>
                  <th className="px-3 py-2">RSE</th>
                  <th className="px-3 py-2">Aktiv ({lastVerKey})</th>
                  <th className="px-3 py-2">Entf.</th>
                  <th className="px-3 py-2">Kombi</th>
                  <th className="px-3 py-2">Events</th>
                  <th className="px-3 py-2">Mikro-It.</th>
                  <th className="px-3 py-2">Reifegrad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...dataset.dashboard, ...(dataset.dashboardTotal ? [dataset.dashboardTotal] : [])].map(
                  (d) => (
                    <tr
                      key={d.spurId}
                      className={
                        d.spurId === 'SUMME'
                          ? 'bg-slate-100/80 font-bold dark:bg-slate-800/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{d.spurId}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{d.name}</td>
                      <td className="max-w-[260px] px-3 py-2 text-slate-600 dark:text-slate-300">
                        {d.role}
                      </td>
                      <td className="px-3 py-2 font-mono">{d.totalRse}</td>
                      <td className="px-3 py-2 font-mono">{d.activeRseV22}</td>
                      <td className="px-3 py-2 font-mono">{d.removedOrReplaced}</td>
                      <td className="px-3 py-2 font-mono">{d.integratedRse}</td>
                      <td className="px-3 py-2 font-mono">{d.versionEventsCount}</td>
                      <td className="px-3 py-2 font-mono">{d.microIterationsCount}</td>
                      <td className="max-w-[260px] px-3 py-2 text-slate-600 dark:text-slate-300">
                        {d.maturitySummary}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'phases' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Nr</th>
                  <th className="px-3 py-2">Version_Key</th>
                  <th className="px-3 py-2">Phasen_Name</th>
                  <th className="px-3 py-2">Meilenstein_Badge</th>
                  <th className="px-3 py-2">Technischer Systemstand & Einordnung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.versions.map((v) => (
                  <tr key={v.versionKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{v.sortOrder}</span>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'edit-version', version: v })}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                            title="Version bearbeiten"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{v.versionKey}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{v.phaseName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {v.milestoneBadge ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                          {v.milestoneBadge}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 leading-relaxed text-slate-700 dark:text-slate-300">
                      {v.systemStateSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'rse' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">RSE_ID</th>
                  <th className="px-3 py-2">Spur</th>
                  <th className="px-3 py-2">RSE_Bezeichnung</th>
                  <th className="px-3 py-2">Herkunft</th>
                  <th className="px-3 py-2">Erste_Ver</th>
                  <th className="px-3 py-2">Entfall</th>
                  <th className="px-3 py-2">Lebenszyklus</th>
                  <th className="px-3 py-2">Kombi_ID</th>
                  <th className="px-3 py-2">Ev.</th>
                  <th className="px-3 py-2">Mikro</th>
                  <th className="px-3 py-2">Kurzbeschreibung_Funktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.rseList.map((r) => (
                  <tr key={r.rseId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectRse(r.rseId)}
                            className="text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {r.rseId}
                          </button>
                          {isEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenModal({ kind: 'edit-rse', rse: r })}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                              title="RSE bearbeiten"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{r.spur}</td>
                    <td className="min-w-[180px] px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.origin}</td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                      {r.firstVersion.split(' ')[0]}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-red-700 dark:text-red-400 whitespace-nowrap">
                      {r.removalVersion ? r.removalVersion.split(' ')[0] : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.currentLifecycle}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-teal-700 dark:text-teal-300 whitespace-nowrap">
                      {r.currentKombiIdRaw || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.versionEventsCount}</td>
                    <td className="px-3 py-2 font-mono">{r.microIterationsCount}</td>
                    <td className="max-w-[320px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {r.functionSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'events' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Event_ID</th>
                  <th className="px-3 py-2">RSE_ID</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Variationstyp</th>
                  <th className="px-3 py-2">Kombi</th>
                  <th className="px-3 py-2">Kurzbeschreibung_Zustand</th>
                  <th className="px-3 py-2">Begruendung</th>
                  <th className="px-3 py-2">Ursache / Schritt</th>
                  <th className="px-3 py-2">Medien_Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.events.map((ev) => {
                  const sw = getSwatchForStatus(ev.statusCode, 'planning', palette);
                  return (
                    <tr key={ev.eventId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                        {ev.eventId}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectRse(ev.rseId)}
                          className="text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {ev.rseId}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                        {ev.version.split(' ')[0]}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          style={{
                            backgroundColor: sw.bg,
                            borderColor: sw.border,
                            color: sw.text,
                            borderStyle: sw.dashed ? 'dashed' : 'solid',
                          }}
                          className="inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        >
                          {ev.statusCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                        {ev.variationType}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-teal-700 dark:text-teal-300 whitespace-nowrap">
                        {ev.kombiPartIdRaw || '—'}
                      </td>
                      <td className="max-w-[260px] px-3 py-2">{ev.stateDescription}</td>
                      <td className="max-w-[240px] px-3 py-2 text-slate-600 dark:text-slate-300">
                        {ev.rationale || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                        {[ev.causeIdRaw, ev.stepIdRaw].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {ev.mediaRef || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'matrix' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">RSE_ID</th>
                  <th className="px-3 py-2">Spur</th>
                  <th className="px-3 py-2">RSE_Bezeichnung</th>
                  <th className="px-3 py-2">Kombi</th>
                  {dataset.versions.map((v) => (
                    <th key={v.versionKey} className="px-2 py-2 text-center font-mono">
                      {v.versionKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.matrix.map((row) => (
                  <tr key={row.rseId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold">
                      <button
                        type="button"
                        onClick={() => onSelectRse(row.rseId)}
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {row.rseId}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{row.spur}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-teal-700 dark:text-teal-300">
                      {row.kombiIdRaw || '—'}
                    </td>
                    {dataset.versions.map((v) => {
                      const code = row.statusByVersionKey[v.versionKey] ?? '';
                      const sw = getSwatchForStatus(code, 'planning', palette);
                      return (
                        <td key={v.versionKey} className="px-2 py-1.5 text-center">
                          {code ? (
                            <span
                              style={{
                                backgroundColor: sw.bg,
                                borderColor: sw.border,
                                color: sw.text,
                                borderStyle: sw.dashed ? 'dashed' : 'solid',
                              }}
                              className="inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                            >
                              {code}
                            </span>
                          ) : (
                            '·'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'kombi' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Kombi_ID</th>
                  <th className="px-3 py-2">Bauteil_Bezeichnung</th>
                  <th className="px-3 py-2">Ab Phase</th>
                  <th className="px-3 py-2">Beteiligte_RSE_IDs</th>
                  <th className="px-3 py-2">Spuren</th>
                  <th className="px-3 py-2">Variationsart</th>
                  <th className="px-3 py-2">Begründung</th>
                  <th className="px-3 py-2">Medien_Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.kombis.map((k) => (
                  <tr key={k.kombiId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold text-teal-800 dark:text-teal-300 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{k.kombiId}</span>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'upsert-kombi', existing: k })}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 font-semibold">{k.partName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{k.integratedFromPhase}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {k.involvedRseIds.map((id, i) => (
                        <React.Fragment key={id}>
                          {i > 0 && ', '}
                          <button
                            type="button"
                            onClick={() => onSelectRse(id)}
                            className="text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {id}
                          </button>
                        </React.Fragment>
                      ))}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{k.involvedLanes}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{k.variationType}</td>
                    <td className="max-w-[300px] px-3 py-2">{k.rationale}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                      {k.mediaRef || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'micro' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Detail_Box</th>
                  <th className="px-3 py-2">RSE_ID</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Schritt</th>
                  <th className="px-3 py-2">Sub_Version_ID</th>
                  <th className="px-3 py-2">Änderung</th>
                  <th className="px-3 py-2">Ergebnis</th>
                  <th className="px-3 py-2">Bewertung</th>
                  <th className="px-3 py-2">Medien_Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cleanMicroIterations.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                      {m.detailBox}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectRse(m.rseId)}
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {m.rseId}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                      {m.version.split(' ')[0]}
                    </td>
                    <td className="px-3 py-2 font-mono">{m.parentStepId}</td>
                    <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                      {m.subVersionId}
                    </td>
                    <td className="max-w-[260px] px-3 py-2">{m.change}</td>
                    <td className="max-w-[240px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {m.result}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.evaluation}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {m.mediaRef || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'steps' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Schritt_ID</th>
                  <th className="px-3 py-2">Spur</th>
                  <th className="px-3 py-2">RSE_ID</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Kurz_Titel</th>
                  <th className="px-3 py-2">Ausführung</th>
                  <th className="px-3 py-2">Learnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.steps.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold">{s.id}</td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{s.spur}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {s.rseIds.map((rId, i) => (
                        <React.Fragment key={rId}>
                          {i > 0 && ', '}
                          <button
                            type="button"
                            onClick={() => onSelectRse(rId)}
                            className="text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {rId}
                          </button>
                        </React.Fragment>
                      ))}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                      {s.version.split(' ')[0]}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 font-semibold">{s.title}</td>
                    <td className="max-w-[340px] px-3 py-2">{s.implementation}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                      {s.learnings.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'causes' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Ursache_ID</th>
                  <th className="px-3 py-2">Kategorie</th>
                  <th className="px-3 py-2">Betroffen → Ausgelöst</th>
                  <th className="px-3 py-2">Kurz_Titel</th>
                  <th className="px-3 py-2">Fakt (Beobachtung)</th>
                  <th className="px-3 py-2">Hypothese / Nachweisgrenze</th>
                  <th className="px-3 py-2">Learnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.causes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{c.id}</span>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'upsert-cause', existing: c })}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {c.affectedStepId || '—'} → {c.triggeredStepId || '—'}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 font-semibold">{c.title}</td>
                    <td className="max-w-[280px] px-3 py-2">{c.observation}</td>
                    <td className="max-w-[260px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {c.hypothesis}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                      {c.learnings.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'arrows' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">Pfeil_ID</th>
                  <th className="px-3 py-2">Von → Nach</th>
                  <th className="px-3 py-2">Pfeil_Typ</th>
                  <th className="px-3 py-2">Ursache_ID</th>
                  <th className="px-3 py-2">Begründung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.arrows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{a.id}</span>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'upsert-arrow', existing: a })}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {a.from} → {a.to}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.arrowType}</td>
                    <td className="px-3 py-2 font-mono text-amber-800 dark:text-amber-300">
                      {a.causeIdRaw || '—'}
                    </td>
                    <td className="px-3 py-2">{a.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'learnings' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Themenfeld</th>
                  <th className="px-3 py-2">Titel</th>
                  <th className="px-3 py-2">Übertragbares Prinzip</th>
                  <th className="px-3 py-2">Verknüpfungen</th>
                  <th className="px-3 py-2">DRM / Paper</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.learnings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{l.id}</span>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal({ kind: 'upsert-learning', existing: l })}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.topic}</td>
                    <td className="max-w-[200px] px-3 py-2 font-semibold">{l.title}</td>
                    <td className="max-w-[300px] px-3 py-2">{l.principle}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {[...l.linkedStepIds, ...l.linkedCauseIds].join(', ') || '—'}
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {l.scientificContext}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'predim' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Teilbereich</th>
                  <th className="px-3 py-2">Größe / Parameter</th>
                  <th className="px-3 py-2">Wert</th>
                  <th className="px-3 py-2">Einheit</th>
                  <th className="px-3 py-2">Herkunft / Formel</th>
                  <th className="px-3 py-2">Evidenz-Typ</th>
                  <th className="px-3 py-2">Methodische Einordnung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.preDimensioning.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono font-bold">{d.id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.subDomain}</td>
                    <td className="px-3 py-2 font-semibold">{d.parameter}</td>
                    <td className="px-3 py-2 font-mono font-bold">{d.value}</td>
                    <td className="px-3 py-2 font-mono">{d.unit}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {d.formulaOrSource}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.evidenceType}</td>
                    <td className="max-w-[260px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {d.methodicalNotes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'summary' && (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-3 py-2">SGE_Kennzahl / Status_Code</th>
                  {dataset.versions.map((v) => (
                    <th key={v.versionKey} className="px-2 py-2 text-center font-mono">
                      {v.versionKey}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Gesamt / Stand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dataset.sgeSummary.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-medium">{s.metricLabel}</td>
                    {dataset.versions.map((v) => {
                      const raw = s.valuesByVersionKey[v.versionKey] ?? '';
                      const num = Number(raw);
                      const isRatio =
                        s.metricLabel.toLowerCase().includes('quote') &&
                        raw !== '' &&
                        Number.isFinite(num);
                      return (
                        <td key={v.versionKey} className="px-2 py-2 text-center font-mono">
                          {isRatio ? `${Math.round(num * 100)}%` : raw || '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {s.totalOrSummary || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
