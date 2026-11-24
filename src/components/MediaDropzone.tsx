import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, ZoomIn } from 'lucide-react';
import { MediaAttachment } from '../types/sge';
import { LightboxPayload } from './LightboxModal';

interface MediaDropzoneProps {
  /** Stable lookup key (e.g. "media/RH_01.png" or "event:EV001") */
  refKey: string;
  /** Displayed Excel Medien_Ref path if present */
  mediaRefLabel?: string;
  /** Short title for Lightbox */
  title: string;
  attachment?: MediaAttachment;
  compact?: boolean;
  onUploadFile: (refKey: string, file: File) => void;
  onUpdateCaption: (refKey: string, caption: string) => void;
  onDelete: (refKey: string) => void;
  onOpenLightbox: (payload: LightboxPayload) => void;
}

export const MediaDropzone: React.FC<MediaDropzoneProps> = ({
  refKey,
  mediaRefLabel,
  title,
  attachment,
  compact = false,
  onUploadFile,
  onUpdateCaption,
  onDelete,
  onOpenLightbox,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [publicImageOk, setPublicImageOk] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(attachment?.caption ?? '');

  useEffect(() => {
    setCaptionDraft(attachment?.caption ?? '');
  }, [attachment?.caption]);

  // Check if a static file already exists under public/media/... when no local IndexedDB upload overrides it
  const publicUrl =
    !attachment && mediaRefLabel && mediaRefLabel.startsWith('media/')
      ? `/${mediaRefLabel}`
      : null;

  useEffect(() => {
    setPublicImageOk(false);
    if (!publicUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setPublicImageOk(true);
    };
    img.onerror = () => {
      if (!cancelled) setPublicImageOk(false);
    };
    img.src = publicUrl;
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      return;
    }
    onUploadFile(refKey, file);
  };

  const activeSrc = attachment?.dataUrl || (publicImageOk && publicUrl ? publicUrl : null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40'
          : activeSrc
            ? 'border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-900/70'
            : 'border-dashed border-slate-300 bg-slate-50/70 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {activeSrc ? (
        <div className={compact ? 'p-2' : 'p-2.5'}>
          <div className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-950/5 dark:border-slate-700">
            <img
              src={activeSrc}
              alt={attachment?.caption || title}
              onClick={() =>
                onOpenLightbox({
                  src: activeSrc,
                  title,
                  caption: attachment?.caption || undefined,
                  refPath: mediaRefLabel || attachment?.fileName,
                })
              }
              className={`w-full cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-[1.02] ${
                compact ? 'h-28' : 'h-40'
              }`}
            />
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() =>
                  onOpenLightbox({
                    src: activeSrc,
                    title,
                    caption: attachment?.caption || undefined,
                    refPath: mediaRefLabel || attachment?.fileName,
                  })
                }
                title="In Lightbox vergrößern"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-900"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                title="Foto ersetzen"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-900"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              {attachment && (
                <button
                  type="button"
                  onClick={() => onDelete(refKey)}
                  title="Foto entfernen"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {attachment && (
              <input
                type="text"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onBlur={() => {
                  if (captionDraft !== attachment.caption) {
                    onUpdateCaption(refKey, captionDraft);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Bildunterschrift hinzufügen..."
                className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="truncate font-mono" title={mediaRefLabel || attachment?.fileName}>
                {mediaRefLabel || `media/${attachment?.fileName}`}
              </span>
              {attachment && (
                <span className="shrink-0 tabular-nums">
                  {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex w-full items-center gap-2.5 text-left transition-colors ${
            compact ? 'px-2.5 py-2' : 'flex-col justify-center px-3 py-4 text-center'
          }`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <ImagePlus className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
              Foto hier ablegen oder auswählen
            </div>
            <div className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {mediaRefLabel || 'PNG, JPG, WebP'}
            </div>
          </div>
        </button>
      )}
    </div>
  );
};
