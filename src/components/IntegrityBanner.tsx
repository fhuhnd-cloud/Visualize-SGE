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
import { IntegrityReport } from '../types/sge';

interface IntegrityBannerProps {
  sourceName: string;
  isBundledDefault: boolean;
  report: IntegrityReport;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReloadDefault: () => void;
  onJumpToRse?: (rseId: string) => void;
  rseIdSet: Set<string>;
}

export const IntegrityBanner: React.FC<IntegrityBannerProps> = ({
  sourceName,
  isBundledDefault,
  report,
  isExpanded,
  onToggleExpand,
  onReloadDefault,
  onJumpToRse,
  rseIdSet,
}) => {
  const hasErrors = report.errorCount > 0;
  const hasWarnings = report.warningCount > 0;

  // Compact strip shown always on smaller screens or when expanded / has issues
  return (
    <section
      aria-label="Datenintegrität"
      className={`border-b text-xs transition-colors ${
        hasErrors
          ? 'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200'
          : hasWarnings
            ? 'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200'
            : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="max-w-[260px] truncate" title={sourceName}>
              {sourceName}
            </span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
            {report.sheetsDetected}/13 Blätter · {report.stats.laneCount} Spuren ·{' '}
            {report.stats.versionCount} Versionen · {report.stats.rseCount} RSE ·{' '}
            {report.stats.eventCount} Events · {report.stats.kombiCount} KOMBI ·{' '}
            {report.stats.microIterationCount} Mikro-It.
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
          <span className="inline-flex items-center gap-1 font-medium">
            {hasErrors ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                <span>{report.errorCount} Fremdschlüssel-Fehler</span>
              </>
            ) : hasWarnings ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>{report.warningCount} Hinweise</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-800 dark:text-emerald-300">
                  Datenmodell konsistent: {report.stats.rseCount} RSE, {report.stats.eventCount}{' '}
                  Events, 0 Fehler
                </span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isBundledDefault && (
            <button
              type="button"
              onClick={onReloadDefault}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Standard-v14 laden</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            <span>
              {isExpanded
                ? 'Prüfdetails ausblenden'
                : report.issues.length > 0
                  ? `Prüfdetails (${report.issues.length})`
                  : 'Integritäts-Check'}
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
        <div className="max-h-56 overflow-y-auto border-t border-slate-200/80 bg-white/95 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/90">
          {report.issues.length === 0 ? (
            <div className="space-y-1 text-slate-600 dark:text-slate-400">
              <div className="font-medium text-emerald-800 dark:text-emerald-300">
                Alle Fremdschlüssel (RSE_ID, Ursache_ID, Schritt_ID, Kombi_ID) und Primärschlüssel
                über alle {report.sheetsDetected} Tabellenblätter sind konsistent.
              </div>
              <div className="text-[11px] tabular-nums">
                Geprüft um {report.checkedAt}: {report.stats.rseCount} RSE ·{' '}
                {report.stats.eventCount} RSE_Phasenwechsel · {report.stats.kombiCount}{' '}
                Bauteil_Integrationen · {report.stats.microIterationCount} Mikro_Iterationen ·{' '}
                {report.stats.stepCount}{' '}
                Entwicklungsschritte · {report.stats.causeCount} Ursachen ·{' '}
                {report.stats.arrowCount} Pfeile · {report.stats.learningCount} Learnings ·{' '}
                {report.stats.preDimCount} Dimensionierungsparameter.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {report.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    {issue.severity === 'error' ? (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {issue.sheet}
                        </span>
                        {issue.foreignKeyType && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            FK: {issue.foreignKeyType}
                          </span>
                        )}
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {issue.message}
                        </span>
                      </div>
                      {issue.hint && (
                        <p className="mt-0.5 text-[11px] text-slate-500">{issue.hint}</p>
                      )}
                    </div>
                  </div>
                  {onJumpToRse && issue.referenceId && rseIdSet.has(issue.referenceId) && (
                    <button
                      type="button"
                      onClick={() => onJumpToRse(issue.referenceId!)}
                      className="rounded border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 shrink-0"
                    >
                      {issue.referenceId}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
