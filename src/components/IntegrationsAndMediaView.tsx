import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Edit3,
  Link2,
  RefreshCw,
} from 'lucide-react';
import {
  AppMode,
  CustomPalette,
  MediaAttachment,
  MicroIterationEditPatch,
  SgeDataset,
} from '../types/sge';
import { ModalState } from './EntityEditModals';
import { LightboxPayload } from './LightboxModal';
import { MediaDropzone } from './MediaDropzone';

interface IntegrationsAndMediaViewProps {
  dataset: SgeDataset;
  appMode: AppMode;
  palette: CustomPalette;
  mediaMap: Record<string, MediaAttachment>;
  onSelectRse: (rseId: string) => void;
  onEditMicroIteration: (microId: string, patch: MicroIterationEditPatch) => void;
  onOpenModal: (modal: ModalState) => void;
  onUploadMedia: (refKey: string, file: File) => void;
  onUpdateMediaCaption: (refKey: string, caption: string) => void;
  onDeleteMedia: (refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
}

type MediaSlotFilter = 'placeholders' | 'kombi' | 'events' | 'all_micro' | 'uploaded';

export const IntegrationsAndMediaView: React.FC<IntegrationsAndMediaViewProps> = ({
  dataset,
  appMode,
  palette,
  mediaMap,
  onSelectRse,
  onEditMicroIteration,
  onOpenModal,
  onUploadMedia,
  onUpdateMediaCaption,
  onDeleteMedia,
  onOpenLightbox,
}) => {
  const isEdit = appMode === 'edit';
  const [slotFilter, setSlotFilter] = useState<MediaSlotFilter>('placeholders');
  const [boxFilter, setBoxFilter] = useState<string>('ALL');
  const [editingMicroId, setEditingMicroId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ change: string; result: string; evaluation: string } | null>(
    null
  );

  const rseById = useMemo(
    () => new Map(dataset.rseList.map((r) => [r.rseId, r])),
    [dataset.rseList]
  );

  const placeholderMicros = useMemo(
    () =>
      dataset.microIterations.filter(
        (m) =>
          m.detailBox.toUpperCase().startsWith('BOX PH_') ||
          /^(RH|MH|BV|BH)_\d+/i.test(m.subVersionId)
      ),
    [dataset.microIterations]
  );

  const placeholderBoxes = useMemo(
    () => Array.from(new Set(placeholderMicros.map((m) => m.detailBox))),
    [placeholderMicros]
  );

  const eventsWithMediaRef = useMemo(
    () => dataset.events.filter((e) => Boolean(e.mediaRef)),
    [dataset.events]
  );

  const uploadedTotalCount = Object.keys(mediaMap).length;
  const placeholderFilledCount = placeholderMicros.filter((m) => {
    const k = m.mediaRef || `micro:${m.id}`;
    return Boolean(mediaMap[k] || mediaMap[`micro:${m.id}`]);
  }).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
      {/* Section 1: Bauteil_Integrationen (KOMBI-01 .. KOMBI-06) */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Link2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Bauteil-Integrationen (KOMBI-01 bis KOMBI-06)</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Spurübergreifende Funktionsintegrationen – Klick auf ein RSE öffnet direkt dessen
              vollständigen Deep-Dive.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {dataset.kombis.map((kombi) => {
            const refKey = kombi.mediaRef || `kombi:${kombi.kombiId}`;
            return (
              <div
                key={kombi.kombiId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      style={{
                        backgroundColor: palette.KOMBI.bg,
                        borderColor: palette.KOMBI.border,
                        color: palette.KOMBI.text,
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-bold"
                    >
                      <Link2 className="h-3 w-3" />
                      {kombi.kombiId}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      ab {kombi.integratedFromPhase}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                    {kombi.partName}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                    <span>{kombi.variationType}</span>
                    <span>·</span>
                    <span>{kombi.involvedLanes}</span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {kombi.rationale}
                  </p>

                  {/* Clickable Merged RSE Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {kombi.involvedRseIds.map((rseId) => {
                      const r = rseById.get(rseId);
                      return (
                        <button
                          key={rseId}
                          type="button"
                          onClick={() => onSelectRse(rseId)}
                          className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/80 px-2 py-0.5 text-[11px] font-medium text-teal-900 transition-colors hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                        >
                          <span className="font-mono font-bold">{rseId}</span>
                          {r && <span className="max-w-[130px] truncate">{r.name}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <MediaDropzone
                    refKey={refKey}
                    mediaRefLabel={kombi.mediaRef}
                    title={`${kombi.kombiId}: ${kombi.partName}`}
                    attachment={mediaMap[refKey] ?? mediaMap[`kombi:${kombi.kombiId}`]}
                    appMode={appMode}
                    onUploadFile={onUploadMedia}
                    onUpdateCaption={onUpdateMediaCaption}
                    onDelete={onDeleteMedia}
                    onOpenLightbox={onOpenLightbox}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Foto-Verwaltung & 20 Platzhalter-Hub */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Foto-Verwaltung & Platzhalter-Hub (IndexedDB)</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Platzhalter belegt: <strong className="font-mono">{placeholderFilledCount} / {placeholderMicros.length}</strong> ·
              Gesamte lokale Fotos: <strong className="font-mono">{uploadedTotalCount}</strong> (per Export als ZIP in{' '}
              <code className="font-mono text-[11px]">public/media/</code> sicherbar)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'placeholders', label: `20 Foto-Platzhalter (${placeholderMicros.length})` },
                { id: 'events', label: `Event-Medien (${eventsWithMediaRef.length})` },
                { id: 'all_micro', label: `Alle Mikro-It. (${dataset.microIterations.length})` },
                { id: 'uploaded', label: `Hochgeladen (${uploadedTotalCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSlotFilter(tab.id)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  slotFilter === tab.id
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-blue-500 dark:bg-blue-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-filter for the 4 Placeholder Boxes (PH_RH, PH_MH, PH_BV, PH_BH) */}
        {slotFilter === 'placeholders' && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBoxFilter('ALL')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                boxFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Alle 4 Boxen ({placeholderMicros.length})
            </button>
            {placeholderBoxes.map((box) => (
              <button
                key={box}
                type="button"
                onClick={() => setBoxFilter(box)}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ${
                  boxFilter === box
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {box}
              </button>
            ))}
          </div>
        )}

        {/* Slot Grid */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(slotFilter === 'placeholders' || slotFilter === 'all_micro') &&
            (slotFilter === 'placeholders'
              ? placeholderMicros.filter((m) => boxFilter === 'ALL' || m.detailBox === boxFilter)
              : dataset.microIterations
            ).map((m) => {
              const refKey = m.mediaRef || `micro:${m.id}`;
              const isEditing = editingMicroId === m.id;
              return (
                <div
                  key={m.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {m.subVersionId}
                        </span>
                        <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {m.detailBox}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectRse(m.rseId)}
                          className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                        >
                          {m.rseId}
                        </button>
                        {isEdit && !isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMicroId(m.id);
                              setDraft({
                                change: m.change,
                                result: m.result,
                                evaluation: m.evaluation,
                              });
                            }}
                            title="Platzhaltertext bearbeiten"
                            className="rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-800 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && draft ? (
                      <div className="mt-2 space-y-1.5 text-[11px]">
                        <textarea
                          rows={2}
                          value={draft.change}
                          onChange={(e) => setDraft({ ...draft, change: e.target.value })}
                          placeholder="Änderung / Beschreibung..."
                          className="w-full rounded border border-slate-300 bg-white p-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <textarea
                          rows={2}
                          value={draft.result}
                          onChange={(e) => setDraft({ ...draft, result: e.target.value })}
                          placeholder="Beobachtetes Ergebnis..."
                          className="w-full rounded border border-slate-300 bg-white p-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMicroId(null);
                              setDraft(null);
                            }}
                            className="rounded border border-slate-300 px-2 py-0.5 text-[10px]"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onEditMicroIteration(m.id, draft);
                              setEditingMicroId(null);
                              setDraft(null);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                          >
                            <Check className="h-3 w-3" />
                            Speichern
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300 line-clamp-2">
                        {m.change}
                      </p>
                    )}
                  </div>

                  <div className="mt-2.5">
                    <MediaDropzone
                      refKey={refKey}
                      mediaRefLabel={m.mediaRef}
                      title={`${m.subVersionId} – ${m.rseId} (${m.detailBox})`}
                      attachment={mediaMap[refKey] ?? mediaMap[`micro:${m.id}`]}
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

          {slotFilter === 'events' &&
            eventsWithMediaRef.map((ev) => {
              const refKey = ev.mediaRef || `event:${ev.eventId}`;
              return (
                <div
                  key={ev.eventId}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {ev.eventId} · {ev.version.split(' ')[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectRse(ev.rseId)}
                        className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      >
                        {ev.rseId}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300 line-clamp-2">
                      {ev.stateDescription}
                    </p>
                  </div>
                  <div className="mt-2.5">
                    <MediaDropzone
                      refKey={refKey}
                      mediaRefLabel={ev.mediaRef}
                      title={`${ev.eventId} (${ev.rseId} · ${ev.version})`}
                      attachment={mediaMap[refKey] ?? mediaMap[`event:${ev.eventId}`]}
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

          {slotFilter === 'uploaded' &&
            (uploadedTotalCount === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500 dark:border-slate-700">
                <RefreshCw className="h-6 w-6 opacity-40" />
                <p className="mt-2 font-medium">Noch keine lokalen Fotos hochgeladen.</p>
                <p className="mt-0.5 text-[11px]">
                  Ziehen Sie PNG/JPG/WebP-Dateien auf beliebige Platzhalter-, Event- oder
                  KOMBI-Dropzones.
                </p>
              </div>
            ) : (
              Object.values(mediaMap).map((att) => (
                <div
                  key={att.refKey}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="mb-2 truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {att.refKey}
                  </div>
                  <MediaDropzone
                    refKey={att.refKey}
                    mediaRefLabel={att.refKey}
                    title={att.caption || att.fileName}
                    attachment={att}
                    appMode={appMode}
                    compact
                    onUploadFile={onUploadMedia}
                    onUpdateCaption={onUpdateMediaCaption}
                    onDelete={onDeleteMedia}
                    onOpenLightbox={onOpenLightbox}
                  />
                </div>
              ))
            ))}
        </div>
      </section>
    </div>
  );
};
