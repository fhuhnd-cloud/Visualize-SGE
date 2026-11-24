import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { DataTablesView } from './components/DataTablesView';
import { EntityEditModals, ModalState } from './components/EntityEditModals';
import { Header } from './components/Header';
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
  SgeDataset,
  StatusCode,
  StatusColorGroup,
  WorkspaceView,
} from './types/sge';
import {
  downloadUpdatedXlsx,
  parseExcelBuffer,
  parseExcelFile,
  validateSgeDataset,
} from './utils/excelParser';
import {
  computeRseStatesAtVersion,
  computeVersionKpis,
} from './utils/sgeAnalytics';
import {
  addMicroIteration,
  addRse,
  deleteArrow,
  deleteCause,
  deleteKombi,
  deleteLearning,
  deleteMicroIteration,
  deleteRse,
  deleteRseEvent,
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

  // Global Multi-View, Mode (Presentation vs Edit), and 3-Stage Detail Depth
  const [activeView, setActiveView] = useState<WorkspaceView>('board');
  const [appMode, setAppMode] = useState<AppMode>('presentation');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(1);

  const [darkMode, setDarkMode] = useState(false);
  const [integrityOpen, setIntegrityOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Version Slider, SGE Color Filters, Color Mode, Custom Palette, Search
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(6);
  const [activeColorFilters, setActiveColorFilters] = useState<StatusColorGroup[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>('planning');
  const [palette, setPalette] = useState<CustomPalette>(() => loadPaletteFromLocalStorage());
  const [searchQuery, setSearchQuery] = useState('');

  // Right Deep-Dive Drawer (RSE or Arrow), Edit Modal, and Lightbox
  const [selectedRseId, setSelectedRseId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [lightboxItem, setLightboxItem] = useState<LightboxPayload | null>(null);

  // Locally persisted media (IndexedDB)
  const [mediaMap, setMediaMap] = useState<Record<string, MediaAttachment>>({});

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  // Load persisted photos + check for locally saved dataset state in IndexedDB
  const loadBundledDefault = useCallback(async (ignoreSaved = false) => {
    setLoading(true);
    setImportError(null);
    try {
      if (!ignoreSaved) {
        const persisted = await loadPersistedDatasetFromIndexedDb();
        if (persisted?.dataset && persisted.dataset.rseList.length > 0) {
          setDataset(persisted.dataset);
          setChangeCount(persisted.changeCount ?? 0);
          setSelectedVersionIndex(Math.max(0, persisted.dataset.versions.length - 1));
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

  // Central mutation helper: updates live dataset & persists to IndexedDB automatically
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

  // Live Integrity Report recomputed on every dataset mutation
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

  // Keyboard shortcuts
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

  // Excel File Import
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

  // Reset to original bundled Excel
  const handleResetLocalChanges = useCallback(async () => {
    await clearPersistedDatasetInIndexedDb();
    await loadBundledDefault(true);
    showToast('Original-Excel v14 wiederhergestellt');
  }, [loadBundledDefault, showToast]);

  // Palette change
  const handleChangePalette = useCallback((next: CustomPalette) => {
    setPalette(next);
    savePaletteToLocalStorage(next);
  }, []);

  const handleToggleColorFilter = useCallback((group: StatusColorGroup) => {
    setActiveColorFilters((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }, []);

  // Quick ISEM Status_Code change directly on any card/node/event
  const handleQuickStatusChange = useCallback(
    (rseId: string, versionKey: string, nextStatus: StatusCode) => {
      mutateDataset(
        (prev) => upsertRseEvent(prev, { rseId, versionKey, statusCode: nextStatus }),
        `${rseId} (${versionKey}) → ${nextStatus}`
      );
    },
    [mutateDataset]
  );

  // Media Upload / Caption / Delete
  const handleUploadMedia = useCallback(
    async (refKey: string, file: File) => {
      try {
        const existingCaption = mediaMap[refKey]?.caption ?? '';
        const attachment = await readImageFileAsAttachment(file, refKey, existingCaption);
        await saveMediaToIndexedDb(attachment);
        setMediaMap((prev) => ({ ...prev, [refKey]: attachment }));
        showToast(`Foto "${file.name}" gespeichert (${refKey})`);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Foto-Upload fehlgeschlagen.');
      }
    },
    [mediaMap, showToast]
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

  // JSON Project Package Import
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

  // Global Excel/JSON Drag & Drop
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
  const showTimelineBar =
    dataset && (activeView === 'board' || activeView === 'matrix' || activeView === 'swimlane2d');

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100"
    >
      {/* Top Main Toolbar: Multi-View + 3-Stage Detail Depth + Global Presentation/Edit Mode */}
      {report && dataset && (
        <Header
          activeView={activeView}
          onChangeView={setActiveView}
          appMode={appMode}
          onChangeAppMode={setAppMode}
          detailLevel={detailLevel}
          onChangeDetailLevel={setDetailLevel}
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
            showToast('Aktualisierte 13-Blatt .xlsx exportiert');
          }}
          onExportJson={() => {
            downloadProjectJsonBackup(dataset, palette, mediaMap);
            showToast('Projektpaket (JSON + Bilder) exportiert');
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

      {/* Integrity Banner */}
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

      {/* Version Slider & ISEM Color Legend / Filter Bar */}
      {showTimelineBar && dataset && (
        <VersionTimelineBar
          versions={dataset.versions}
          selectedVersionIndex={selectedVersionIndex}
          onSelectVersionIndex={setSelectedVersionIndex}
          appMode={appMode}
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
              Lade Duckomat_Entwicklungsdatenbank_v14.xlsx (13 Blätter)...
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
            {/* View 1: Bestehende Ansicht (Bisheriger Stand – SGE-Karten & Versions-Slider) */}
            {activeView === 'board' && (
              <SwimlaneBoard
                dataset={dataset}
                selectedVersion={selectedVersion}
                rseStates={rseStates}
                appMode={appMode}
                detailLevel={detailLevel}
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
                onOpenModal={setModal}
              />
            )}

            {/* View 2: NEU – 2D-Swimlane-Entwicklungsansicht mit RSE-Zeilen & SVG-Kausalpfeilen */}
            {activeView === 'swimlane2d' && (
              <Swimlane2DGraphView
                dataset={dataset}
                appMode={appMode}
                detailLevel={detailLevel}
                colorMode={colorMode}
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
                onOpenModal={setModal}
              />
            )}

            {/* View 3: SGE-Phasenmatrix, gestapelte SGE-Balkendiagramme & KOMBI-Übersicht */}
            {activeView === 'matrix' && (
              <RseMatrixView
                dataset={dataset}
                appMode={appMode}
                detailLevel={detailLevel}
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

            {/* View 5: Alle 13 Excel-Tabellen */}
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

            {/* Split-Drawer Deep-Dive (RSE oder Kausalpfeil – in jeder Ansicht erreichbar) */}
            {(selectedRseId || selectedArrowId) && (
              <RseDeepDiveDrawer
                rseId={selectedRseId}
                arrowId={selectedArrowId}
                dataset={dataset}
                selectedVersion={selectedVersion}
                appMode={appMode}
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

      {/* Edit / Create Entity Modals */}
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
              `Version ${versionKey} gespeichert`
            )
          }
        />
      )}

      {/* Full-screen Lightbox */}
      <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {toast}
        </div>
      )}

      {/* Global Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 text-center shadow-2xl dark:border-blue-400 dark:bg-slate-900">
            <Upload className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Duckomat v14 Excel (.xlsx) oder Projektpaket (.json) ablegen
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Liest alle 13 SGE-Tabellenblätter automatisch aus und prüft Fremdschlüssel-Integrität
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
