import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { DataTablesView } from './components/DataTablesView';
import { EntityEditModals, ModalState } from './components/EntityEditModals';
import { Header } from './components/Header';
import { ImageCropModal } from './components/ImageCropModal';
import { IntegrationsAndMediaView } from './components/IntegrationsAndMediaView';
import { IntegrityBanner } from './components/IntegrityBanner';
import { LightboxModal, LightboxPayload } from './components/LightboxModal';
import { RseDeepDiveDrawer } from './components/RseDeepDiveDrawer';
import { RseMatrixView } from './components/RseMatrixView';
import { Swimlane2DGraphView } from './components/Swimlane2DGraphView';
import { SwimlaneBoard } from './components/SwimlaneBoard';
import { VersionTimelineBar } from './components/VersionTimelineBar';
import {
  AppMode,
  ColorMode,
  CustomPalette,
  DetailLevel,
  MediaAttachment,
  NomenclatureLang,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
  WorkspaceView,
} from './types/sge';
import {
  downloadEmptySgeTemplateXlsx,
<<<<<<< HEAD
  downloadSampleProjectXlsx,
=======
  downloadExampleProjectXlsx,
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
  downloadUpdatedXlsx,
  isPlaceholderMicroIteration,
  parseExcelBuffer,
  parseExcelFile,
  validateSgeDataset,
} from './utils/excelParser';
import {
  computeRseStatesAtVersion,
  computeVersionKpis,
} from './utils/sgeAnalytics';
import {
  addEventReference,
  addMicroIteration,
  addRse,
  deleteArrow,
  deleteCause,
  deleteEventReference,
  deleteKombi,
  deleteLearning,
  deleteMicroIteration,
  deleteRse,
  deleteRseEvent,
<<<<<<< HEAD
  updateEventReference,
=======
  reconcileDerivedFields,
  setNodeEventMediaRef,
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
  updateMicroIteration,
  updateRse,
  updateSpur,
  updateVersionConfig,
  upsertArrow,
  upsertCause,
  upsertKombi,
  upsertLearning,
  upsertRseEvent,
} from './utils/sgeMutations';
import {
  clearPersistedDatasetInIndexedDb,
  createEmptyEdits,
  deleteMediaFromIndexedDb,
  downloadProjectJsonBackup,
  downloadProjectZipPackage,
  loadAllMediaFromIndexedDb,
  loadPaletteFromLocalStorage,
  loadPersistedDatasetFromIndexedDb,
  parseProjectJsonBackup,
  readImageFileAsAttachment,
  saveMediaToIndexedDb,
  savePaletteToLocalStorage,
  savePersistedDatasetToIndexedDb,
} from './utils/storage';

const DEFAULT_XLSX_URL = '/Duckomat_Entwicklungsdatenbank_v14.xlsx';

export default function App() {
  const [dataset, setDataset] = useState<SgeDataset | null>(null);
  const [changeCount, setChangeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Classic clean 2D-Swimlane overview is the default spotlight view
  const [activeView, setActiveView] = useState<WorkspaceView>('swimlane2d');
  const [appMode, setAppMode] = useState<AppMode>('presentation');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(1);
  const [lang, setLang] = useState<NomenclatureLang>('en');

  const [darkMode, setDarkMode] = useState(false);
  const [integrityOpen, setIntegrityOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Version Slider, SGE Color Filters, Color Mode, Custom Palette, Search
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(6);
  const [activeColorFilters, setActiveColorFilters] = useState<StatusColorGroup[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>('variation');
  const [palette, setPalette] = useState<CustomPalette>(() => loadPaletteFromLocalStorage());
  const [searchQuery, setSearchQuery] = useState('');

  // Right Deep-Dive Drawer (RSE or Arrow), Edit Modal, Crop Modal, and Lightbox
  const [selectedRseId, setSelectedRseId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [lightboxItem, setLightboxItem] = useState<LightboxPayload | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{
    refKey: string;
    file: File;
    title?: string;
    nodeLink?: { rseId: string; versionKey: string };
  } | null>(null);

  // Locally persisted media (IndexedDB)
  const [mediaMap, setMediaMap] = useState<Record<string, MediaAttachment>>({});

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  const loadBundledDefault = useCallback(async (ignoreSaved = false) => {
    setLoading(true);
    setImportError(null);
    try {
      if (!ignoreSaved) {
        const persisted = await loadPersistedDatasetFromIndexedDb();
<<<<<<< HEAD
        // Verify schema has Model of SGE fields (generationId + references) before restoring
        const hasNewSchema =
          Boolean(persisted?.dataset?.versions?.[0]?.generationId) &&
          Array.isArray(persisted?.dataset?.events?.[0]?.references);
        if (persisted?.dataset && persisted.dataset.rseList.length > 0 && hasNewSchema) {
          setDataset(persisted.dataset);
=======
        if (persisted?.dataset && persisted.dataset.rseList.length > 0) {
          const hadPlaceholders = persisted.dataset.microIterations.some((m) =>
            isPlaceholderMicroIteration(m)
          );
          const sanitized = hadPlaceholders
            ? reconcileDerivedFields({
                ...persisted.dataset,
                microIterations: persisted.dataset.microIterations.filter(
                  (m) => !isPlaceholderMicroIteration(m)
                ),
              })
            : persisted.dataset;
          if (hadPlaceholders) {
            savePersistedDatasetToIndexedDb(sanitized, persisted.changeCount ?? 0);
          }
          setDataset(sanitized);
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
          setChangeCount(persisted.changeCount ?? 0);
          setSelectedVersionIndex(Math.max(0, sanitized.versions.length - 1));
          setLoading(false);
          return;
        }
      }

      const res = await fetch(DEFAULT_XLSX_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} beim Laden von ${DEFAULT_XLSX_URL}`);
      }
      const buffer = await res.arrayBuffer();
      const { dataset: parsed, report: nextReport } = parseExcelBuffer(
        buffer,
        'Duckomat_Entwicklungsdatenbank_v14.xlsx',
        true
      );
      setDataset(parsed);
      setChangeCount(0);
      setSelectedVersionIndex(Math.max(0, parsed.versions.length - 1));
      setIntegrityOpen(nextReport.errorCount > 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Ladefehler';
      setImportError(
        `Standard-Datenbank (${DEFAULT_XLSX_URL}) konnte nicht geladen werden: ${msg}. Ziehen Sie eine .xlsx-Datei ins Fenster.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllMediaFromIndexedDb().then((loaded) => setMediaMap(loaded));
    loadBundledDefault(false);
  }, [loadBundledDefault]);

  const mutateDataset = useCallback(
    (updater: (prev: SgeDataset) => SgeDataset, toastMsg?: string) => {
      setDataset((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        setChangeCount((c) => {
          const nextCount = c + 1;
          savePersistedDatasetToIndexedDb(next, nextCount);
          return nextCount;
        });
        return next;
      });
      if (toastMsg) showToast(toastMsg);
    },
    [showToast]
  );

  const report = useMemo(() => (dataset ? validateSgeDataset(dataset) : null), [dataset]);

  const selectedVersion = useMemo(() => {
    if (!dataset || dataset.versions.length === 0) return null;
    const clamped = Math.min(Math.max(0, selectedVersionIndex), dataset.versions.length - 1);
    return dataset.versions[clamped];
  }, [dataset, selectedVersionIndex]);

  const rseStates = useMemo(() => {
    if (!dataset || !selectedVersion) return new Map();
    return computeRseStatesAtVersion(dataset, selectedVersion);
  }, [dataset, selectedVersion]);

  const versionKpi = useMemo(() => {
    if (!dataset || !selectedVersion) return null;
    return computeVersionKpis(dataset, selectedVersion, rseStates);
  }, [dataset, selectedVersion, rseStates]);

  const rseIdSet = useMemo(
    () => new Set(dataset?.rseList.map((r) => r.rseId) ?? []),
    [dataset]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape' && !lightboxItem && !modal) {
        setSelectedRseId(null);
        setSelectedArrowId(null);
      } else if (
        e.key === 'ArrowRight' &&
        dataset &&
        (activeView === 'board' || activeView === 'matrix')
      ) {
        setSelectedVersionIndex((p) => Math.min(dataset.versions.length - 1, p + 1));
      } else if (
        e.key === 'ArrowLeft' &&
        dataset &&
        (activeView === 'board' || activeView === 'matrix')
      ) {
        setSelectedVersionIndex((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dataset, activeView, lightboxItem, modal]);

  const handleExcelFileSelected = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setImportError(`Ungültiges Dateiformat ("${file.name}"). Bitte eine .xlsx-Datei auswählen.`);
        return;
      }
      try {
        setImportError(null);
        const { dataset: parsed, report: nextReport } = await parseExcelFile(file);
        await clearPersistedDatasetInIndexedDb();
        setDataset(parsed);
        setChangeCount(0);
        setSelectedVersionIndex(Math.max(0, parsed.versions.length - 1));
        setSelectedRseId(null);
        setSelectedArrowId(null);
        setActiveColorFilters([]);
        setSearchQuery('');
        setIntegrityOpen(nextReport.errorCount > 0 || nextReport.warningCount > 0);
        showToast(
          `Importiert: ${parsed.rseList.length} RSE, ${parsed.events.length} Events (${nextReport.errorCount} Fehler)`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
        setImportError(`Excel-Import fehlgeschlagen: ${msg}`);
      }
    },
    [showToast]
  );

  const handleResetLocalChanges = useCallback(async () => {
    await clearPersistedDatasetInIndexedDb();
    await loadBundledDefault(true);
    showToast('Original-Excel v14 wiederhergestellt');
  }, [loadBundledDefault, showToast]);

  const handleChangePalette = useCallback((next: CustomPalette) => {
    setPalette(next);
    savePaletteToLocalStorage(next);
  }, []);

  const handleToggleColorFilter = useCallback((group: StatusColorGroup) => {
    setActiveColorFilters((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }, []);

  const handleQuickStatusChange = useCallback(
    (rseId: string, versionKey: string, nextStatus: StatusCode) => {
      mutateDataset(
        (prev) => upsertRseEvent(prev, { rseId, versionKey, statusCode: nextStatus }),
        `${rseId} (${versionKey}) → ${nextStatus}`
      );
    },
    [mutateDataset]
  );

<<<<<<< HEAD
  const handleUploadMedia = useCallback(
    async (refKey: string, file: File) => {
=======
  // Media Upload (opens Crop Modal first), Caption, Delete & 2D-Tile Media Binding
  const commitMediaFile = useCallback(
    async (
      refKey: string,
      file: File,
      nodeLink?: { rseId: string; versionKey: string }
    ) => {
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
      try {
        let finalRefKey = refKey;
        if (nodeLink) {
          const ext =
            file.type === 'image/webp'
              ? 'webp'
              : file.type === 'image/jpeg'
                ? 'jpg'
                : 'png';
          const verSlug = nodeLink.versionKey.replace(/[^a-zA-Z0-9]+/g, '_');
          const rseSlug = nodeLink.rseId.replace(/[^a-zA-Z0-9]+/g, '_');
          finalRefKey = `media/${verSlug}_${rseSlug}.${ext}`;
        }

        const existingCaption =
          mediaMap[finalRefKey]?.caption ?? mediaMap[refKey]?.caption ?? '';
        const attachment = await readImageFileAsAttachment(file, finalRefKey, existingCaption);
        await saveMediaToIndexedDb(attachment);
        setMediaMap((prev) => ({ ...prev, [finalRefKey]: attachment }));

        if (nodeLink) {
          mutateDataset(
            (prev) =>
              setNodeEventMediaRef(prev, nodeLink.rseId, nodeLink.versionKey, finalRefKey),
            `Foto "${file.name}" an ${nodeLink.rseId} (${nodeLink.versionKey}) gespeichert`
          );
        } else {
          showToast(`Foto "${file.name}" gespeichert (${finalRefKey})`);
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Foto-Upload fehlgeschlagen.');
      }
    },
    [mediaMap, mutateDataset, showToast]
  );

  const handleUploadMedia = useCallback((refKey: string, file: File) => {
    setPendingCrop({
      refKey,
      file,
      title: refKey,
    });
  }, []);

  const handleUploadNodeMedia = useCallback(
    (rseId: string, versionKey: string, file: File) => {
      const ver = dataset?.versions.find((v) => v.versionKey === versionKey);
      const existingEv = ver
        ? dataset?.events.find((e) => e.rseId === rseId && e.versionNr === ver.sortOrder)
        : undefined;
      const defaultRef =
        existingEv?.mediaRef ||
        `media/${versionKey.replace(/[^a-zA-Z0-9]+/g, '_')}_${rseId.replace(/[^a-zA-Z0-9]+/g, '_')}.webp`;
      setPendingCrop({
        refKey: defaultRef,
        file,
        title: `${rseId} (${versionKey})`,
        nodeLink: { rseId, versionKey },
      });
    },
    [dataset]
  );

  const handleDeleteNodeMedia = useCallback(
    async (rseId: string, versionKey: string, refKey: string) => {
      await deleteMediaFromIndexedDb(refKey);
      setMediaMap((prev) => {
        const next = { ...prev };
        delete next[refKey];
        return next;
      });
      mutateDataset(
        (prev) => setNodeEventMediaRef(prev, rseId, versionKey, ''),
        `Foto von ${rseId} (${versionKey}) entfernt`
      );
    },
    [mutateDataset]
  );

  const handleUpdateMediaCaption = useCallback(
    async (refKey: string, caption: string) => {
      const existing = mediaMap[refKey];
      if (!existing) return;
      const updated: MediaAttachment = {
        ...existing,
        caption,
        updatedAt: new Date().toISOString(),
      };
      await saveMediaToIndexedDb(updated);
      setMediaMap((prev) => ({ ...prev, [refKey]: updated }));
      showToast('Bildunterschrift gespeichert');
    },
    [mediaMap, showToast]
  );

  const handleDeleteMedia = useCallback(
    async (refKey: string) => {
      await deleteMediaFromIndexedDb(refKey);
      setMediaMap((prev) => {
        const next = { ...prev };
        delete next[refKey];
        return next;
      });
      showToast('Foto entfernt');
    },
    [showToast]
  );

  const handleJsonBackupImport = useCallback(
    async (file: File) => {
      try {
        const backup = await parseProjectJsonBackup(file);
        if (backup.dataset) {
          setDataset(backup.dataset);
          setChangeCount(1);
          await savePersistedDatasetToIndexedDb(backup.dataset, 1);
        }
        setPalette(backup.palette);
        savePaletteToLocalStorage(backup.palette);

        const nextMedia: Record<string, MediaAttachment> = { ...mediaMap };
        for (const item of Object.values(backup.media)) {
          await saveMediaToIndexedDb(item);
          nextMedia[item.refKey] = item;
        }
        setMediaMap(nextMedia);
        showToast(
          `Projektpaket geladen (${Object.keys(backup.media).length} Fotos wiederhergestellt)`
        );
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : 'JSON-Backup konnte nicht geladen werden.'
        );
      }
    },
    [mediaMap, showToast]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      if (!isDraggingFile) setIsDraggingFile(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      handleExcelFileSelected(file);
    } else if (file.name.match(/\.json$/i)) {
      handleJsonBackupImport(file);
    }
  };

  const mediaCount = Object.keys(mediaMap).length;
  const showTimelineBar = dataset && (activeView === 'board' || activeView === 'matrix');

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100"
    >
      {report && dataset && (
        <Header
          sourceName={dataset.sourceName}
          activeView={activeView}
          onChangeView={setActiveView}
          appMode={appMode}
          onChangeAppMode={setAppMode}
          detailLevel={detailLevel}
          onChangeDetailLevel={setDetailLevel}
          lang={lang}
          onChangeLang={setLang}
          report={report}
          integrityOpen={integrityOpen}
          onToggleIntegrity={() => setIntegrityOpen((p) => !p)}
          mediaCount={mediaCount}
          changeCount={changeCount}
          onExcelFileSelected={handleExcelFileSelected}
          onJsonBackupImport={handleJsonBackupImport}
          onExportZip={() => {
            downloadProjectZipPackage(dataset, palette, mediaMap);
            showToast('ZIP-Projektpaket (XLSX + public/media/) erstellt');
          }}
          onExportXlsx={() => {
            downloadUpdatedXlsx(dataset, createEmptyEdits(), mediaMap);
            showToast('Aktualisierte SGE-.xlsx exportiert');
          }}
          onExportEmptyTemplate={() => {
            downloadEmptySgeTemplateXlsx();
            showToast('Leeres SGE-Excel-Template inkl. Anleitung heruntergeladen');
          }}
          onExportSampleProject={() => {
            downloadSampleProjectXlsx(dataset, mediaMap);
            showToast('Duckomat-Beispielprojekt (.xlsx) heruntergeladen');
          }}
          onExportJson={() => {
            downloadProjectJsonBackup(dataset, palette, mediaMap);
            showToast('Projektpaket (JSON + Bilder) exportiert');
          }}
          onDownloadTemplate={() => {
            downloadEmptySgeTemplateXlsx();
            showToast('Leeres SGE-Template (inkl. Anleitung_&_Struktur) heruntergeladen');
          }}
          onDownloadExample={() => {
            downloadExampleProjectXlsx();
            showToast('Beispiel-Projekt (Kaffeemaschine) als .xlsx heruntergeladen');
          }}
          onResetLocalChanges={handleResetLocalChanges}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((p) => !p)}
        />
      )}

      {importError && (
        <div className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="font-semibold underline whitespace-nowrap"
          >
            Schließen
          </button>
        </div>
      )}

      {report && dataset && (
        <IntegrityBanner
          sourceName={dataset.sourceName}
          isBundledDefault={dataset.isBundledDefault && changeCount === 0}
          report={report}
          isExpanded={integrityOpen}
          onToggleExpand={() => setIntegrityOpen((p) => !p)}
          onReloadDefault={handleResetLocalChanges}
          onJumpToRse={(rseId) => {
            setSelectedArrowId(null);
            setSelectedRseId(rseId);
          }}
          rseIdSet={rseIdSet}
        />
      )}

      {showTimelineBar && dataset && (
        <VersionTimelineBar
          versions={dataset.versions}
          selectedVersionIndex={selectedVersionIndex}
          onSelectVersionIndex={setSelectedVersionIndex}
          appMode={appMode}
          lang={lang}
          onOpenModal={setModal}
          kpi={versionKpi}
          activeColorFilters={activeColorFilters}
          onToggleColorFilter={handleToggleColorFilter}
          onSetColorFilters={setActiveColorFilters}
          colorMode={colorMode}
          onChangeColorMode={setColorMode}
          palette={palette}
          onChangePalette={handleChangePalette}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Main Workspace */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            <p className="text-sm font-medium">
              Lade Duckomat_Entwicklungsdatenbank_v14.xlsx (Model of SGE)...
            </p>
          </div>
        ) : !dataset || !selectedVersion ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <Upload className="h-10 w-10 text-slate-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Keine SGE-Datenbank geladen
            </h2>
            <p className="max-w-md text-xs text-slate-500">
              Ziehen Sie <code>Duckomat_Entwicklungsdatenbank_v14.xlsx</code> per Drag & Drop hierher.
            </p>
          </div>
        ) : (
          <>
            {/* View 1 (Default): Bereinigte 2D-Swimlane-Entwicklungsansicht (G_n / E_{n,m}, ohne CV-Kästen) */}
            {activeView === 'swimlane2d' && (
              <Swimlane2DGraphView
                dataset={dataset}
                appMode={appMode}
                detailLevel={detailLevel}
                lang={lang}
                palette={palette}
                activeColorFilters={activeColorFilters}
                searchQuery={searchQuery}
                darkMode={darkMode}
                mediaMap={mediaMap}
                selectedRseId={selectedRseId}
                selectedArrowId={selectedArrowId}
                onSelectRse={(id, verIdx) => {
                  setSelectedArrowId(null);
                  setSelectedRseId(id);
                  if (verIdx !== undefined) setSelectedVersionIndex(verIdx);
                }}
                onSelectArrow={(arrowId) => {
                  setSelectedRseId(null);
                  setSelectedArrowId(arrowId);
                }}
                onQuickStatusChange={handleQuickStatusChange}
                onAddEventReference={(eventId, ref) =>
                  mutateDataset(
                    (prev) => addEventReference(prev, eventId, ref),
                    'Referenz hinzugefügt'
                  )
                }
                onUpdateEventReference={(eventId, refId, patch) =>
                  mutateDataset(
                    (prev) => updateEventReference(prev, eventId, refId, patch),
                    'Referenz-Variationsart aktualisiert'
                  )
                }
                onDeleteEventReference={(eventId, refId) =>
                  mutateDataset(
                    (prev) => deleteEventReference(prev, eventId, refId),
                    'Referenz entfernt'
                  )
                }
                onOpenModal={setModal}
                onUploadNodeMedia={handleUploadNodeMedia}
                onDeleteNodeMedia={handleDeleteNodeMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}

            {/* View 2: SGE-Karten & Versions-Slider */}
            {activeView === 'board' && (
              <SwimlaneBoard
                dataset={dataset}
                selectedVersion={selectedVersion}
                rseStates={rseStates}
                appMode={appMode}
                detailLevel={detailLevel}
                lang={lang}
                activeColorFilters={activeColorFilters}
                colorMode={colorMode}
                palette={palette}
                searchQuery={searchQuery}
                selectedRseId={selectedRseId}
                mediaMap={mediaMap}
                onSelectRse={(id) => {
                  setSelectedArrowId(null);
                  setSelectedRseId((prev) => (prev === id ? null : id));
                }}
                onQuickStatusChange={handleQuickStatusChange}
                onAddEventReference={(eventId, ref) =>
                  mutateDataset(
                    (prev) => addEventReference(prev, eventId, ref),
                    'Referenz hinzugefügt'
                  )
                }
                onUpdateEventReference={(eventId, refId, patch) =>
                  mutateDataset(
                    (prev) => updateEventReference(prev, eventId, refId, patch),
                    'Referenz aktualisiert'
                  )
                }
                onDeleteEventReference={(eventId, refId) =>
                  mutateDataset(
                    (prev) => deleteEventReference(prev, eventId, refId),
                    'Referenz entfernt'
                  )
                }
                onOpenModal={setModal}
              />
            )}

            {/* View 3: SGE-Matrix, gestapelte SGE-Balkendiagramme & KOMBI-Übersicht */}
            {activeView === 'matrix' && (
              <RseMatrixView
                dataset={dataset}
                appMode={appMode}
                detailLevel={detailLevel}
                lang={lang}
                selectedVersionIndex={selectedVersionIndex}
                selectedVersion={selectedVersion}
                activeColorFilters={activeColorFilters}
                colorMode={colorMode}
                palette={palette}
                searchQuery={searchQuery}
                selectedRseId={selectedRseId}
                mediaMap={mediaMap}
                onSelectRse={(id) => {
                  setSelectedArrowId(null);
                  setSelectedRseId(id);
                }}
                onSelectVersionIndex={setSelectedVersionIndex}
                onOpenModal={setModal}
                onUploadMedia={handleUploadMedia}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onDeleteMedia={handleDeleteMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}

            {/* View 4: Foto-Verwaltung & 20 Platzhalter-Hub */}
            {activeView === 'media' && (
              <IntegrationsAndMediaView
                dataset={dataset}
                appMode={appMode}
                palette={palette}
                mediaMap={mediaMap}
                onSelectRse={(id) => {
                  setSelectedArrowId(null);
                  setSelectedRseId(id);
                }}
                onEditMicroIteration={(microId, patch) =>
                  mutateDataset(
                    (prev) => updateMicroIteration(prev, microId, patch),
                    `Mikro-Iteration ${microId} aktualisiert`
                  )
                }
                onOpenModal={setModal}
                onUploadMedia={handleUploadMedia}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onDeleteMedia={handleDeleteMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}

            {/* View 5: Alle Tabellen */}
            {activeView === 'tables' && (
              <div className="flex-1 overflow-hidden">
                <DataTablesView
                  dataset={dataset}
                  appMode={appMode}
                  palette={palette}
                  onSelectRse={(id) => {
                    setSelectedArrowId(null);
                    setSelectedRseId(id);
                  }}
                  onOpenModal={setModal}
                />
              </div>
            )}

            {/* Split-Drawer Deep-Dive (RSE oder Kausalpfeil) */}
            {(selectedRseId || selectedArrowId) && (
              <RseDeepDiveDrawer
                rseId={selectedRseId}
                arrowId={selectedArrowId}
                dataset={dataset}
                selectedVersion={selectedVersion}
                appMode={appMode}
                lang={lang}
                colorMode={colorMode}
                palette={palette}
                mediaMap={mediaMap}
                onClose={() => {
                  setSelectedRseId(null);
                  setSelectedArrowId(null);
                }}
                onSelectRse={(id) => {
                  setSelectedArrowId(null);
                  setSelectedRseId(id);
                }}
                onSelectVersionIndex={setSelectedVersionIndex}
                onQuickStatusChange={handleQuickStatusChange}
                onAddEventReference={(eventId, ref) =>
                  mutateDataset(
                    (prev) => addEventReference(prev, eventId, ref),
                    'Referenz hinzugefügt'
                  )
                }
                onUpdateEventReference={(eventId, refId, patch) =>
                  mutateDataset(
                    (prev) => updateEventReference(prev, eventId, refId, patch),
                    'Referenz aktualisiert'
                  )
                }
                onDeleteEventReference={(eventId, refId) =>
                  mutateDataset(
                    (prev) => deleteEventReference(prev, eventId, refId),
                    'Referenz entfernt'
                  )
                }
                onAddMicroIteration={(input) =>
                  mutateDataset(
                    (prev) => addMicroIteration(prev, input),
                    `Mikro-Iteration für ${input.rseId} hinzugefügt`
                  )
                }
                onEditMicroIteration={(microId, patch) =>
                  mutateDataset(
                    (prev) => updateMicroIteration(prev, microId, patch),
                    `Mikro-Iteration ${microId} aktualisiert`
                  )
                }
                onDeleteMicroIteration={(microId) =>
                  mutateDataset(
                    (prev) => deleteMicroIteration(prev, microId),
                    `Mikro-Iteration ${microId} gelöscht`
                  )
                }
                onOpenModal={setModal}
                onUploadMedia={handleUploadMedia}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onDeleteMedia={handleDeleteMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}
          </>
        )}
      </main>

      {dataset && (
        <EntityEditModals
          modal={modal}
          dataset={dataset}
          palette={palette}
          onClose={() => setModal(null)}
          onAddRse={(input) => {
            let createdId = '';
            mutateDataset((prev) => {
              const res = addRse(prev, input);
              createdId = res.createdRseId;
              return res.dataset;
            }, 'Neues RSE angelegt');
            if (createdId) setSelectedRseId(createdId);
          }}
          onUpdateRse={(rseId, patch) =>
            mutateDataset((prev) => updateRse(prev, rseId, patch), `RSE ${rseId} gespeichert`)
          }
          onDeleteRse={(rseId) => {
            mutateDataset((prev) => deleteRse(prev, rseId), `RSE ${rseId} gelöscht`);
            if (selectedRseId === rseId) setSelectedRseId(null);
          }}
          onUpsertEvent={(input) =>
            mutateDataset(
              (prev) => upsertRseEvent(prev, input),
              `Event für ${input.rseId} (${input.versionKey}) gespeichert`
            )
          }
          onDeleteEvent={(eventId) =>
            mutateDataset((prev) => deleteRseEvent(prev, eventId), `Event ${eventId} gelöscht`)
          }
          onUpsertArrow={(input) =>
            mutateDataset(
              (prev) => upsertArrow(prev, input),
              `Wirkpfeil ${input.fromRseId} → ${input.toRseId} gespeichert`
            )
          }
          onDeleteArrow={(arrowId) => {
            mutateDataset((prev) => deleteArrow(prev, arrowId), `Wirkpfeil ${arrowId} gelöscht`);
            if (selectedArrowId === arrowId) setSelectedArrowId(null);
          }}
          onUpsertKombi={(input) =>
            mutateDataset((prev) => upsertKombi(prev, input), 'Bauteil-Integration gespeichert')
          }
          onDeleteKombi={(kombiId) =>
            mutateDataset((prev) => deleteKombi(prev, kombiId), `${kombiId} gelöscht`)
          }
          onUpsertCause={(input, attachToEventId) =>
            mutateDataset(
              (prev) => upsertCause(prev, input, attachToEventId),
              'Ursache / Befund gespeichert'
            )
          }
          onDeleteCause={(causeId) =>
            mutateDataset((prev) => deleteCause(prev, causeId), `Ursache ${causeId} gelöscht`)
          }
          onUpsertLearning={(input) =>
            mutateDataset((prev) => upsertLearning(prev, input), 'Methodik-Learning gespeichert')
          }
          onDeleteLearning={(learningId) =>
            mutateDataset(
              (prev) => deleteLearning(prev, learningId),
              `Learning ${learningId} gelöscht`
            )
          }
          onUpdateSpur={(spurId, patch) =>
            mutateDataset((prev) => updateSpur(prev, spurId, patch), `Spur ${spurId} gespeichert`)
          }
          onUpdateVersion={(versionKey, patch) =>
            mutateDataset(
              (prev) => updateVersionConfig(prev, versionKey, patch),
              `Generation / Version ${versionKey} gespeichert`
            )
          }
        />
      )}

<<<<<<< HEAD
=======
      {/* Interactive Image Crop Modal on Upload */}
      <ImageCropModal
        file={pendingCrop?.file ?? null}
        title={pendingCrop?.title}
        onConfirmCropped={(croppedFile) => {
          if (pendingCrop) {
            void commitMediaFile(pendingCrop.refKey, croppedFile, pendingCrop.nodeLink);
          }
          setPendingCrop(null);
        }}
        onConfirmOriginal={(originalFile) => {
          if (pendingCrop) {
            void commitMediaFile(pendingCrop.refKey, originalFile, pendingCrop.nodeLink);
          }
          setPendingCrop(null);
        }}
        onCancel={() => setPendingCrop(null)}
      />

      {/* Full-screen Lightbox */}
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
      <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {toast}
        </div>
      )}

      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 text-center shadow-2xl dark:border-blue-400 dark:bg-slate-900">
            <Upload className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
<<<<<<< HEAD
              SGE Excel-Datenbank (.xlsx) oder Projektpaket (.json) ablegen
=======
              SGE-Excel (.xlsx) oder Projektpaket (.json) ablegen
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Unterstützt Gₙ/Eₙ,ₘ, CV/AV/PV (inkl. automatischer GV→AV Migration) & RSE_Referenzen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
