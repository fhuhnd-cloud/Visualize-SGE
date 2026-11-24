import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  FlaskConical,
  GitCommitHorizontal,
  Layers,
  Lightbulb,
  Link2,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  ColorMode,
  CustomPalette,
  EventEditPatch,
  MediaAttachment,
  MicroIterationEditPatch,
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
  getLaneDisplayName,
  getSwatchForStatus,
} from '../utils/sgeVisualConfig';
import { LightboxPayload } from './LightboxModal';
import { MediaDropzone } from './MediaDropzone';

interface RseDeepDiveDrawerProps {
  rseId: string;
  dataset: SgeDataset;
  selectedVersion: PhaseVersionConfig;
  colorMode: ColorMode;
  palette: CustomPalette;
  mediaMap: Record<string, MediaAttachment>;
  onClose: () => void;
  onSelectRse: (rseId: string) => void;
  onSelectVersionIndex: (index: number) => void;
  onEditEvent: (eventId: string, patch: EventEditPatch) => void;
  onEditMicroIteration: (microId: string, patch: MicroIterationEditPatch) => void;
  onUploadMedia: (refKey: string, file: File) => void;
  onUpdateMediaCaption: (refKey: string, caption: string) => void;
  onDeleteMedia: (refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
}

export const RseDeepDiveDrawer: React.FC<RseDeepDiveDrawerProps> = ({
  rseId,
  dataset,
  selectedVersion,
  colorMode,
  palette,
  mediaMap,
  onClose,
  onSelectRse,
  onSelectVersionIndex,
  onEditEvent,
  onEditMicroIteration,
  onUploadMedia,
  onUpdateMediaCaption,
  onDeleteMedia,
  onOpenLightbox,
}) => {
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evDraft, setEvDraft] = useState<{
    statusCode: StatusCode;
    stateDescription: string;
    rationale: string;
  } | null>(null);

  const [editingMicroId, setEditingMicroId] = useState<string | null>(null);
  const [microDraft, setMicroDraft] = useState<{
    change: string;
    result: string;
    evaluation: string;
  } | null>(null);

  const [expandedLearningId, setExpandedLearningId] = useState<string | null>(null);

  const rse = useMemo(
    () => dataset.rseList.find((r) => r.rseId === rseId) ?? null,
    [dataset.rseList, rseId]
  );

  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );

  const rseEvents = useMemo(
    () =>
      dataset.events
        .filter((e) => e.rseId === rseId)
        .sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex),
    [dataset.events, rseId]
  );

  const kombis = useMemo(() => getKombisForRse(rseId, dataset), [dataset, rseId]);
  const microIterations = useMemo(
    () => getMicroIterationsForRse(rseId, dataset),
    [dataset, rseId]
  );

  const matrixRow = useMemo(
    () => dataset.matrix.find((m) => m.rseId === rseId) ?? null,
    [dataset.matrix, rseId]
  );

  // Group micro-iterations by versionNr so each renders directly under its corresponding version!
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

  const laneName = getLaneDisplayName(rse.spur);

  // Build chronological timeline slots covering every version where the RSE has an event,
  // a micro-iteration, or an active matrix status
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

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
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

          <button
            type="button"
            onClick={onClose}
            aria-label="Deep-Dive schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mini 7-Version Status Strip */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {dataset.versions.map((ver, idx) => {
            const stCode = matrixRow?.statusByVersionKey[ver.versionKey] ?? '';
            const sw = getSwatchForStatus(stCode, colorMode, palette, rse.currentLifecycle);
            const isCurrent = ver.versionKey === selectedVersion.versionKey;
            return (
              <button
                key={ver.versionKey}
                type="button"
                onClick={() => onSelectVersionIndex(idx)}
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
                <span className="font-mono text-[9px] font-bold">{stCode || '—'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Deep-Dive Content */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Funktionsbeschreibung & Vorgänger/Ersatz */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50">
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
        </section>

        {/* KOMBI-xx Funktionsintegrationen (Cross-Lane Merged RSEs) */}
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
                    <span className="rounded bg-white/75 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                      ab {kombi.integratedFromPhase}
                    </span>
                  </div>

                  <div className="mt-1.5 text-[13px] font-bold leading-snug">
                    {kombi.partName}
                  </div>
                  <p className="mt-1 leading-relaxed opacity-90">{kombi.rationale}</p>

                  {/* Merged RSE chips across lane boundaries */}
                  <div className="mt-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                      Verschmolzene RSE über Spurgrenzen ({kombi.involvedLanes}):
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {kombi.involvedRseIds.map((otherId) => {
                        const otherRse = rseById.get(otherId);
                        const isSelf = otherId === rse.rseId;
                        return (
                          <button
                            key={otherId}
                            type="button"
                            onClick={() => !isSelf && onSelectRse(otherId)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                              isSelf
                                ? 'border-teal-800 bg-teal-800 font-bold text-white cursor-default'
                                : 'border-teal-700/40 bg-white/85 font-medium text-teal-950 hover:bg-white'
                            }`}
                          >
                            <span className="font-mono font-bold">{otherId}</span>
                            {otherRse && (
                              <span className="max-w-[140px] truncate">{otherRse.name}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* KOMBI Photo Dropzone */}
                  <div className="mt-3">
                    <MediaDropzone
                      refKey={refKey}
                      mediaRefLabel={kombi.mediaRef}
                      title={`${kombi.kombiId}: ${kombi.partName}`}
                      attachment={mediaMap[refKey] ?? mediaMap[`kombi:${kombi.kombiId}`]}
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

        {/* Chronologische Versions-Events + Eingebetteter Mikro-Iterationen Sub-Zeitstrahl */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <GitCommitHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>
                Chronologische Versions-Historie ({rseEvents.length} Events ·{' '}
                {microIterations.length} Mikro-Iterationen)
              </span>
            </h3>
          </div>

          <div className="relative space-y-4 pl-4 before:absolute before:bottom-2 before:left-[6px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
            {timelineVersions.map((ver) => {
              const ev = rseEvents.find((e) => e.versionNr === ver.sortOrder) ?? null;
              const matStatus = matrixRow?.statusByVersionKey[ver.versionKey] ?? '';
              const effectiveStatus = ev?.statusCode ?? matStatus;
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
              const isEditingThisEv = ev && editingEventId === ev.eventId;

              return (
                <div key={ver.versionKey} className="relative">
                  {/* Timeline node dot */}
                  <span
                    style={{
                      backgroundColor: swatch.border,
                    }}
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
                        {effectiveStatus && (
                          <span
                            style={{ borderColor: swatch.border }}
                            className="rounded border bg-white/85 px-1.5 py-0.5 font-mono text-[10px] font-bold"
                          >
                            {effectiveStatus}
                          </span>
                        )}
                        {ev && (
                          <span className="font-mono text-[10px] opacity-80">{ev.eventId}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ev && (
                          <span className="text-[10px] font-semibold opacity-85">
                            {ev.variationType}
                          </span>
                        )}
                        {ev && !isEditingThisEv && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEventId(ev.eventId);
                              setEvDraft({
                                statusCode: ev.statusCode,
                                stateDescription: ev.stateDescription,
                                rationale: ev.rationale,
                              });
                            }}
                            title="Event bearbeiten (lokal gespeichert)"
                            className="rounded bg-white/75 p-1 text-slate-700 hover:bg-white"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Event Body */}
                    <div className="space-y-3 p-3 text-xs">
                      {!ev ? (
                        <p className="italic text-slate-500 dark:text-slate-400">
                          Unverändert übernommen (Carry over / CV) aus vorheriger Version.
                        </p>
                      ) : isEditingThisEv && evDraft ? (
                        <div className="space-y-2.5 rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 dark:border-blue-800 dark:bg-blue-950/30">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                              Event {ev.eventId} bearbeiten
                            </span>
                            <select
                              value={evDraft.statusCode}
                              onChange={(e) =>
                                setEvDraft({
                                  ...evDraft,
                                  statusCode: e.target.value as StatusCode,
                                })
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {ALL_STATUS_CODES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">
                              Kurzbeschreibung Zustand
                            </label>
                            <textarea
                              rows={3}
                              value={evDraft.stateDescription}
                              onChange={(e) =>
                                setEvDraft({ ...evDraft, stateDescription: e.target.value })
                              }
                              className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">
                              Begründung
                            </label>
                            <textarea
                              rows={2}
                              value={evDraft.rationale}
                              onChange={(e) =>
                                setEvDraft({ ...evDraft, rationale: e.target.value })
                              }
                              className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEventId(null);
                                setEvDraft(null);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Abbrechen
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onEditEvent(ev.eventId, evDraft);
                                setEditingEventId(null);
                                setEvDraft(null);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                            >
                              <Check className="h-3 w-3" />
                              Speichern
                            </button>
                          </div>
                        </div>
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

                          {/* Linked Ursachen (Fakt vs. Hypothese) */}
                          {linkedCauses.length > 0 && (
                            <div className="space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                <FlaskConical className="h-3.5 w-3.5" />
                                <span>
                                  Verknüpfte Ursachen & Befunde ({linkedCauses.length})
                                </span>
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
                                    <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                      {cause.category}
                                    </span>
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

                          {/* Linked Steps & Methodik_Learnings (M01-M16) */}
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

                          {/* Expanded Learning Principle Card */}
                          {linkedLearnings.map((l) => {
                            if (expandedLearningId !== `${ev.eventId}:${l.id}`) return null;
                            return (
                              <div
                                key={l.id}
                                className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 text-[11px] dark:border-indigo-800 dark:bg-indigo-950/40"
                              >
                                <div className="font-bold text-indigo-900 dark:text-indigo-200">
                                  {l.id} · {l.title} ({l.topic})
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

                          {/* Event Foto-Dropzone */}
                          <div className="pt-1">
                            <MediaDropzone
                              refKey={ev.mediaRef || `event:${ev.eventId}`}
                              mediaRefLabel={ev.mediaRef}
                              title={`${rse.rseId} (${ver.versionKey}) – ${ev.eventId}`}
                              attachment={
                                (ev.mediaRef ? mediaMap[ev.mediaRef] : undefined) ??
                                mediaMap[`event:${ev.eventId}`]
                              }
                              compact
                              onUploadFile={onUploadMedia}
                              onUpdateCaption={onUpdateMediaCaption}
                              onDelete={onDeleteMedia}
                              onOpenLightbox={onOpenLightbox}
                            />
                          </div>
                        </>
                      )}

                      {/* Vertikaler Sub-Zeitstrahl der Mikro_Iterationen genau unter dieser Version */}
                      {verMicros.length > 0 && (
                        <div className="mt-3 rounded-lg border border-blue-200/80 bg-blue-50/35 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>
                              Mikro-Iterationen in {ver.versionKey} ({verMicros.length})
                            </span>
                          </div>

                          <ol className="relative mt-2.5 space-y-3 pl-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-[2px] before:bg-blue-200 dark:before:bg-blue-800/80">
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
                                      {m.isPlaceholder && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                          Foto-Platzhalter
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {m.evaluation && (
                                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                          {m.evaluation}
                                        </span>
                                      )}
                                      {!isEditingMicro && (
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
                                          title="Mikro-Iteration bearbeiten"
                                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isEditingMicro && microDraft ? (
                                    <div className="mt-2 space-y-2">
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500">
                                          Konstruktive / Fertigungstechnische Änderung
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={microDraft.change}
                                          onChange={(e) =>
                                            setMicroDraft({ ...microDraft, change: e.target.value })
                                          }
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500">
                                          Beobachtetes Ergebnis
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={microDraft.result}
                                          onChange={(e) =>
                                            setMicroDraft({ ...microDraft, result: e.target.value })
                                          }
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white p-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-slate-500">
                                          Bewertung
                                        </label>
                                        <input
                                          type="text"
                                          value={microDraft.evaluation}
                                          onChange={(e) =>
                                            setMicroDraft({
                                              ...microDraft,
                                              evaluation: e.target.value,
                                            })
                                          }
                                          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                                        />
                                      </div>
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMicroId(null);
                                            setMicroDraft(null);
                                          }}
                                          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600"
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
                                    <div className="mt-1.5 space-y-1 text-[11px]">
                                      <p className="leading-snug text-slate-800 dark:text-slate-200">
                                        <strong className="text-slate-500 dark:text-slate-400">
                                          Änderung:{' '}
                                        </strong>
                                        {m.change || '—'}
                                      </p>
                                      <p className="leading-snug text-slate-700 dark:text-slate-300">
                                        <strong className="text-slate-500 dark:text-slate-400">
                                          Ergebnis:{' '}
                                        </strong>
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
