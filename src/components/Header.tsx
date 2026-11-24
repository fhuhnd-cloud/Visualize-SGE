import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderUp,
  Moon,
  Sun,
  Upload,
} from 'lucide-react';
import { IntegrityReport, WorkspaceView } from '../types/sge';

interface HeaderProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  report: IntegrityReport;
  integrityOpen: boolean;
  onToggleIntegrity: () => void;
  mediaCount: number;
  editCount: number;
  onExcelFileSelected: (file: File) => void;
  onJsonBackupImport: (file: File) => void;
  onExportZip: () => void;
  onExportXlsx: () => void;
  onExportJson: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  report,
  integrityOpen,
  onToggleIntegrity,
  mediaCount,
  editCount,
  onExcelFileSelected,
  onJsonBackupImport,
  onExportZip,
  onExportXlsx,
  onExportJson,
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

  const navItems: { key: WorkspaceView; label: string }[] = [
    { key: 'swimlane', label: 'SGE-Swimlanes' },
    { key: 'matrix', label: '48×7 Matrix' },
    { key: 'media', label: 'KOMBI & Fotos' },
    { key: 'causal', label: 'Kausalgraph' },
    { key: 'tables', label: '13 Tabellen' },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Left: Brand & View Navigation */}
      <div className="flex items-center gap-6 min-w-0">
        <button
          type="button"
          onClick={() => onChangeView('swimlane')}
          className="flex items-center gap-2 text-left text-[16px] font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-80 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          <svg
            width="22"
            height="22"
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

        <nav aria-label="Hauptnavigation" className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChangeView(item.key)}
                className={`relative rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-100 font-semibold text-slate-950 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {item.key === 'media' && mediaCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                    {mediaCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Integrity Status Badge + Export + Import + Theme */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Compact Integrity Badge */}
        <button
          type="button"
          onClick={onToggleIntegrity}
          aria-expanded={integrityOpen}
          title="Daten-Integritätsbericht anzeigen"
          className={`hidden xl:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
            hasErrors
              ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
              : hasWarnings
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200'
          }`}
        >
          {hasErrors ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="tabular-nums">
            {hasErrors
              ? `Integrität: ${report.errorCount} Fehler`
              : `Datenmodell konsistent: ${report.stats.rseCount} RSE, ${report.stats.eventCount} Events, 0 Fehler`}
          </span>
        </button>

        {/* Export / Persistenz Dropdown */}
        <div ref={exportMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((p) => !p)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Export</span>
            {(mediaCount > 0 || editCount > 0) && (
              <span className="rounded bg-blue-100 px-1 py-0.2 font-mono text-[10px] font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-200">
                {mediaCount + editCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Projektpaket & Sicherung
              </div>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportZip();
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Archive className="mt-0.5 h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    ZIP-Projektpaket (XLSX + media/)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aktualisierte .xlsx + {mediaCount} Fotos in public/media/
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExportXlsx();
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Aktualisierte .xlsx (13 Blätter)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Inkl. aller Text-, Status- & Medien_Ref-Änderungen
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
                <FileJson className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    JSON-Backup exportieren
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Portables Backup inkl. Bilder & Farbpalette
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderUp className="h-4 w-4 text-slate-500 shrink-0" />
                <span>JSON-Backup wiederherstellen...</span>
              </button>
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

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Primary CTA: Excel Import */}
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
    </header>
  );
};
