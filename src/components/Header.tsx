import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  FolderUp,
  GitBranch,
  LayoutGrid,
  Moon,
  Pencil,
  RotateCcw,
  Sun,
  Table2,
  Upload,
} from 'lucide-react';
import {
  AppMode,
  DetailLevel,
  IntegrityReport,
  WorkspaceView,
} from '../types/sge';

interface HeaderProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  appMode: AppMode;
  onChangeAppMode: (mode: AppMode) => void;
  detailLevel: DetailLevel;
  onChangeDetailLevel: (level: DetailLevel) => void;
  report: IntegrityReport;
  integrityOpen: boolean;
  onToggleIntegrity: () => void;
  mediaCount: number;
  changeCount: number;
  onExcelFileSelected: (file: File) => void;
  onJsonBackupImport: (file: File) => void;
  onExportZip: () => void;
  onExportXlsx: () => void;
  onExportJson: () => void;
  onResetLocalChanges: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  appMode,
  onChangeAppMode,
  detailLevel,
  onChangeDetailLevel,
  report,
  integrityOpen,
  onToggleIntegrity,
  mediaCount,
  changeCount,
  onExcelFileSelected,
  onJsonBackupImport,
  onExportZip,
  onExportXlsx,
  onExportJson,
  onResetLocalChanges,
  darkMode,
  onToggleDarkMode,
}) => {
  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const hasErrors = report.errorCount > 0;
  const hasWarnings = report.warningCount > 0;
  const isEditMode = appMode === 'edit';

  const viewItems: { key: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    {
      key: 'board',
      label: 'SGE-Karten',
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
    },
    {
      key: 'swimlane2d',
      label: '2D-Swimlanes',
      icon: <GitBranch className="h-3.5 w-3.5" />,
    },
    {
      key: 'matrix',
      label: 'Matrix & Kennzahlen',
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
    {
      key: 'media',
      label: 'Fotos',
      icon: <Camera className="h-3.5 w-3.5" />,
    },
    {
      key: 'tables',
      label: '13 Tabellen',
      icon: <Table2 className="h-3.5 w-3.5" />,
    },
  ];

  const showDetailSwitcher =
    activeView === 'board' || activeView === 'swimlane2d' || activeView === 'matrix';

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors ${
        isEditMode
          ? 'border-amber-300 bg-amber-50/45 dark:border-amber-800/80 dark:bg-slate-900'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        {/* Zone 1: Brand + View Switcher (Darstellungsart) */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onChangeView('board')}
            className="flex items-center gap-2 text-left text-[15px] font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-80 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-blue-600 dark:text-blue-400 shrink-0"
            >
              <rect x="2.5" y="3.5" width="7" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="14.5" y="3.5" width="7" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="14.5" y="15" width="7" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.5 6.25H14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M6 9V17.75H14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Duckomat</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              SGE v14
            </span>
          </button>

          {/* A) Darstellungsart (View Switcher) */}
          <nav
            aria-label="Darstellungsart"
            className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
          >
            {viewItems.map((item) => {
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChangeView(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white font-semibold text-slate-950 shadow-2xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.key === 'media' && mediaCount > 0 && (
                    <span className="rounded-full bg-teal-100 px-1.5 font-mono text-[10px] font-bold text-teal-800 dark:bg-teal-900/70 dark:text-teal-200">
                      {mediaCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* B) Detailtiefe (Progressive Disclosure – 3 Stufen) */}
          {showDetailSwitcher && (
            <div
              role="group"
              aria-label="Detailtiefe"
              title="Detailtiefe der Knoten umschalten (Stufe 1 Kompakt → Stufe 3 Deep Dive)"
              className="hidden md:inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800/80"
            >
              <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Tiefe
              </span>
              {(
                [
                  { level: 1, label: '1 · Kompakt' },
                  { level: 2, label: '2 · Standard' },
                  { level: 3, label: '3 · Deep Dive' },
                ] as const
              ).map((d) => (
                <button
                  key={d.level}
                  type="button"
                  onClick={() => onChangeDetailLevel(d.level)}
                  aria-pressed={detailLevel === d.level}
                  className={`rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                    detailLevel === d.level
                      ? 'bg-slate-900 text-white dark:bg-blue-600'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone 2: Global Mode Toggle (Präsentation vs. Bearbeiten) + Export + Import */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Prominent Global Mode Switcher */}
          <div
            role="group"
            aria-label="Globaler Modus"
            className={`inline-flex items-center rounded-lg border p-0.5 shadow-2xs ${
              isEditMode
                ? 'border-amber-400 bg-amber-100/80 dark:border-amber-600 dark:bg-amber-950/60'
                : 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => onChangeAppMode('presentation')}
              aria-pressed={!isEditMode}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                !isEditMode
                  ? 'bg-slate-900 text-white shadow-2xs dark:bg-blue-600'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-300'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Präsentation</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeAppMode('edit')}
              aria-pressed={isEditMode}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                isEditMode
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-300'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Bearbeiten</span>
              {changeCount > 0 && (
                <span className="rounded-full bg-white/80 px-1.5 font-mono text-[10px] font-bold text-slate-900">
                  {changeCount}
                </span>
              )}
            </button>
          </div>

          {/* Integrity Status Pill */}
          <button
            type="button"
            onClick={onToggleIntegrity}
            title="Daten-Integritätsbericht anzeigen"
            className={`hidden 2xl:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              hasErrors
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                : hasWarnings
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200'
            }`}
          >
            {hasErrors ? (
              <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
            <span className="tabular-nums">
              {hasErrors
                ? `${report.errorCount} Fehler`
                : `${report.stats.rseCount} RSE · ${report.stats.eventCount} Ev. · 0 Fehler`}
            </span>
          </button>

          {/* Export / Import Dropdown */}
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((p) => !p)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-10 z-50 w-76 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Speichern & Exportieren
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    onExportXlsx();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Änderungen als .xlsx exportieren
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Aktualisiertes 13-Blatt-Workbook inkl. Medien_Ref
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    onExportZip();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Archive className="mt-0.5 h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Projektpaket als ZIP (XLSX + media/)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inkl. {mediaCount} Fotos direkt unter public/media/
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    onExportJson();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <FileJson className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Projektpaket (JSON + Bilder) exportieren
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Kompletter Stand inkl. aller Bilder & Änderungen
                    </div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    jsonInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FolderUp className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>Projektpaket (JSON + Bilder) importieren...</span>
                </button>
                {changeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      if (
                        window.confirm(
                          'Alle lokalen Bearbeitungen verwerfen und wieder aus der Original-Excel laden?'
                        )
                      ) {
                        onResetLocalChanges();
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span>Auf Original-Excel zurücksetzen</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onJsonBackupImport(f);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onExcelFileSelected(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Excel laden</span>
          </button>
        </div>
      </div>

      {/* Subtle Edit Mode Banner Strip */}
      {isEditMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1 text-[11px] text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Pencil className="h-3 w-3 shrink-0" />
            <span>
              <strong>Bearbeitungsmodus aktiv:</strong> Alle Texte, ISEM-Farbcodes, Pfeile,
              Ursachen, Learnings & Fotos können direkt bearbeitet, hinzugefügt oder gelöscht
              werden (automatisch lokal in IndexedDB gesichert).
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChangeAppMode('presentation')}
            className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
          >
            Zurück zur Präsentation
          </button>
        </div>
      )}
    </header>
  );
};
