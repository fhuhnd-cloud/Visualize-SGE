<<<<<<< HEAD
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
=======
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crop, Maximize, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

export type AspectPresetId = 'free' | '4:3' | '3:4' | '16:9' | '9:16';

interface AspectPreset {
  id: AspectPresetId;
  label: string;
  subLabel: string;
  ratio: number | null; // width / height
}

const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'free', label: 'Frei', subLabel: 'Original', ratio: null },
  { id: '4:3', label: '4:3', subLabel: 'Querformat', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', subLabel: 'Hochkant', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', subLabel: 'Querformat', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', subLabel: 'Hochkant', ratio: 9 / 16 },
];

/** Normalized crop rect in [0..1] relative to the natural image dimensions */
interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface ImageCropModalProps {
  file: File | null;
  title?: string;
  onConfirmCropped: (croppedFile: File) => void;
  onConfirmOriginal: (originalFile: File) => void;
  onCancel: () => void;
}

const MIN_CROP_SIZE = 0.08;
const MAX_OUTPUT_DIMENSION = 2400;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function fitMaxRectForRatio(
  natW: number,
  natH: number,
  targetRatio: number | null,
  scale = 1
): NormRect {
  const imgRatio = natW / Math.max(1, natH);
  let maxW = 1;
  let maxH = 1;
  if (targetRatio !== null) {
    if (imgRatio > targetRatio) {
      maxH = 1;
      maxW = targetRatio / imgRatio;
    } else {
      maxW = 1;
      maxH = imgRatio / targetRatio;
    }
  }
  const factor = clamp(1 / Math.max(1, scale), 0.15, 1);
  const w = clamp(maxW * factor, MIN_CROP_SIZE, 1);
  const h = clamp(maxH * factor, MIN_CROP_SIZE, 1);
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
<<<<<<< HEAD
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

=======
  title,
  onConfirmCropped,
  onConfirmOriginal,
  onCancel,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [preset, setPreset] = useState<AspectPresetId>('free');
  const [crop, setCrop] = useState<NormRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [isExporting, setIsExporting] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: DragHandle;
    startClientX: number;
    startClientY: number;
    startCrop: NormRect;
    stageRect: DOMRect;
  } | null>(null);

  const activePresetObj = useMemo(
    () => ASPECT_PRESETS.find((p) => p.id === preset) ?? ASPECT_PRESETS[0],
    [preset]
  );

  // Load object URL whenever file changes
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setNaturalSize(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setPreset('free');
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Escape key closes modal
  useEffect(() => {
    if (!file) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [file, onCancel]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    setNaturalSize({ w, h });
    setCrop(fitMaxRectForRatio(w, h, activePresetObj.ratio, 1));
  };

  const applyPreset = (nextId: AspectPresetId) => {
    setPreset(nextId);
    if (!naturalSize) return;
    const nextPreset = ASPECT_PRESETS.find((p) => p.id === nextId) ?? ASPECT_PRESETS[0];
    setCrop(fitMaxRectForRatio(naturalSize.w, naturalSize.h, nextPreset.ratio, 1));
  };

  // Compute equivalent zoom factor (1.0 = full max rect for current aspect, 3.0 = 3x zoomed in)
  const maxRect = useMemo(() => {
    if (!naturalSize) return { x: 0, y: 0, w: 1, h: 1 };
    return fitMaxRectForRatio(naturalSize.w, naturalSize.h, activePresetObj.ratio, 1);
  }, [naturalSize, activePresetObj.ratio]);

  const currentZoom = useMemo(() => {
    const ratioW = maxRect.w / Math.max(MIN_CROP_SIZE, crop.w);
    const ratioH = maxRect.h / Math.max(MIN_CROP_SIZE, crop.h);
    return clamp(Number(Math.min(ratioW, ratioH).toFixed(2)), 1, 3);
  }, [maxRect, crop.w, crop.h]);

  const handleZoomChange = (nextZoom: number) => {
    if (!naturalSize) return;
    const z = clamp(nextZoom, 1, 3);
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    const base = fitMaxRectForRatio(naturalSize.w, naturalSize.h, activePresetObj.ratio, z);
    const nx = clamp(cx - base.w / 2, 0, 1 - base.w);
    const ny = clamp(cy - base.h / 2, 0, 1 - base.h);
    setCrop({ x: nx, y: ny, w: base.w, h: base.h });
  };

  const startDrag = (handle: DragHandle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stageEl = stageRef.current;
    if (!stageEl) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCrop: { ...crop },
      stageRect: stageEl.getBoundingClientRect(),
    };
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !naturalSize) return;

      const dx = (e.clientX - drag.startClientX) / Math.max(1, drag.stageRect.width);
      const dy = (e.clientY - drag.startClientY) / Math.max(1, drag.stageRect.height);
      const s = drag.startCrop;
      const ratio = activePresetObj.ratio;
      const imgRatio = naturalSize.w / Math.max(1, naturalSize.h);

      if (drag.handle === 'move') {
        const nx = clamp(s.x + dx, 0, 1 - s.w);
        const ny = clamp(s.y + dy, 0, 1 - s.h);
        setCrop({ x: nx, y: ny, w: s.w, h: s.h });
        return;
      }

      // Free-form resizing
      if (ratio === null) {
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;

        if (drag.handle.includes('w')) left = clamp(s.x + dx, 0, right - MIN_CROP_SIZE);
        if (drag.handle.includes('e')) right = clamp(s.x + s.w + dx, left + MIN_CROP_SIZE, 1);
        if (drag.handle.includes('n')) top = clamp(s.y + dy, 0, bottom - MIN_CROP_SIZE);
        if (drag.handle.includes('s')) bottom = clamp(s.y + s.h + dy, top + MIN_CROP_SIZE, 1);

        setCrop({ x: left, y: top, w: right - left, h: bottom - top });
        return;
      }

      // Aspect-locked corner resizing
      // In normalized coords: (w * natW) / (h * natH) = ratio => h = w * (imgRatio / ratio)
      const normFactor = imgRatio / ratio; // h = w * normFactor
      const anchorX = drag.handle.includes('w') ? s.x + s.w : s.x;
      const anchorY = drag.handle.includes('n') ? s.y + s.h : s.y;

      const rawW = drag.handle.includes('w') ? s.w - dx : s.w + dx;
      const rawH = drag.handle.includes('n') ? s.h - dy : s.h + dy;

      // Pick dominant axis change
      const proposedW = Math.abs(dx) >= Math.abs(dy) ? rawW : rawH / normFactor;

      const maxAvailW = drag.handle.includes('w') ? anchorX : 1 - anchorX;
      const maxAvailH = drag.handle.includes('n') ? anchorY : 1 - anchorY;
      const maxWByBounds = Math.min(maxAvailW, maxAvailH / normFactor);
      const minW = Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE / normFactor);

      const nextW = clamp(proposedW, Math.min(minW, maxWByBounds), maxWByBounds);
      const nextH = nextW * normFactor;

      const nextX = drag.handle.includes('w') ? anchorX - nextW : anchorX;
      const nextY = drag.handle.includes('n') ? anchorY - nextH : anchorY;

      setCrop({
        x: clamp(nextX, 0, 1 - nextW),
        y: clamp(nextY, 0, 1 - nextH),
        w: nextW,
        h: nextH,
      });
    },
    [activePresetObj.ratio, naturalSize]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const pixelPreview = useMemo(() => {
    if (!naturalSize) return { w: 0, h: 0 };
    return {
      w: Math.max(1, Math.round(crop.w * naturalSize.w)),
      h: Math.max(1, Math.round(crop.h * naturalSize.h)),
    };
  }, [crop, naturalSize]);

  const handleConfirmCrop = async () => {
    if (!file || !imgRef.current || !naturalSize) return;
    setIsExporting(true);
    try {
      const sx = Math.round(crop.x * naturalSize.w);
      const sy = Math.round(crop.y * naturalSize.h);
      const sw = Math.max(1, Math.round(crop.w * naturalSize.w));
      const sh = Math.max(1, Math.round(crop.h * naturalSize.h));

      let outW = sw;
      let outH = sh;
      if (Math.max(outW, outH) > MAX_OUTPUT_DIMENSION) {
        const scale = MAX_OUTPUT_DIMENSION / Math.max(outW, outH);
        outW = Math.max(1, Math.round(outW * scale));
        outH = Math.max(1, Math.round(outH * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outW, outH);

      const toBlobAsync = (mime: string, quality?: number) =>
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

      let blob = await toBlobAsync('image/webp', 0.92);
      let mime = 'image/webp';
      let ext = 'webp';

      if (!blob || blob.type !== 'image/webp') {
        blob = await toBlobAsync('image/png');
        mime = 'image/png';
        ext = 'png';
      }
      if (!blob) throw new Error('Bildzuschnitt konnte nicht exportiert werden.');

      const baseStem = file.name.replace(/\.[^.]+$/, '') || 'bild';
      const croppedFile = new File([blob], `${baseStem}.${ext}`, {
        type: mime,
        lastModified: Date.now(),
      });
      onConfirmCropped(croppedFile);
    } finally {
      setIsExporting(false);
    }
  };

  if (!file || !objectUrl) return null;

>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bild zuschneiden"
      onClick={onCancel}
<<<<<<< HEAD
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
=======
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Crop className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                Bild zuschneiden {title ? `· ${title}` : ''}
              </h3>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                Auswahlrahmen ziehen oder Ecken anpassen – Seitenverhältnis bleibt nach dem
                Speichern überall erhalten.
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
<<<<<<< HEAD
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800"
=======
            aria-label="Dialog schließen"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800"
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
          >
            <X className="h-4 w-4" />
          </button>
        </div>

<<<<<<< HEAD
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
=======
        {/* Preset & Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
          {/* Aspect Ratio Presets */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Seitenverhältnis">
            {ASPECT_PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] font-normal ${
                      active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'
                    }`}
                  >
                    {p.subLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleZoomChange(currentZoom - 0.2)}
              title="Herauszoomen"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={currentZoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              aria-label="Ausschnitt-Zoom"
              className="h-1.5 w-24 cursor-pointer accent-blue-600"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(currentZoom + 0.2)}
              title="Hineinzoomen"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[38px] text-right font-mono text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {Math.round(currentZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => applyPreset(preset)}
              title="Auswahl zurücksetzen"
              className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Crop Stage */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-950 p-4 select-none">
          <div
            ref={stageRef}
            className="relative inline-block max-h-[54vh] max-w-full overflow-hidden rounded-md shadow-lg"
          >
            <img
              ref={imgRef}
              src={objectUrl}
              alt="Zuschnitt-Vorschau"
              onLoad={handleImageLoad}
              draggable={false}
              className="block max-h-[54vh] max-w-full object-contain pointer-events-none select-none"
            />

            {/* Darkened outside masks */}
            {naturalSize && (
              <>
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 bg-slate-950/65"
                  style={{ height: `${crop.y * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 bg-slate-950/65"
                  style={{ top: `${(crop.y + crop.h) * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute left-0 bg-slate-950/65"
                  style={{
                    top: `${crop.y * 100}%`,
                    height: `${crop.h * 100}%`,
                    width: `${crop.x * 100}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute right-0 bg-slate-950/65"
                  style={{
                    top: `${crop.y * 100}%`,
                    height: `${crop.h * 100}%`,
                    left: `${(crop.x + crop.w) * 100}%`,
                  }}
                />

                {/* Interactive Selection Frame */}
                <div
                  onPointerDown={(e) => startDrag('move', e)}
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.5)]"
                >
                  {/* Rule-of-thirds grid */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    <div className="border-b border-r border-white/35" />
                    <div className="border-b border-r border-white/35" />
                    <div className="border-b border-white/35" />
                    <div className="border-b border-r border-white/35" />
                    <div className="border-b border-r border-white/35" />
                    <div className="border-b border-white/35" />
                    <div className="border-r border-white/35" />
                    <div className="border-r border-white/35" />
                    <div />
                  </div>

                  {/* Corner Handles */}
                  {(
                    [
                      { id: 'nw', cls: '-left-1.5 -top-1.5 cursor-nwse-resize' },
                      { id: 'ne', cls: '-right-1.5 -top-1.5 cursor-nesw-resize' },
                      { id: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
                      { id: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
                    ] as const
                  ).map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => startDrag(h.id, e)}
                      className={`absolute h-3.5 w-3.5 rounded-xs border-2 border-blue-600 bg-white shadow ${h.cls}`}
                    />
                  ))}

                  {/* Edge Handles in Free Mode */}
                  {preset === 'free' && (
                    <>
                      <div
                        onPointerDown={(e) => startDrag('n', e)}
                        className="absolute -top-1 left-1/2 h-2 w-7 -translate-x-1/2 cursor-ns-resize rounded-full bg-white/95 shadow"
                      />
                      <div
                        onPointerDown={(e) => startDrag('s', e)}
                        className="absolute -bottom-1 left-1/2 h-2 w-7 -translate-x-1/2 cursor-ns-resize rounded-full bg-white/95 shadow"
                      />
                      <div
                        onPointerDown={(e) => startDrag('w', e)}
                        className="absolute -left-1 top-1/2 h-7 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white/95 shadow"
                      />
                      <div
                        onPointerDown={(e) => startDrag('e', e)}
                        className="absolute -right-1 top-1/2 h-7 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white/95 shadow"
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Info & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/70">
          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {naturalSize ? (
              <>
                Ausschnitt: <strong className="text-slate-800 dark:text-slate-200">{pixelPreview.w} × {pixelPreview.h} px</strong>
                <span className="mx-1.5">·</span>
                Original: {naturalSize.w} × {naturalSize.h} px
              </>
            ) : (
              'Lade Bild...'
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => onConfirmOriginal(file)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Maximize className="h-3.5 w-3.5" />
              <span>Ohne Zuschnitt übernehmen</span>
            </button>
            <button
              type="button"
              disabled={isExporting || !naturalSize}
              onClick={handleConfirmCrop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Verarbeite...' : 'Zugeschnitten übernehmen'}</span>
>>>>>>> 047646faa5baf450ac596cda3087ec439f59bc17
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
