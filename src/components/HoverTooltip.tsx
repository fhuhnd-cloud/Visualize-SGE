import React from 'react';
import { FlaskConical } from 'lucide-react';
import { PaletteSwatch } from '../types/sge';

export interface HoverTooltipData {
  x: number;
  y: number;
  badge?: string;
  badgeSwatch?: PaletteSwatch;
  title: string;
  subtitle?: string;
  description?: string;
  rationale?: string;
  causeLabel?: string;
  previewImageUrl?: string;
}

interface HoverTooltipProps {
  data: HoverTooltipData | null;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({ data }) => {
  if (!data) return null;

  // Keep tooltip safely inside viewport bounds
  const maxWidth = 310;
  const left = Math.min(window.innerWidth - maxWidth - 16, Math.max(12, data.x + 14));
  const top = Math.min(window.innerHeight - 240, Math.max(12, data.y + 14));

  return (
    <div
      style={{ left, top, width: maxWidth }}
      className="pointer-events-none fixed z-50 rounded-xl border border-slate-200 bg-white/98 p-3 text-xs shadow-xl backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/98"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold leading-snug text-slate-900 dark:text-white">
          {data.title}
        </div>
        {data.badge && (
          <span
            style={
              data.badgeSwatch
                ? {
                    backgroundColor: data.badgeSwatch.bg,
                    borderColor: data.badgeSwatch.border,
                    color: data.badgeSwatch.text,
                    borderStyle: data.badgeSwatch.dashed ? 'dashed' : 'solid',
                  }
                : undefined
            }
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold shrink-0"
          >
            {data.badge}
          </span>
        )}
      </div>

      {data.subtitle && (
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {data.subtitle}
        </div>
      )}

      {data.description && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200 line-clamp-3">
          {data.description}
        </p>
      )}

      {data.rationale && (
        <p className="mt-1 border-t border-slate-100 pt-1 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300 line-clamp-3">
          <strong className="text-slate-500">Begründung:</strong> {data.rationale}
        </p>
      )}

      {data.causeLabel && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50/90 px-2 py-1 text-[10px] font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <FlaskConical className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{data.causeLabel}</span>
        </div>
      )}

      {data.previewImageUrl && (
<<<<<<< HEAD
        <div className="mt-2 flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-950">
          <img
            src={data.previewImageUrl}
            alt={data.title}
            className="max-h-28 w-full object-contain"
=======
        <div className="mt-2 flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/70">
          <img
            src={data.previewImageUrl}
            alt={data.title}
            className="mx-auto block max-h-40 w-auto max-w-full rounded-xs object-contain"
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
          />
        </div>
      )}
    </div>
  );
};
