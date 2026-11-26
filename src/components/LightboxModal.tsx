import React, { useEffect } from 'react';
import { Download, X } from 'lucide-react';

export interface LightboxPayload {
  src: string;
  title: string;
  caption?: string;
  refPath?: string;
}

interface LightboxModalProps {
  item: LightboxPayload | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ item, onClose }) => {
  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bildvorschau: ${item.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3 text-slate-100">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{item.title}</div>
            {item.refPath && (
              <div className="truncate font-mono text-[11px] text-slate-400">
                {item.refPath}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={item.src}
              download={item.refPath?.split('/').pop() || 'duckomat_foto.png'}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Speichern</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Lightbox schließen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
          <img
            src={item.src}
            alt={item.caption || item.title}
            className="max-h-[74vh] max-w-full rounded object-contain"
          />
        </div>

        {item.caption && (
          <div className="border-t border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-200">
            {item.caption}
          </div>
        )}
      </div>
    </div>
  );
};
