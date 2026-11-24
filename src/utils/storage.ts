import {
  CustomPalette,
  MediaAttachment,
  ProjectEditsOverlay,
  SgeDataset,
} from '../types/sge';
import { buildUpdatedWorkbookBytes } from './excelParser';
import { DEFAULT_SGE_PALETTE } from './sgeVisualConfig';

const DB_NAME = 'duckomat_sge_v14_db';
const DB_VERSION = 2;
const MEDIA_STORE = 'media_attachments';
const STATE_STORE = 'dataset_state';
const ACTIVE_DATASET_KEY = 'active_working_dataset';

const PALETTE_STORAGE_KEY = 'duckomat_sge_v14_palette';

export function createEmptyEdits(): ProjectEditsOverlay {
  return {
    events: {},
    microIterations: {},
    kombis: {},
    updatedAt: new Date().toISOString(),
  };
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

function openAppDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'refKey' });
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface PersistedDatasetRecord {
  id: string;
  dataset: SgeDataset;
  savedAt: string;
  changeCount: number;
}

export async function loadPersistedDatasetFromIndexedDb(): Promise<PersistedDatasetRecord | null> {
  try {
    const db = await openAppDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const req = tx.objectStore(STATE_STORE).get(ACTIVE_DATASET_KEY);
      req.onsuccess = () => resolve((req.result as PersistedDatasetRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function savePersistedDatasetToIndexedDb(
  dataset: SgeDataset,
  changeCount: number
): Promise<void> {
  try {
    const db = await openAppDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      tx.objectStore(STATE_STORE).put({
        id: ACTIVE_DATASET_KEY,
        dataset,
        savedAt: new Date().toISOString(),
        changeCount,
      } satisfies PersistedDatasetRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB quota/private-mode errors gracefully
  }
}

export async function clearPersistedDatasetInIndexedDb(): Promise<void> {
  try {
    const db = await openAppDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      tx.objectStore(STATE_STORE).delete(ACTIVE_DATASET_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadAllMediaFromIndexedDb(): Promise<Record<string, MediaAttachment>> {
  try {
    const db = await openAppDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_STORE).getAll();
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
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteMediaFromIndexedDb(refKey: string): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(refKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
  dataset?: SgeDataset;
  edits?: ProjectEditsOverlay;
  palette: CustomPalette;
  media: Record<string, MediaAttachment>;
}

export function downloadProjectJsonBackup(
  dataset: SgeDataset,
  palette: CustomPalette,
  mediaMap: Record<string, MediaAttachment>
): void {
  const payload: ProjectJsonBackup = {
    format: 'duckomat-sge-v14-package',
    exportedAt: new Date().toISOString(),
    sourceName: dataset.sourceName,
    dataset,
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
    dataset: parsed.dataset,
    edits: parsed.edits,
    palette: parsed.palette ?? DEFAULT_SGE_PALETTE,
    media: parsed.media ?? {},
  };
}

// ---------------------------------------------------------------------------
// Zero-dependency ZIP archive writer (STORE method with IEEE CRC32)
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

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

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

export function downloadProjectZipPackage(
  dataset: SgeDataset,
  palette: CustomPalette,
  mediaMap: Record<string, MediaAttachment>
): void {
  const encoder = new TextEncoder();
  const entries: ZipEntryInput[] = [];

  const xlsxBytes = buildUpdatedWorkbookBytes(dataset, createEmptyEdits(), mediaMap);
  entries.push({
    path: 'public/Duckomat_Entwicklungsdatenbank_v14_aktualisiert.xlsx',
    data: xlsxBytes,
  });

  const stateJson = JSON.stringify(
    {
      format: 'duckomat-sge-v14-package',
      exportedAt: new Date().toISOString(),
      sourceName: dataset.sourceName,
      dataset,
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

  const readme = [
    'Duckomat SGE v14 – Exportiertes Projektpaket',
    '============================================',
    `Exportiert am: ${new Date().toLocaleString('de-DE')}`,
    `Quelldatei: ${dataset.sourceName}`,
    `Enthaltene Fotos: ${usedPaths.size}`,
    '',
    'Übernahme ins Repository:',
    '1. Entpacken Sie "public/media/" direkt in Ihr Repository-Root.',
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
