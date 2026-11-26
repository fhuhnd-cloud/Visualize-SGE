import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCcw, X } from 'lucide-react';

export type AspectPreset = 'free' | '4:3' | '3:4' | '16:9' | '9:16';

const ASPECT_PRESETS: { id: AspectPreset; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Frei', ratio: null },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

interface ImageCropModalProps {
  file: File | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
  onCancel,
  onConfirm,
}) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [preset, setPreset] = useState<AspectPreset>('free');

  // Normalized crop rectangle in [0..1] image coordinates
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  useEffect(() => {
    if (!file) {
      setImgUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setPreset('free');
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyAspectPreset = (nextPreset: AspectPreset, imgW = naturalSize.w, imgH = naturalSize.h) => {
    setPreset(nextPreset);
    const meta = ASPECT_PRESETS.find((p) => p.id === nextPreset);
    if (!meta || !meta.ratio || !imgW || !imgH) {
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      return;
    }
    // Compute largest centered rect in normalized coords matching target aspect ratio
    const imgRatio = imgW / imgH;
    const targetRatio = meta.ratio;
    let w = 1;
    let h = 1;
    if (imgRatio > targetRatio) {
      w = targetRatio / imgRatio;
      h = 1;
    } else {
      w = 1;
      h = imgRatio / targetRatio;
    }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  if (!file || !imgUrl) return null;

  const activeRatio = ASPECT_PRESETS.find((p) => p.id === preset)?.ratio ?? null;

  const startDrag = (
    e: React.MouseEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...crop },
    };

    const onMove = (me: MouseEvent) => {
      const dr = dragRef.current;
      const box = containerRef.current?.getBoundingClientRect();
      if (!dr || !box || box.width === 0 || box.height === 0) return;

      const dx = (me.clientX - dr.startX) / box.width;
      const dy = (me.clientY - dr.startY) / box.height;
      const o = dr.orig;
      const minSize = 0.08;

      if (dr.mode === 'move') {
        const nx = Math.min(1 - o.w, Math.max(0, o.x + dx));
        const ny = Math.min(1 - o.h, Math.max(0, o.y + dy));
        setCrop({ x: nx, y: ny, w: o.w, h: o.h });
        return;
      }

      let x = o.x;
      let y = o.y;
      let w = o.w;
      let h = o.h;

      if (dr.mode === 'se') {
        w = Math.max(minSize, Math.min(1 - o.x, o.w + dx));
        h = Math.max(minSize, Math.min(1 - o.y, o.h + dy));
      } else if (dr.mode === 'sw') {
        const nextX = Math.max(0, Math.min(o.x + o.w - minSize, o.x + dx));
        w = o.x + o.w - nextX;
        x = nextX;
        h = Math.max(minSize, Math.min(1 - o.y, o.h + dy));
      } else if (dr.mode === 'ne') {
        w = Math.max(minSize, Math.min(1 - o.x, o.w + dx));
        const nextY = Math.max(0, Math.min(o.y + o.h - minSize, o.y + dy));
        h = o.y + o.h - nextY;
        y = nextY;
      } else if (dr.mode === 'nw') {
        const nextX = Math.max(0, Math.min(o.x + o.w - minSize, o.x + dx));
        const nextY = Math.max(0, Math.min(o.y + o.h - minSize, o.y + dy));
        w = o.x + o.w - nextX;
        h = o.y + o.h - nextY;
        x = nextX;
        y = nextY;
      }

      if (activeRatio && naturalSize.w > 0 && naturalSize.h > 0) {
        const imgRatio = naturalSize.w / naturalSize.h;
        const desiredH = (w * imgRatio) / activeRatio;
        if (y + desiredH <= 1 && desiredH >= minSize) {
          h = desiredH;
        } else {
          h = Math.min(1 - y, Math.max(minSize, h));
          w = Math.min(1 - x, (h * activeRatio) / imgRatio);
        }
      }

      setCrop({ x, y, w, h });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleConfirmCrop = async () => {
    const img = new Image();
    img.src = imgUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const sx = Math.round(crop.x * img.naturalWidth);
    const sy = Math.round(crop.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(crop.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(crop.h * img.naturalHeight));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onConfirm(file);
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const outType = file.type === 'image/jpeg' ? 'image/jpeg' : file.type === 'image/webp' ? 'image/webp' : 'image/png';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onConfirm(file);
          return;
        }
        const croppedFile = new File([blob], file.name, { type: outType });
        onConfirm(croppedFile);
      },
      outType,
      0.92
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bild zuschneiden"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Crop className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Foto-Zuschnitt & Seitenverhältnis
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {file.name} · Darstellung erfolgt unbeschnitten (object-contain)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Aspect Ratio Preset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-semibold text-slate-500">Seitenverhältnis:</span>
            {ASPECT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyAspectPreset(p.id)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  preset === p.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setPreset('free');
              setCrop({ x: 0, y: 0, w: 1, h: 1 });
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            <RotateCcw className="h-3 w-3" />
            Vollbild
          </button>
        </div>

        {/* Interactive Crop Canvas Area */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950/90 p-5">
          <div ref={containerRef} className="relative inline-block select-none">
            <img
              src={imgUrl}
              alt="Zuschnitt-Vorschau"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              className="block max-h-[54vh] max-w-full object-contain"
            />

            {/* Dimmed outside mask via box-shadow trick */}
            <div
              onMouseDown={(e) => startDrag(e, 'move')}
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
              }}
              className="absolute cursor-move border-2 border-white"
            >
              {/* Rule-of-thirds guides */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-white/30" />
                <div className="border-r border-white/30" />
                <div />
              </div>

              {/* 4 Corner Resize Handles */}
              <div
                onMouseDown={(e) => startDrag(e, 'nw')}
                className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-blue-600 bg-white shadow"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'ne')}
                className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border-2 border-blue-600 bg-white shadow"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'sw')}
                className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full border-2 border-blue-600 bg-white shadow"
              />
              <div
                onMouseDown={(e) => startDrag(e, 'se')}
                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-blue-600 bg-white shadow"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {naturalSize.w > 0
              ? `Ausschnitt: ${Math.round(crop.w * naturalSize.w)} × ${Math.round(crop.h * naturalSize.h)} px`
              : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onConfirm(file)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Original unverändert
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Check className="h-3.5 w-3.5" />
              Zuschnitt übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
