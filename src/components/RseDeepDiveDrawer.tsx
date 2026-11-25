import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Edit3,
  FlaskConical,
  GitBranch,
  GitCommitHorizontal,
  Layers,
  Lightbulb,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppMode,
  ColorMode,
  CustomPalette,
  MediaAttachment,
  PhaseVersionConfig,
  SgeDataset,
  StatusCode,
} from '../types/sge';
import {
  getCausesForEvent,
  getKombisForRse,
  getLearningsForEvent,
  getMicroIterationsForRse,
} from '../utils/sgeAnalytics';
import {
  ALL_STATUS_CODES,
  EDGE_STYLES,
  getLaneDisplayName,
  getSwatchForStatus,
} from '../utils/sgeVisualConfig';
import { ModalState } from './EntityEditModals';
import { LightboxPayload } from './LightboxModal';
import { MediaDropzone } from './MediaDropzone';

interface RseDeepDiveDrawerProps {
  rseId: string | null;
  arrowId: string | null;
  dataset: SgeDataset;
  selectedVersion: PhaseVersionConfig;
  appMode: AppMode;
  colorMode: ColorMode;
  palette: CustomPalette;
  mediaMap: Record<string, MediaAttachment>;
  onClose: () => void;
  onSelectRse: (rseId: string) => void;
  onSelectVersionIndex: (index: number) => void;
  onQuickStatusChange: (rseId: string, versionKey: string, nextStatus: StatusCode) => void;
  onAddMicroIteration: (input: {
    rseId: string;
    versionKey: string;
    detailBox: string;
    subVersionId: string;
    change: string;
    result: string;
    evaluation: string;
  }) => void;
  onEditMicroIteration: (
    microId: string,
    patch: { change?: string; result?: string; evaluation?: string }
  ) => void;
  onDeleteMicroIteration: (microId: string) => void;
  onOpenModal: (modal: ModalState) => void;
  onUploadMedia: (refKey: string, file: File) => void;
  onUpdateMediaCaption: (refKey: string, caption: string) => void;
  onDeleteMedia: (refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
}

export const RseDeepDiveDrawer: React.FC<RseDeepDiveDrawerProps> = ({
  rseId,
  arrowId,
  dataset,
  selectedVersion,
  appMode,
  colorMode,
  palette,
  mediaMap,
  onClose,
  onSelectRse,
  onSelectVersionIndex,
  onQuickStatusChange,
  onAddMicroIteration,
  onEditMicroIteration,
  onDeleteMicroIteration,
  onOpenModal,
  onUploadMedia,
  onUpdateMediaCaption,
  onDeleteMedia,
  onOpenLightbox,
}) => {
  const isEdit = appMode === 'edit';
  const [expandedLearningId, setExpandedLearningId] = useState<string | null>(null);
  const [editingMicroId, setEditingMicroId] = useState<string | null>(null);
  const [microDraft, setMicroDraft] = useState<{
    change: string;
    result: string;
    evaluation: string;
  } | null>(null);
  const [addingMicroForVer, setAddingMicroForVer] = useState<string | null>(null);
  const [newMicro, setNewMicro] = useState({
    detailBox: 'Box Manuell',
    subVersionId: '',
    change: '',
    result: '',
    evaluation: '',
  });

  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );
  const causeById = useMemo(
    () => new Map(dataset.causes.map((c) => [c.id, c])),
    [dataset.causes]
  );
  const stepById = useMemo(
    () => new Map(dataset.steps.map((s) => [s.id, s])),
    [dataset.steps]
  );

  // MODE A: Causal Arrow Inspector (when user clicks an SVG arrow in 2D-Swimlanes)
  const selectedArrow = useMemo(
    () => (arrowId ? dataset.arrows.find((a) => a.id === arrowId) ?? null : null),
    [dataset.arrows, arrowId]
  );

  if (selectedArrow && !rseId) {
    const style = EDGE_STYLES[selectedArrow.category];
    const fromStep = stepById.get(selectedArrow.from);
    const toStep = stepById.get(selectedArrow.to);
    const fromRseId = selectedArrow.fromRseId || fromStep?.rseIds[0] || '';
    const toRseId = selectedArrow.toRseId || toStep?.rseIds[0] || '';
    const arrowCauses = selectedArrow.causeIds
      .map((id) => causeById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    return (
      <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:w-[460px] shrink-0">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-slate-600" />
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {selectedArrow.id}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.badgeClass}`}>
                {style.shortLabel}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {selectedArrow.arrowType}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isEdit && (
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'upsert-arrow', existing: selectedArrow })}
                title="Pfeil bearbeiten / löschen"
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          <section className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Verbundene Knoten
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!fromRseId}
                onClick={() => fromRseId && onSelectRse(fromRseId)}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-left hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-800"
              >
                <div>
                  <div className="text-[10px] text-slate-400">Quelle ({selectedArrow.from})</div>
                  <div className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {fromRseId || '—'} · {rseById.get(fromRseId)?.name || fromStep?.title || ''}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                disabled={!toRseId}
                onClick={() => toRseId && onSelectRse(toRseId)}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-left hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-800"
              >
                <div>
                  <div className="text-[10px] text-slate-400">Ziel ({selectedArrow.to})</div>
                  <div className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {toRseId || '—'} · {rseById.get(toRseId)?.name || toStep?.title || ''}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Begründung des Entwicklungsschritts
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-100">
              {selectedArrow.rationale || 'Keine Begründung hinterlegt.'}
            </p>
          </section>

          <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Verknüpfte Ursachen & Befunde ({arrowCauses.length})</span>
              </div>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => onOpenModal({ kind: 'upsert-cause' })}
                  className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900"
                >
                  <Plus className="h-3 w-3" /> Ursache
                </button>
              )}
            </div>
            <div className="mt-2.5 space-y-2.5">
              {arrowCauses.length === 0 ? (
                <p className="text-slate-500">Keine Ursache verknüpft.</p>
              ) : (
                arrowCauses.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/25"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-950 dark:text-amber-200">
                        {c.id} · {c.category}
                      </span>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => onOpenModal({ kind: 'upsert-cause', existing: c })}
                          className="rounded p-1 text-slate-500 hover:bg-white"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">{c.title}</div>
                    <p className="mt-1.5 rounded bg-white/80 p-1.5 text-[11px] dark:bg-slate-900/70">
                      <strong className="text-emerald-700">Fakt:</strong> {c.observation}
                    </p>
                    <p className="mt-1 rounded bg-white/80 p-1.5 text-[11px] dark:bg-slate-900/70">
                      <strong className="text-amber-700">Hypothese:</strong> {c.hypothesis}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    );
  }

  // MODE B: RSE Deep-Dive Inspector
  const rse = rseId ? rseById.get(rseId) ?? null : null;
  const rseEvents = useMemo(
    () =>
      rseId
        ? dataset.events
            .filter((e) => e.rseId === rseId)
            .sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex)
        : [],
    [dataset.events, rseId]
  );
  const kombis = useMemo(() => (rseId ? getKombisForRse(rseId, dataset) : []), [dataset, rseId]);
  const microIterations = useMemo(
    () => (rseId ? getMicroIterationsForRse(rseId, dataset) : []),
    [dataset, rseId]
  );
  const matrixRow = useMemo(
    () => (rseId ? dataset.matrix.find((m) => m.rseId === rseId) ?? null : null),
    [dataset.matrix, rseId]
  );
  const microByVersionNr = useMemo(() => {
    const map = new Map<number, typeof microIterations>();
    for (const m of microIterations) {
      const key = m.versionNr ?? 0;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [microIterations]);

  if (!rse) return null;

  const dashRow = dataset.dashboard.find((d) => d.spurId === rse.spur);
  const laneName = getLaneDisplayName(rse.spur, dashRow?.name);
  const timelineVersions = dataset.versions.filter((ver) => {
    const hasEvent = rseEvents.some((e) => e.versionNr === ver.sortOrder);
    const hasMicro = (microByVersionNr.get(ver.sortOrder)?.length ?? 0) > 0;
    const matStatus = matrixRow?.statusByVersionKey[ver.versionKey] ?? '';
    return hasEvent || hasMicro || Boolean(matStatus);
  });

  return (
    <aside
      aria-label={`RSE Deep-Dive: ${rse.rseId}`}
      className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:w-[540px] xl:w-[600px] shrink-0"
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-blue-600">
                {rse.rseId}
              </span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {laneName}
              </span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {rse.currentLifecycle}
              </span>
            </div>

            <h2 className="mt-2 text-base font-bold leading-snug text-slate-950 dark:text-white">
              {rse.name}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              <span>Herkunft: {rse.origin}</span>
              <span>·</span>
              <span>Erstversion: {rse.firstVersion}</span>
              {rse.removalVersion && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    Entfall: {rse.removalVersion}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEdit && (
              <button
                type="button"
                onClick={() => onOpenModal({ kind: 'edit-rse', rse })}
                title="RSE-Stammdaten bearbeiten / löschen"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>RSE</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Deep-Dive schließen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mini Version Status Strip (clickable to jump or add event in Edit Mode) */}
        <div
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, dataset.versions.length)}, minmax(0, 1fr))`,
          }}
          className="mt-3 grid gap-1"
        >
          {dataset.versions.map((ver, idx) => {
            const stCode = matrixRow?.statusByVersionKey[ver.versionKey] ?? '';
            const sw = getSwatchForStatus(stCode, colorMode, palette, rse.currentLifecycle);
            const isCurrent = ver.versionKey === selectedVersion.versionKey;
            const existingEv = rseEvents.find((e) => e.versionNr === ver.sortOrder);
            return (
              <button
                key={ver.versionKey}
                type="button"
                onClick={() => {
                  onSelectVersionIndex(idx);
                  if (isEdit && !stCode) {
                    onOpenModal({
                      kind: 'upsert-event',
                      rseId: rse.rseId,
                      versionKey: ver.versionKey,
                      existing: existingEv,
                    });
                  }
                }}
                style={
                  stCode
                    ? {
                        backgroundColor: sw.bg,
                        borderColor: sw.border,
                        color: sw.text,
                        borderStyle: sw.dashed ? 'dashed' : 'solid',
                      }
                    : undefined
                }
                className={`flex flex-col items-center rounded border py-1 text-center transition-all ${
                  !stCode
                    ? 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
                    : ''
                } ${isCurrent ? 'ring-2 ring-slate-900 dark:ring-white' : 'hover:brightness-95'}`}
              >
                <span className="font-mono text-[10px] font-semibold">{ver.versionKey}</span>
                <span className="font-mono text-[9px] font-bold">
                  {stCode || (isEdit ? '+' : '—')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Function Summary + RSE-level Photo */}
        <section className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              Funktionsbeschreibung & Historie im Überblick
            </div>
            <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
              {rse.functionSummary || 'Keine Funktionsbeschreibung hinterlegt.'}
            </p>
            {rse.predecessorOrReplacement && (
              <div className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] font-medium text-amber-900 dark:border-slate-800 dark:text-amber-300">
                Vorgänger / Ersatz: {rse.predecessorOrReplacement}
              </div>
            )}
          </div>

          <MediaDropzone
            refKey={`rse:${rse.rseId}`}
            mediaRefLabel={`media/${rse.rseId.replace('.', '_')}_Uebersicht.png`}
            title={`${rse.rseId} – ${rse.name}`}
            attachment={mediaMap[`rse:${rse.rseId}`]}
            appMode={appMode}
            compact
            onUploadFile={onUploadMedia}
            onUpdateCaption={onUpdateMediaCaption}
            onDelete={onDeleteMedia}
            onOpenLightbox={onOpenLightbox}
          />
        </section>

        {/* Edit Mode Quick Creation Bar */}
        {isEdit && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-[11px] dark:border-amber-900/60 dark:bg-amber-950/30">
            <span className="mr-1 font-bold text-amber-950 dark:text-amber-200">Hinzufügen:</span>
            <button
              type="button"
              onClick={() =>
                onOpenModal({
                  kind: 'upsert-event',
                  rseId: rse.rseId,
                  versionKey: selectedVersion.versionKey,
                })
              }
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-3 w-3 text-blue-600" /> Event
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenModal({
                  kind: 'upsert-arrow',
                  defaultFromRse: rse.rseId,
                  defaultFromVer: selectedVersion.versionKey,
                })
              }
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-3 w-3 text-violet-600" /> Wirkpfeil
            </button>
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'upsert-cause' })}
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-3 w-3 text-amber-600" /> Ursache
            </button>
            <button
              type="button"
              onClick={() => onOpenModal({ kind: 'upsert-learning' })}
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-3 w-3 text-indigo-600" /> Learning
            </button>
            <button
              type="button"
              onClick={() => setAddingMicroForVer(selectedVersion.versionKey)}
              className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-3 w-3 text-teal-600" /> Mikro-It.
            </button>
          </div>
        )}

        {/* Inline Add Micro-Iteration Form */}
        {isEdit && addingMicroForVer && (
          <div className="space-y-2 rounded-xl border border-blue-300 bg-blue-50/50 p-3 text-xs dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
              <span>Neue Mikro-Iteration für {rse.rseId} ({addingMicroForVer})</span>
              <button type="button" onClick={() => setAddingMicroForVer(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Detail_Box (z. B. Box A1)"
                value={newMicro.detailBox}
                onChange={(e) => setNewMicro({ ...newMicro, detailBox: e.target.value })}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <input
                type="text"
                placeholder="Sub_Version_ID (z. B. v2.2_M1)"
                value={newMicro.subVersionId}
                onChange={(e) => setNewMicro({ ...newMicro, subVersionId: e.target.value })}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Konstruktive / Fertigungstechnische Änderung *"
              value={newMicro.change}
              onChange={(e) => setNewMicro({ ...newMicro, change: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <textarea
              rows={2}
              placeholder="Beobachtetes Ergebnis"
              value={newMicro.result}
              onChange={(e) => setNewMicro({ ...newMicro, result: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Bewertung (z. B. Übernommen)"
                value={newMicro.evaluation}
                onChange={(e) => setNewMicro({ ...newMicro, evaluation: e.target.value })}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newMicro.change.trim()) return;
                  onAddMicroIteration({
                    rseId: rse.rseId,
                    versionKey: addingMicroForVer,
                    ...newMicro,
                  });
                  setAddingMicroForVer(null);
                  setNewMicro({
                    detailBox: 'Box Manuell',
                    subVersionId: '',
                    change: '',
                    result: '',
                    evaluation: '',
                  });
                }}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700"
              >
                <Check className="h-3 w-3" /> Hinzufügen
              </button>
            </div>
          </div>
        )}

        {/* KOMBI-xx Integrations */}
        {kombis.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
              <Link2 className="h-4 w-4" />
              <span>Funktionsintegrationen ({kombis.length})</span>
            </div>

            {kombis.map((kombi) => {
              const refKey = kombi.mediaRef || `kombi:${kombi.kombiId}`;
              return (
                <div
                  key={kombi.kombiId}
                  style={{
                    backgroundColor: palette.KOMBI.bg,
                    borderColor: palette.KOMBI.border,
                    color: palette.KOMBI.text,
                  }}
                  className="rounded-xl border-2 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-teal-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                        {kombi.kombiId}
                      </span>
                      <span className="font-semibold">{kombi.variationType}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                        ab {kombi.integratedFromPhase}
                      </span>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => onOpenModal({ kind: 'upsert-kombi', existing: kombi })}
                          className="rounded bg-white/80 p-1 text-slate-800 hover:bg-white"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[13px] font-bold leading-snug">{kombi.partName}</div>
                  <p className="mt-1 leading-relaxed opacity-90">{kombi.rationale}</p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {kombi.involvedRseIds.map((otherId) => {
                      const otherRse = rseById.get(otherId);
                      const isSelf = otherId === rse.rseId;
                      return (
                        <button
                          key={otherId}
                          type="button"
                          onClick={() => !isSelf && onSelectRse(otherId)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                            isSelf
                              ? 'border-teal-800 bg-teal-800 font-bold text-white cursor-default'
                              : 'border-teal-700/40 bg-white/85 font-medium text-teal-950 hover:bg-white'
                          }`}
                        >
                          <span className="font-mono font-bold">{otherId}</span>
                          {otherRse && <span className="max-w-[140px] truncate">{otherRse.name}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <MediaDropzone
                      refKey={refKey}
                      mediaRefLabel={kombi.mediaRef}
                      title={`${kombi.kombiId}: ${kombi.partName}`}
                      attachment={mediaMap[refKey] ?? mediaMap[`kombi:${kombi.kombiId}`]}
                      appMode={appMode}
                      compact
                      onUploadFile={onUploadMedia}
                      onUpdateCaption={onUpdateMediaCaption}
                      onDelete={onDeleteMedia}
                      onOpenLightbox={onOpenLightbox}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Chronological Version Events + Embedded Micro-Iterations Sub-Timeline */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <GitCommitHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>
              Chronologische Versions-Historie ({rseEvents.length} Events ·{' '}
              {microIterations.length} Mikro-Iterationen)
            </span>
          </h3>

          <div className="relative space-y-4 pl-4 before:absolute before:bottom-2 before:left-[6px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
            {timelineVersions.map((ver) => {
              const ev = rseEvents.find((e) => e.versionNr === ver.sortOrder) ?? null;
              const matStatus = matrixRow?.statusByVersionKey[ver.versionKey] ?? '';
              const effectiveStatus = (ev?.statusCode ?? matStatus) as StatusCode | '';
              const swatch = getSwatchForStatus(
                effectiveStatus,
                colorMode,
                palette,
                rse.currentLifecycle
              );
              const isCurrentVer = ver.versionKey === selectedVersion.versionKey;
              const verMicros = microByVersionNr.get(ver.sortOrder) ?? [];
              const linkedCauses = ev ? getCausesForEvent(ev, dataset) : [];
              const linkedLearnings = ev ? getLearningsForEvent(ev, dataset) : [];

              return (
                <div key={ver.versionKey} className="relative">
                  <span
                    style={{ backgroundColor: swatch.border }}
                    className={`absolute -left-[15px] top-3 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      isCurrentVer ? 'ring-2 ring-slate-900 dark:ring-white' : ''
                    }`}
                  />

                  <div
                    className={`rounded-xl border transition-all ${
                      isCurrentVer
                        ? 'border-slate-900 shadow-sm dark:border-blue-400'
                        : 'border-slate-200 dark:border-slate-800'
                    } bg-white dark:bg-slate-900/90`}
                  >
                    {/* Version Header Bar */}
                    <div
                      style={{
                        backgroundColor: swatch.bg,
                        color: swatch.text,
                        borderBottomColor: swatch.border,
                      }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-t-[10px] border-b px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold">{ver.phaseName}</span>
                        {isEdit && effectiveStatus ? (
                          <select
                            value={effectiveStatus}
                            onChange={(e) =>
                              onQuickStatusChange(
                                rse.rseId,
                                ver.versionKey,
                                e.target.value as StatusCode
                              )
                            }
                            className="rounded border border-black/20 bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-900"
                          >
                            {ALL_STATUS_CODES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          effectiveStatus && (
                            <span
                              style={{ borderColor: swatch.border }}
                              className="rounded border bg-white/85 px-1.5 py-0.5 font-mono text-[10px] font-bold"
                            >
                              {effectiveStatus}
                            </span>
                          )
                        )}
                        {ev && <span className="font-mono text-[10px] opacity-80">{ev.eventId}</span>}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ev && (
                          <span className="text-[10px] font-semibold opacity-85">
                            {ev.variationType}
                          </span>
                        )}
                        {isEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenModal({
                                kind: 'upsert-event',
                                rseId: rse.rseId,
                                versionKey: ver.versionKey,
                                existing: ev ?? undefined,
                              })
                            }
                            title={ev ? 'Event bearbeiten / löschen' : 'Event anlegen'}
                            className="rounded bg-white/80 p-1 text-slate-800 hover:bg-white"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 p-3 text-xs">
                      {!ev ? (
                        <p className="italic text-slate-500 dark:text-slate-400">
                          Unverändert übernommen (Carry over / CV) aus vorheriger Version.
                        </p>
                      ) : (
                        <>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Zustand
                            </div>
                            <p className="mt-0.5 leading-relaxed text-slate-900 dark:text-slate-100">
                              {ev.stateDescription || '—'}
                            </p>
                          </div>

                          {ev.rationale && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Begründung
                              </div>
                              <p className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">
                                {ev.rationale}
                              </p>
                            </div>
                          )}

                          {/* Linked Ursachen */}
                          {(linkedCauses.length > 0 || isEdit) && (
                            <div className="space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                  <FlaskConical className="h-3.5 w-3.5" />
                                  <span>Ursachen & Befunde ({linkedCauses.length})</span>
                                </div>
                                {isEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenModal({
                                        kind: 'upsert-cause',
                                        attachToEventId: ev.eventId,
                                      })
                                    }
                                    className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                                  >
                                    <Plus className="h-2.5 w-2.5" /> Ursache
                                  </button>
                                )}
                              </div>
                              {linkedCauses.map((cause) => (
                                <div
                                  key={cause.id}
                                  className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/25"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-amber-950 dark:text-amber-200">
                                      {cause.id}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                        {cause.category}
                                      </span>
                                      {isEdit && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onOpenModal({ kind: 'upsert-cause', existing: cause })
                                          }
                                          className="rounded p-0.5 text-slate-500 hover:bg-white"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                                    {cause.title}
                                  </div>
                                  <div className="mt-1.5 grid gap-1.5 text-[11px]">
                                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/70">
                                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                        Fakt (Beobachtung):{' '}
                                      </span>
                                      <span className="text-slate-800 dark:text-slate-200">
                                        {cause.observation || '—'}
                                      </span>
                                    </div>
                                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/70">
                                      <span className="font-bold text-amber-700 dark:text-amber-400">
                                        Hypothese / Grenze:{' '}
                                      </span>
                                      <span className="text-slate-700 dark:text-slate-300">
                                        {cause.hypothesis || '—'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Steps & Learnings */}
                          {(ev.stepIds.length > 0 || linkedLearnings.length > 0) && (
                            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                              {ev.stepIds.map((sId) => (
                                <span
                                  key={sId}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <Layers className="h-2.5 w-2.5" />
                                  {sId}
                                </span>
                              ))}

                              {linkedLearnings.map((l) => {
                                const isOpen = expandedLearningId === `${ev.eventId}:${l.id}`;
                                return (
                                  <button
                                    key={l.id}
                                    type="button"
                                    onClick={() =>
                                      setExpandedLearningId(
                                        isOpen ? null : `${ev.eventId}:${l.id}`
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                                      isOpen
                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                        : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200'
                                    }`}
                                  >
                                    <Lightbulb className="h-2.5 w-2.5" />
                                    <span>{l.id}</span>
                                    <span className="max-w-[140px] truncate font-sans font-medium">
                                      {l.title}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {linkedLearnings.map((l) => {
                            if (expandedLearningId !== `${ev.eventId}:${l.id}`) return null;
                            return (
                              <div
                                key={l.id}
                                className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 text-[11px] dark:border-indigo-800 dark:bg-indigo-950/40"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-indigo-900 dark:text-indigo-200">
                                    {l.id} · {l.title} ({l.topic})
                                  </span>
                                  {isEdit && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenModal({ kind: 'upsert-learning', existing: l })
                                      }
                                      className="rounded p-0.5 text-slate-500 hover:bg-white"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
                                  <strong>Prinzip:</strong> {l.principle}
                                </p>
                                {l.scientificContext && (
                                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                                    <strong>DRM / Paper:</strong> {l.scientificContext}
                                  </p>
                                )}
                              </div>
                            );
                          })}

                          {/* Event Photo Dropzone (hidden when empty in Presentation Mode) */}
                          <MediaDropzone
                            refKey={ev.mediaRef || `event:${ev.eventId}`}
                            mediaRefLabel={ev.mediaRef}
                            title={`${rse.rseId} (${ver.versionKey}) – ${ev.eventId}`}
                            attachment={
                              (ev.mediaRef ? mediaMap[ev.mediaRef] : undefined) ??
                              mediaMap[`event:${ev.eventId}`]
                            }
                            appMode={appMode}
                            compact
                            onUploadFile={onUploadMedia}
                            onUpdateCaption={onUpdateMediaCaption}
                            onDelete={onDeleteMedia}
                            onOpenLightbox={onOpenLightbox}
                          />
                        </>
                      )}

                      {/* Nested Vertical Sub-Timeline of Micro-Iterations */}
                      {(verMicros.length > 0 || isEdit) && (
                        <div className="mt-2 rounded-lg border border-blue-200/80 bg-blue-50/35 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>
                                Mikro-Iterationen in {ver.versionKey} ({verMicros.length})
                              </span>
                            </div>
                            {isEdit && (
                              <button
                                type="button"
                                onClick={() => setAddingMicroForVer(ver.versionKey)}
                                className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900 hover:bg-blue-200"
                              >
                                <Plus className="h-2.5 w-2.5" /> Hinzufügen
                              </button>
                            )}
                          </div>

                          {verMicros.length > 0 && (
                            <ol className="relative mt-2 space-y-2.5 pl-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-[2px] before:bg-blue-200 dark:before:bg-blue-800/80">
                              {verMicros.map((m) => {
                                const isEditingMicro = editingMicroId === m.id;
                                const mRefKey = m.mediaRef || `micro:${m.id}`;
                                return (
                                  <li
                                    key={m.id}
                                    className="relative rounded-lg border border-slate-200/90 bg-white p-2.5 dark:border-slate-700/80 dark:bg-slate-900"
                                  >
                                    <span className="absolute -left-[15px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 dark:border-slate-900" />
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                                          {m.subVersionId || m.id}
                                        </span>
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                          {m.detailBox}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {m.evaluation && (
                                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                            {m.evaluation}
                                          </span>
                                        )}
                                        {isEdit && !isEditingMicro && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingMicroId(m.id);
                                                setMicroDraft({
                                                  change: m.change,
                                                  result: m.result,
                                                  evaluation: m.evaluation,
                                                });
                                              }}
                                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                                            >
                                              <Edit3 className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (
                                                  window.confirm(
                                                    `Mikro-Iteration "${m.subVersionId}" wirklich löschen?`
                                                  )
                                                ) {
                                                  onDeleteMicroIteration(m.id);
                                                }
                                              }}
                                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {isEditingMicro && microDraft ? (
                                      <div className="mt-2 space-y-1.5">
                                        <textarea
                                          rows={2}
                                          value={microDraft.change}
                                          onChange={(e) =>
                                            setMicroDraft({ ...microDraft, change: e.target.value })
                                          }
                                          className="w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                        />
                                        <textarea
                                          rows={2}
                                          value={microDraft.result}
                                          onChange={(e) =>
                                            setMicroDraft({ ...microDraft, result: e.target.value })
                                          }
                                          className="w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                        />
                                        <div className="flex items-center justify-between gap-2">
                                          <input
                                            type="text"
                                            value={microDraft.evaluation}
                                            onChange={(e) =>
                                              setMicroDraft({
                                                ...microDraft,
                                                evaluation: e.target.value,
                                              })
                                            }
                                            className="flex-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingMicroId(null);
                                              setMicroDraft(null);
                                            }}
                                            className="rounded border border-slate-300 px-2 py-0.5 text-[10px]"
                                          >
                                            Abbrechen
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onEditMicroIteration(m.id, microDraft);
                                              setEditingMicroId(null);
                                              setMicroDraft(null);
                                            }}
                                            className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                                          >
                                            Speichern
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-1 space-y-0.5 text-[11px]">
                                        <p className="text-slate-800 dark:text-slate-200">
                                          <strong className="text-slate-500">Änderung: </strong>
                                          {m.change || '—'}
                                        </p>
                                        <p className="text-slate-700 dark:text-slate-300">
                                          <strong className="text-slate-500">Ergebnis: </strong>
                                          {m.result || '—'}
                                        </p>
                                      </div>
                                    )}

                                    <div className="mt-2">
                                      <MediaDropzone
                                        refKey={mRefKey}
                                        mediaRefLabel={m.mediaRef}
                                        title={`${m.subVersionId} (${m.detailBox})`}
                                        attachment={
                                          (m.mediaRef ? mediaMap[m.mediaRef] : undefined) ??
                                          mediaMap[`micro:${m.id}`]
                                        }
                                        appMode={appMode}
                                        compact
                                        onUploadFile={onUploadMedia}
                                        onUpdateCaption={onUpdateMediaCaption}
                                        onDelete={onDeleteMedia}
                                        onOpenLightbox={onOpenLightbox}
                                      />
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
};
