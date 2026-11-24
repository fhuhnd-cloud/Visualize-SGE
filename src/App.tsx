import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { CausalGraphView } from './components/CausalGraphView';
import { DataTablesView } from './components/DataTablesView';
import { Header } from './components/Header';
import { IntegrationsAndMediaView } from './components/IntegrationsAndMediaView';
import { IntegrityBanner } from './components/IntegrityBanner';
import { LightboxModal, LightboxPayload } from './components/LightboxModal';
import { RseDeepDiveDrawer } from './components/RseDeepDiveDrawer';
import { RseMatrixView } from './components/RseMatrixView';
import { SwimlaneBoard } from './components/SwimlaneBoard';
import { VersionTimelineBar } from './components/VersionTimelineBar';
import {
  ColorMode,
  CustomPalette,
  EventEditPatch,
  IntegrityReport,
  MediaAttachment,
  MicroIterationEditPatch,
  ProjectEditsOverlay,
  SgeDataset,
  StatusColorGroup,
  WorkspaceView,
} from './types/sge';
import {
  downloadUpdatedXlsx,
  parseExcelBuffer,
  parseExcelFile,
} from './utils/excelParser';
import {
  applyEditsToDataset,
  computeRseStatesAtVersion,
  computeVersionKpis,
} from './utils/sgeAnalytics';
import {
  deleteMediaFromIndexedDb,
  downloadProjectJsonBackup,
  downloadProjectZipPackage,
  loadAllMediaFromIndexedDb,
  loadEditsFromLocalStorage,
  loadPaletteFromLocalStorage,
  parseProjectJsonBackup,
  readImageFileAsAttachment,
  saveEditsToLocalStorage,
  saveMediaToIndexedDb,
  savePaletteToLocalStorage,
} from './utils/storage';

const DEFAULT_XLSX_URL = '/Duckomat_Entwicklungsdatenbank_v14.xlsx';

export default function App() {
  const [rawDataset, setRawDataset] = useState<SgeDataset | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<WorkspaceView>('swimlane');
  const [darkMode, setDarkMode] = useState(false);
  const [integrityOpen, setIntegrityOpen] = useState(false);
  const [isDraggingXlsx, setIsDraggingXlsx] = useState(false);

  // Version Slider, SGE Color Filters, Color Mode, Custom Palette, Search
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(6); // default v2.2
  const [activeColorFilters, setActiveColorFilters] = useState<StatusColorGroup[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>('planning');
  const [palette, setPalette] = useState<CustomPalette>(() => loadPaletteFromLocalStorage());
  const [searchQuery, setSearchQuery] = useState('');

  // RSE Deep-Dive Drawer & Lightbox
  const [selectedRseId, setSelectedRseId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<LightboxPayload | null>(null);

  // Local Persistence: Text/Status Edits (localStorage) + Media (IndexedDB)
  const [edits, setEdits] = useState<ProjectEditsOverlay>(() => loadEditsFromLocalStorage());
  const [mediaMap, setMediaMap] = useState<Record<string, MediaAttachment>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

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

  // Load persisted photos from IndexedDB on startup
  useEffect(() => {
    loadAllMediaFromIndexedDb().then((loaded) => setMediaMap(loaded));
  }, []);

  // Load bundled v14 Excel database automatically from public/
  const loadBundledDefault = useCallback(async () => {
    setLoading(true);
    setImportError(null);
    try {
      const res = await fetch(DEFAULT_XLSX_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} beim Laden von ${DEFAULT_XLSX_URL}`);
      }
      const buffer = await res.arrayBuffer();
      const { dataset, report: nextReport } = parseExcelBuffer(
        buffer,
        'Duckomat_Entwicklungsdatenbank_v14.xlsx',
        true
      );
      setRawDataset(dataset);
      setReport(nextReport);
      setSelectedVersionIndex(Math.max(0, dataset.versions.length - 1));
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
    loadBundledDefault();
  }, [loadBundledDefault]);

  // Merge locally persisted edits into dataset reactively
  const dataset = useMemo(
    () => (rawDataset ? applyEditsToDataset(rawDataset, edits) : null),
    [rawDataset, edits]
  );

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

  // Keyboard shortcuts: Left/Right for Version Slider, Escape to close Drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape' && !lightboxItem) {
        setSelectedRseId(null);
      } else if (
        e.key === 'ArrowRight' &&
        dataset &&
        (activeView === 'swimlane' || activeView === 'matrix')
      ) {
        setSelectedVersionIndex((p) => Math.min(dataset.versions.length - 1, p + 1));
      } else if (
        e.key === 'ArrowLeft' &&
        dataset &&
        (activeView === 'swimlane' || activeView === 'matrix')
      ) {
        setSelectedVersionIndex((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dataset, activeView, lightboxItem]);

  // Excel File Import
  const handleExcelFileSelected = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setImportError(
          `Ungültiges Dateiformat ("${file.name}"). Bitte eine .xlsx-Datei auswählen.`
        );
        return;
      }
      try {
        setImportError(null);
        const { dataset: parsed, report: nextReport } = await parseExcelFile(file);
        setRawDataset(parsed);
        setReport(nextReport);
        setSelectedVersionIndex(Math.max(0, parsed.versions.length - 1));
        setSelectedRseId(null);
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

  // Palette change
  const handleChangePalette = useCallback((next: CustomPalette) => {
    setPalette(next);
    savePaletteToLocalStorage(next);
  }, []);

  // Color Legend Filter Toggle
  const handleToggleColorFilter = useCallback((group: StatusColorGroup) => {
    setActiveColorFilters((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }, []);

  // Local Event & Micro-Iteration Edits
  const handleEditEvent = useCallback(
    (eventId: string, patch: EventEditPatch) => {
      setEdits((prev) => {
        const next: ProjectEditsOverlay = {
          ...prev,
          events: {
            ...prev.events,
            [eventId]: { ...prev.events[eventId], ...patch },
          },
          updatedAt: new Date().toISOString(),
        };
        saveEditsToLocalStorage(next);
        return next;
      });
      showToast(`Änderung an ${eventId} lokal gespeichert`);
    },
    [showToast]
  );

  const handleEditMicroIteration = useCallback(
    (microId: string, patch: MicroIterationEditPatch) => {
      setEdits((prev) => {
        const next: ProjectEditsOverlay = {
          ...prev,
          microIterations: {
            ...prev.microIterations,
            [microId]: { ...prev.microIterations[microId], ...patch },
          },
          updatedAt: new Date().toISOString(),
        };
        saveEditsToLocalStorage(next);
        return next;
      });
      showToast(`Mikro-Iteration ${microId} lokal aktualisiert`);
    },
    [showToast]
  );

  // Photo Upload / Caption / Delete (IndexedDB)
  const handleUploadMedia = useCallback(
    async (refKey: string, file: File) => {
      try {
        const existingCaption = mediaMap[refKey]?.caption ?? '';
        const attachment = await readImageFileAsAttachment(file, refKey, existingCaption);
        await saveMediaToIndexedDb(attachment);
        setMediaMap((prev) => ({ ...prev, [refKey]: attachment }));
        showToast(`Foto "${file.name}" lokal gespeichert (${refKey})`);
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

  // JSON Backup Restore
  const handleJsonBackupImport = useCallback(
    async (file: File) => {
      try {
        const backup = await parseProjectJsonBackup(file);
        setEdits(backup.edits);
        saveEditsToLocalStorage(backup.edits);
        setPalette(backup.palette);
        savePaletteToLocalStorage(backup.palette);

        const nextMedia: Record<string, MediaAttachment> = { ...mediaMap };
        for (const item of Object.values(backup.media)) {
          await saveMediaToIndexedDb(item);
          nextMedia[item.refKey] = item;
        }
        setMediaMap(nextMedia);
        showToast(
          `Backup geladen: ${Object.keys(backup.media).length} Fotos & Pflegestände wiederhergestellt`
        );
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'JSON-Backup konnte nicht geladen werden.');
      }
    },
    [mediaMap, showToast]
  );

  const editCount =
    Object.keys(edits.events).length +
    Object.keys(edits.microIterations).length +
    Object.keys(edits.kombis).length;
  const mediaCount = Object.keys(mediaMap).length;

  // Global Excel Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      if (!isDraggingXlsx) setIsDraggingXlsx(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingXlsx(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingXlsx(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      handleExcelFileSelected(file);
    } else if (file.name.match(/\.json$/i)) {
      handleJsonBackupImport(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100"
    >
      {/* Top Header */}
      {report && dataset && (
        <Header
          activeView={activeView}
          onChangeView={setActiveView}
          report={report}
          integrityOpen={integrityOpen}
          onToggleIntegrity={() => setIntegrityOpen((p) => !p)}
          mediaCount={mediaCount}
          editCount={editCount}
          onExcelFileSelected={handleExcelFileSelected}
          onJsonBackupImport={handleJsonBackupImport}
          onExportZip={() => {
            downloadProjectZipPackage(dataset, edits, palette, mediaMap);
            showToast('ZIP-Projektpaket (XLSX + public/media/) erstellt');
          }}
          onExportXlsx={() => {
            downloadUpdatedXlsx(dataset, edits, mediaMap);
            showToast('Aktualisierte 13-Blatt .xlsx exportiert');
          }}
          onExportJson={() => {
            downloadProjectJsonBackup(dataset, edits, palette, mediaMap);
            showToast('JSON-Projektpaket exportiert');
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((p) => !p)}
        />
      )}

      {/* Import Error Alert */}
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
          isBundledDefault={dataset.isBundledDefault}
          report={report}
          isExpanded={integrityOpen}
          onToggleExpand={() => setIntegrityOpen((p) => !p)}
          onReloadDefault={loadBundledDefault}
          onJumpToRse={(rseId) => setSelectedRseId(rseId)}
          rseIdSet={rseIdSet}
        />
      )}

      {/* Interactive Version Slider + SGE Color Legend & Filter Bar */}
      {dataset && (activeView === 'swimlane' || activeView === 'matrix') && (
        <VersionTimelineBar
          versions={dataset.versions}
          selectedVersionIndex={selectedVersionIndex}
          onSelectVersionIndex={setSelectedVersionIndex}
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
            {activeView === 'swimlane' && (
              <SwimlaneBoard
                dataset={dataset}
                selectedVersion={selectedVersion}
                rseStates={rseStates}
                activeColorFilters={activeColorFilters}
                colorMode={colorMode}
                palette={palette}
                searchQuery={searchQuery}
                selectedRseId={selectedRseId}
                mediaMap={mediaMap}
                onSelectRse={(id) =>
                  setSelectedRseId((prev) => (prev === id ? null : id))
                }
              />
            )}

            {activeView === 'matrix' && (
              <RseMatrixView
                dataset={dataset}
                selectedVersionIndex={selectedVersionIndex}
                selectedVersion={selectedVersion}
                activeColorFilters={activeColorFilters}
                colorMode={colorMode}
                palette={palette}
                searchQuery={searchQuery}
                selectedRseId={selectedRseId}
                onSelectRse={(id) => setSelectedRseId(id)}
                onSelectVersionIndex={setSelectedVersionIndex}
              />
            )}

            {activeView === 'media' && (
              <IntegrationsAndMediaView
                dataset={dataset}
                palette={palette}
                mediaMap={mediaMap}
                onSelectRse={(id) => setSelectedRseId(id)}
                onEditMicroIteration={handleEditMicroIteration}
                onUploadMedia={handleUploadMedia}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onDeleteMedia={handleDeleteMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}

            {activeView === 'causal' && (
              <CausalGraphView
                dataset={dataset}
                onSelectRse={(id) => setSelectedRseId(id)}
              />
            )}

            {activeView === 'tables' && (
              <div className="flex-1 overflow-hidden">
                <DataTablesView
                  dataset={dataset}
                  palette={palette}
                  onSelectRse={(id) => setSelectedRseId(id)}
                />
              </div>
            )}

            {/* Split-Drawer RSE Deep-Dive (available across all views!) */}
            {selectedRseId && (
              <RseDeepDiveDrawer
                rseId={selectedRseId}
                dataset={dataset}
                selectedVersion={selectedVersion}
                colorMode={colorMode}
                palette={palette}
                mediaMap={mediaMap}
                onClose={() => setSelectedRseId(null)}
                onSelectRse={(id) => setSelectedRseId(id)}
                onSelectVersionIndex={setSelectedVersionIndex}
                onEditEvent={handleEditEvent}
                onEditMicroIteration={handleEditMicroIteration}
                onUploadMedia={handleUploadMedia}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                onDeleteMedia={handleDeleteMedia}
                onOpenLightbox={setLightboxItem}
              />
            )}
          </>
        )}
      </main>

      {/* Lightbox Modal */}
      <LightboxModal item={lightboxItem} onClose={() => setLightboxItem(null)} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {toast}
        </div>
      )}

      {/* Global Excel Drag & Drop Overlay */}
      {isDraggingXlsx && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white px-10 py-8 text-center shadow-2xl dark:border-blue-400 dark:bg-slate-900">
            <Upload className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Duckomat v14 Excel-Datenbank (.xlsx) oder JSON-Backup ablegen
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Liest alle 13 SGE-Tabellenblätter inkl. RSE_Stammdaten, RSE_Phasenwechsel,
              RSE_Phasenmatrix, Bauteil_Integrationen & Mikro_Iterationen automatisch ein
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
