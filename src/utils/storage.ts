import {
  CustomPalette,
  MediaAttachment,
  ProjectEditsOverlay,
  SgeDataset,
} from '../types/sge';
import { buildUpdatedWorkbookBytes } from './excelParser';
import { DEFAULT_SGE_PALETTE } from './sgeVisualConfig';

const DB_NAME = 'duckomat_sge_v14_db';
const DB_VERSION = 1;
const MEDIA_STORE = 'media_attachments';

const EDITS_STORAGE_KEY = 'duckomat_sge_v14_edits';
const PALETTE_STORAGE_KEY = 'duckomat_sge_v14_palette';

export function createEmptyEdits(): ProjectEditsOverlay {
  return {
    events: {},
    microIterations: {},
    kombis: {},
    updatedAt: new Date().toISOString(),
  };
}

export function loadEditsFromLocalStorage(): ProjectEditsOverlay {
  try {
    const raw = localStorage.getItem(EDITS_STORAGE_KEY);
    if (!raw) return createEmptyEdits();
    const parsed = JSON.parse(raw) as Partial<ProjectEditsOverlay>;
    return {
      events: parsed.events ?? {},
      microIterations: parsed.microIterations ?? {},
      kombis: parsed.kombis ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return createEmptyEdits();
  }
}

export function saveEditsToLocalStorage(edits: ProjectEditsOverlay): void {
  try {
    localStorage.setItem(EDITS_STORAGE_KEY, JSON.stringify(edits));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadPaletteFromLocalStorage(): CustomPalette {
  try {
    const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (!raw) return DEFAULT_SGE_PALETTE;
    const parsed = JSON.parse(raw) as Partial<CustomPalette>;
    return {
      BASE: { ...DEFAULT_SGE_PALETTE.BASE, ...parsed.BASE },
      CV: { ...DEFAULT_SGE_PALETTE.CV, ...parsed.CV },
      NEW: { ...DEFAULT_SGE_PALETTE.NEW, ...parsed.NEW },
      EC: { ...DEFAULT_SGE_PALETTE.EC, ...parsed.EC },
      UD: { ...DEFAULT_SGE_PALETTE.UD, ...parsed.UD },
      REM: { ...DEFAULT_SGE_PALETTE.REM, ...parsed.REM },
      KOMBI: { ...DEFAULT_SGE_PALETTE.KOMBI, ...parsed.KOMBI },
    };
  } catch {
    return DEFAULT_SGE_PALETTE;
  }
}

export function savePaletteToLocalStorage(palette: CustomPalette): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // Ignore
  }
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'refKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllMediaFromIndexedDb(): Promise<Record<string, MediaAttachment>> {
  try {
    const db = await openMediaDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<string, MediaAttachment> = {};
        for (const item of (req.result as MediaAttachment[]) ?? []) {
          result[item.refKey] = item;
        }
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveMediaToIndexedDb(item: MediaAttachment): Promise<void> {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteMediaFromIndexedDb(refKey: string): Promise<void> {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(refKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllMediaInIndexedDb(): Promise<void> {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Reads an uploaded File into a MediaAttachment object. */
export function readImageFileAsAttachment(
  file: File,
  refKey: string,
  existingCaption = ''
): Promise<MediaAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        refKey,
        fileName: file.name,
        mimeType: file.type || 'image/png',
        dataUrl: String(reader.result || ''),
        caption: existingCaption,
        sizeBytes: file.size,
        updatedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => reject(new Error('Bilddatei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export interface ProjectJsonBackup {
  format: 'duckomat-sge-v14-package';
  exportedAt: string;
  sourceName: string;
  edits: ProjectEditsOverlay;
  palette: CustomPalette;
  media: Record<string, MediaAttachment>;
}

/** Export portable JSON package containing all edits, custom palette, and uploaded images. */
export function downloadProjectJsonBackup(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay,
  palette: CustomPalette,
  mediaMap: Record<string, MediaAttachment>
): void {
  const payload: ProjectJsonBackup = {
    format: 'duckomat-sge-v14-package',
    exportedAt: new Date().toISOString(),
    sourceName: dataset.sourceName,
    edits,
    palette,
    media: mediaMap,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, 'Duckomat_SGE_Projektpaket.json');
}

export async function parseProjectJsonBackup(file: File): Promise<ProjectJsonBackup> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<ProjectJsonBackup>;
  if (parsed.format !== 'duckomat-sge-v14-package') {
    throw new Error('Ungültiges Projektpaket-Format (erwartet: duckomat-sge-v14-package).');
  }
  return {
    format: 'duckomat-sge-v14-package',
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    sourceName: parsed.sourceName ?? '',
    edits: parsed.edits ?? createEmptyEdits(),
    palette: parsed.palette ?? DEFAULT_SGE_PALETTE,
    media: parsed.media ?? {},
  };
}

// ---------------------------------------------------------------------------
// Minimal standards-compliant ZIP writer (STORE / method 0 with IEEE CRC32)
// Allows zero-dependency bundling of updated .xlsx + project_state.json + public/media/*
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return new Uint8Array(0);
  const b64 = dataUrl.slice(commaIdx + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

interface ZipEntryInput {
  path: string;
  data: Uint8Array;
}

function createZipArchive(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // compression: STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob(
    [
      ...localParts.map((p) => p.buffer as ArrayBuffer),
      ...centralParts.map((p) => p.buffer as ArrayBuffer),
      eocd.buffer as ArrayBuffer,
    ],
    { type: 'application/zip' }
  );
}

/**
 * Exports a complete ZIP project package containing:
 * - Duckomat_Entwicklungsdatenbank_v14_aktualisiert.xlsx
 * - project_state.json
 * - public/media/<files> (ready to unpack directly into the repository)
 */
export function downloadProjectZipPackage(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay,
  palette: CustomPalette,
  mediaMap: Record<string, MediaAttachment>
): void {
  const encoder = new TextEncoder();
  const entries: ZipEntryInput[] = [];

  // 1. Updated 13-sheet Excel workbook
  const xlsxBytes = buildUpdatedWorkbookBytes(dataset, edits, mediaMap);
  entries.push({
    path: 'public/Duckomat_Entwicklungsdatenbank_v14_aktualisiert.xlsx',
    data: xlsxBytes,
  });

  // 2. Portable JSON state backup
  const stateJson = JSON.stringify(
    {
      format: 'duckomat-sge-v14-package',
      exportedAt: new Date().toISOString(),
      sourceName: dataset.sourceName,
      edits,
      palette,
      mediaIndex: Object.values(mediaMap).map((m) => ({
        refKey: m.refKey,
        fileName: m.fileName,
        caption: m.caption,
        mimeType: m.mimeType,
        updatedAt: m.updatedAt,
      })),
    },
    null,
    2
  );
  entries.push({
    path: 'project_state.json',
    data: encoder.encode(stateJson),
  });

  // 3. Uploaded media files mapped to public/media/...
  const usedPaths = new Set<string>();
  for (const media of Object.values(mediaMap)) {
    const bytes = dataUrlToBytes(media.dataUrl);
    if (bytes.length === 0) continue;

    let targetPath: string;
    if (media.refKey.startsWith('media/')) {
      targetPath = `public/${media.refKey}`;
    } else {
      const safeName = media.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      targetPath = `public/media/${safeName}`;
    }
    if (usedPaths.has(targetPath)) {
      const extIdx = targetPath.lastIndexOf('.');
      const stem = extIdx > 0 ? targetPath.slice(0, extIdx) : targetPath;
      const ext = extIdx > 0 ? targetPath.slice(extIdx) : '';
      let counter = 2;
      while (usedPaths.has(`${stem}_${counter}${ext}`)) counter++;
      targetPath = `${stem}_${counter}${ext}`;
    }
    usedPaths.add(targetPath);
    entries.push({ path: targetPath, data: bytes });
  }

  // 4. Short README
  const readme = [
    'Duckomat SGE v14 – Exportiertes Projektpaket',
    '============================================',
    `Exportiert am: ${new Date().toLocaleString('de-DE')}`,
    `Quelldatei: ${dataset.sourceName}`,
    `Enthaltene Fotos: ${usedPaths.size}`,
    '',
    'Übernahme ins Repository:',
    '1. Entpacken Sie den Ordner "public/media/" direkt in Ihr Repository-Root.',
    '2. Ersetzen Sie bei Bedarf "public/Duckomat_Entwicklungsdatenbank_v14.xlsx"',
    '   durch "public/Duckomat_Entwicklungsdatenbank_v14_aktualisiert.xlsx".',
  ].join('\n');
  entries.push({ path: 'README_Export.txt', data: encoder.encode(readme) });

  const zipBlob = createZipArchive(entries);
  triggerDownload(zipBlob, 'Duckomat_SGE_v14_Projektpaket.zip');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
