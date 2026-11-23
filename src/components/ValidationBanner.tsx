import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { ValidationReport } from '../types/duckomat';

interface ValidationBannerProps {
  sourceName: string;
  isSample: boolean;
  report: ValidationReport;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectStepId: (stepId: string) => void;
  onResetToSample: () => void;
  stepIdsSet: Set<string>;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  sourceName,
  isSample,
  report,
  isExpanded,
  onToggleExpand,
  onSelectStepId,
  onResetToSample,
  stepIdsSet,
}) => {
  const hasErrors = report.errorCount > 0;
  const hasWarnings = report.warningCount > 0;

  const toneClasses = hasErrors
    ? 'border-red-200 bg-red-50/85 text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200'
    : hasWarnings
      ? 'border-amber-200 bg-amber-50/85 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200'
      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300';

  return (
    <section
      aria-label="Datenintegrität und Diagnose"
      className={`border-b text-xs transition-colors ${toneClasses}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="truncate max-w-[280px]" title={sourceName}>
              {sourceName}
            </span>
          </div>

          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>

          <div className="flex flex-wrap items-center gap-2 text-slate-600 tabular-nums dark:text-slate-400">
            <span>{report.stats.phaseCount} Phasen ({report.stats.milestoneCount} Meilensteine)</span>
            <span aria-hidden="true">/</span>
            <span>
              {report.stats.stepCount} Schritte ({report.stats.finalStepCount} Final)
            </span>
            <span aria-hidden="true">/</span>
            <span>{report.stats.arrowCount} Pfeile</span>
            <span aria-hidden="true">/</span>
            <span>{report.stats.causeCount} Befunde</span>
            <span aria-hidden="true">/</span>
            <span>{report.stats.microIterationCount} Mikro-Iterationen</span>
            <span aria-hidden="true">/</span>
            <span>{report.stats.learningCount} Learnings</span>
          </div>

          <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-700">
            ·
          </span>

          <div className="flex items-center gap-1.5 font-medium">
            {hasErrors ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span>
                  {report.errorCount} Fehler
                  {hasWarnings
                    ? `, ${report.warningCount} ${report.warningCount === 1 ? 'Hinweis' : 'Hinweise'}`
                    : ''}
                </span>
              </>
            ) : hasWarnings ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {report.warningCount}{' '}
                  {report.warningCount === 1 ? 'Datenhinweis' : 'Datenhinweise'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-emerald-800 dark:text-emerald-300">
                  6-Blatt-Integrität geprüft (0 Fehler)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isSample && (
            <button
              type="button"
              onClick={onResetToSample}
              className="inline-flex items-center gap-1 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Beispieldaten laden</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-1 font-medium text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-200 dark:hover:text-white whitespace-nowrap shrink-0"
          >
            <span>
              {isExpanded
                ? 'Diagnose ausblenden'
                : report.issues.length > 0
                  ? `Diagnose anzeigen (${report.issues.length})`
                  : 'Prüfdetails'}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-56 overflow-y-auto border-t border-slate-200/80 bg-white/95 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/90">
          {report.issues.length === 0 ? (
            <div className="text-slate-600 dark:text-slate-400">
              Alle sechs Tabellenblätter (`Phasen_Konfiguration`, `Entwicklungsschritte`,
              `Ursachen_Tests_Befunde`, `Verbindungen_Pfeile`, `Mikro_Iterationen`,
              `Methodik_Learnings`) sowie alle Verknüpfungen sind konsistent. Geprüft um{' '}
              {report.checkedAt}.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {report.issues.map((issue) => {
                const isClickableStep =
                  issue.referenceId && stepIdsSet.has(issue.referenceId);
                return (
                  <li
                    key={issue.id}
                    className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2.5">
                      {issue.severity === 'error' ? (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-900 dark:text-slate-100">
                          <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {issue.sheet}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span className="font-medium">{issue.message}</span>
                        </div>
                        {issue.hint && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {issue.hint}
                          </p>
                        )}
                      </div>
                    </div>

                    {isClickableStep && issue.referenceId && (
                      <button
                        type="button"
                        onClick={() => onSelectStepId(issue.referenceId!)}
                        className="rounded border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/50 whitespace-nowrap shrink-0"
                      >
                        {issue.referenceId} fokussieren
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
