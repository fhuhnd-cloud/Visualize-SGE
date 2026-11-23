import React, { useRef } from 'react';
import { Download, Moon, Sun, Upload } from 'lucide-react';

export type WorkspaceView = 'graph' | 'tables';

interface HeaderProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onFileSelected: (file: File) => void;
  onExportTemplate: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  onFileSelected,
  onExportTemplate,
  darkMode,
  onToggleDarkMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset input so selecting the exact same updated file again triggers onChange
    e.target.value = '';
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900">
      {/* Zone 1: Single-line brand wordmark */}
      <button
        type="button"
        onClick={() => onChangeView('graph')}
        className="flex items-center gap-2.5 text-left text-[17px] font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-100 whitespace-nowrap shrink-0"
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
      </button>

      {/* Zone 2: Concise single-line navigation & utilities */}
      <nav aria-label="Hauptnavigation" className="flex items-center gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => onChangeView('graph')}
          className={`relative py-1 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${
            activeView === 'graph'
              ? 'text-slate-950 font-semibold dark:text-white after:absolute after:inset-x-0 after:-bottom-[15px] after:h-[2px] after:bg-blue-600 dark:after:bg-blue-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          Graph-Matrix
        </button>

        <button
          type="button"
          onClick={() => onChangeView('tables')}
          className={`relative py-1 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${
            activeView === 'tables'
              ? 'text-slate-950 font-semibold dark:text-white after:absolute after:inset-x-0 after:-bottom-[15px] after:h-[2px] after:bg-blue-600 dark:after:bg-blue-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          Datentabellen
        </button>

        <button
          type="button"
          onClick={onExportTemplate}
          className="hidden sm:inline-flex items-center gap-1.5 py-1 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          title="Aktuellen Stand als strukturierte .xlsx-Datei herunterladen"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Vorlage (.xlsx)</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="inline-flex items-center gap-1.5 py-1 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          aria-label={darkMode ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
          title={darkMode ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden md:inline">{darkMode ? 'Hell' : 'Dunkel'}</span>
        </button>
      </nav>

      {/* Zone 3: Single primary CTA */}
      <div className="flex items-center shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Excel-Datei (.xlsx) auswählen"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Excel laden</span>
        </button>
      </div>
    </header>
  );
};
