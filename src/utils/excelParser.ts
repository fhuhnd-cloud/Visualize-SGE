import * as XLSX from 'xlsx';
import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  EdgeCategory,
  IntegrityIssue,
  IntegrityReport,
  KombiIntegration,
  MediaAttachment,
  MethodikLearning,
  MicroIteration,
  PhaseVersionConfig,
  PreDimensioningRow,
  ProjectEditsOverlay,
  RseMaster,
  RseMatrixRow,
  RsePhaseEvent,
  SgeDataset,
  SgeSummaryRow,
  SheetNameV14,
  SpurDashboardRow,
  StatusCode,
} from '../types/sge';
import {
  ALL_STATUS_CODES,
  CANONICAL_SGE_LANES,
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
} from './sgeVisualConfig';

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNumber(value: unknown, fallback = 0): number {
  const s = cleanCell(value).replace(',', '.');
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function parseIdList(raw: string): string[] {
  if (!raw.trim()) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;/\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed.toLowerCase() === 'keine') {
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function parseStatusCode(raw: string): StatusCode | '' {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '');
  if ((ALL_STATUS_CODES as string[]).includes(upper)) {
    return upper as StatusCode;
  }
  return '';
}

export function classifyArrowType(rawType: string): EdgeCategory {
  const t = normalizeKey(rawType);
  if (
    t.includes('problembehebung') ||
    t.includes('fehlerreaktion') ||
    t.includes('fehler') ||
    t.includes('bugfix') ||
    t.includes('reaktion')
  ) {
    return 'bugfix';
  }
  if (
    t.includes('konzeptwechsel') ||
    t.includes('paradigmenbruch') ||
    t.includes('paradigma') ||
    t.includes('umbruch')
  ) {
    return 'paradigmShift';
  }
  if (
    t.includes('konzepttransfer') ||
    t.includes('transfer') ||
    t.includes('uebernehmen') ||
    t.includes('bewaehrte')
  ) {
    return 'transfer';
  }
  if (
    t.includes('spuruebergreifend') ||
    t.includes('wirkbeziehung') ||
    t.includes('andererspur') ||
    t.includes('schnittstelle') ||
    t.includes('querwirkung')
  ) {
    return 'crossLane';
  }
  if (
    t.includes('meilenstein') ||
    t.includes('erprobung') ||
    t.includes('praxistest') ||
    t.includes('test')
  ) {
    return 'milestoneTest';
  }
  return 'optimization';
}

export function resolveCanonicalLane(rawSpur: string): string {
  const trimmed = rawSpur.trim();
  if (!trimmed) return 'S1_Rahmen_Peripherie';
  const norm = normalizeKey(trimmed);
  for (const canonical of CANONICAL_SGE_LANES) {
    if (canonical === trimmed || normalizeKey(canonical) === norm) {
      return canonical;
    }
  }
  const codeMatch = trimmed.match(/^(S\d+)(?:[_\-:\s]|$)/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const byCode = CANONICAL_SGE_LANES.find((c) => c.toUpperCase().startsWith(`${code}_`));
    if (byCode) return byCode;
  }
  return trimmed;
}

export function sortSgeLanes(lanesFromData: string[]): string[] {
  const canonicalOrder = new Map<string, number>(
    CANONICAL_SGE_LANES.map((lane, idx) => [lane, idx])
  );
  const allLanes = new Set<string>([...CANONICAL_SGE_LANES, ...lanesFromData.filter(Boolean)]);
  return Array.from(allLanes).sort((a, b) => {
    const idxA = canonicalOrder.get(a);
    const idxB = canonicalOrder.get(b);
    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return a.localeCompare(b, 'de', { numeric: true });
  });
}

function findSheet(
  workbook: XLSX.WorkBook,
  candidates: string[]
): { sheet?: XLSX.WorkSheet; matchedName?: string } {
  const normCandidates = candidates.map(normalizeKey);
  for (const name of workbook.SheetNames) {
    if (normCandidates.includes(normalizeKey(name))) {
      return { sheet: workbook.Sheets[name], matchedName: name };
    }
  }
  for (const name of workbook.SheetNames) {
    const norm = normalizeKey(name);
    if (normCandidates.some((c) => norm.includes(c) || c.includes(norm))) {
      return { sheet: workbook.Sheets[name], matchedName: name };
    }
  }
  return {};
}

interface ParsedRow {
  rowIndex: number; // 1-based Excel row
  values: Record<string, string>;
}

/** Reads a worksheet with headers strictly in Row 1 (index 0). */
function readSheetRow1Headers(sheet: XLSX.WorkSheet): {
  headers: string[];
  rows: ParsedRow[];
} {
  if (!sheet['!ref']) return { headers: [], rows: [] };
  const ref = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = 0;

  const colHeaders = new Map<number, string>();
  const headers: string[] = [];
  for (let c = ref.s.c; c <= ref.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const text = cell ? cleanCell(cell.v ?? cell.w) : '';
    if (text) {
      colHeaders.set(c, text);
      headers.push(text);
    }
  }

  const rows: ParsedRow[] = [];
  for (let r = headerRow + 1; r <= ref.e.r; r++) {
    const values: Record<string, string> = {};
    let hasContent = false;
    for (const [c, header] of colHeaders.entries()) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.t === 'e') {
        values[header] = '';
        continue;
      }
      const rawVal = cell.v !== undefined && cell.v !== null ? cell.v : cell.w;
      const text = cleanCell(rawVal);
      values[header] = text;
      if (text) hasContent = true;
    }
    if (hasContent) {
      rows.push({ rowIndex: r + 1, values });
    }
  }

  return { headers, rows };
}

function makeAccessor(row: ParsedRow) {
  const entries = Object.entries(row.values).map(([key, value]) => ({
    key,
    norm: normalizeKey(key),
    value,
  }));

  const get = (candidates: string[]): string => {
    const normCandidates = candidates.map(normalizeKey);
    for (const nc of normCandidates) {
      const exact = entries.find((e) => e.norm === nc);
      if (exact) return exact.value;
    }
    for (const nc of normCandidates) {
      const partial = entries.find(
        (e) => e.norm.includes(nc) || (e.norm.length >= 4 && nc.includes(e.norm))
      );
      if (partial) return partial.value;
    }
    return '';
  };

  return { get };
}

function resolveVersionNrFromText(
  versionText: string,
  versions: PhaseVersionConfig[]
): number | null {
  const trimmed = versionText.trim();
  if (!trimmed) return null;
  const norm = normalizeKey(trimmed);
  for (const v of versions) {
    if (
      v.versionKey === trimmed ||
      v.phaseName === trimmed ||
      normalizeKey(v.phaseName) === norm ||
      normalizeKey(v.versionKey) === norm
    ) {
      return v.sortOrder;
    }
  }
  const keyMatch = trimmed.match(/^(v\d+\.\d+)/i);
  if (keyMatch) {
    const k = keyMatch[1].toLowerCase();
    const byKey = versions.find((v) => v.versionKey.toLowerCase() === k);
    if (byKey) return byKey.sortOrder;
  }
  return null;
}

/**
 * Reconstructs a single RSE's status across versions from RSE_Phasenwechsel
 * when RSE_Phasenmatrix formulas aren't cached or are missing.
 */
function deriveMatrixRowFromEvents(
  rse: RseMaster,
  versions: PhaseVersionConfig[],
  eventsForRse: RsePhaseEvent[]
): Record<string, StatusCode | ''> {
  const byVersionNr = new Map<number, RsePhaseEvent>();
  for (const ev of eventsForRse) {
    byVersionNr.set(ev.versionNr, ev);
  }
  const result: Record<string, StatusCode | ''> = {};
  let isCurrentlyActive = false;

  for (const v of versions) {
    const ev = byVersionNr.get(v.sortOrder);
    if (ev) {
      result[v.versionKey] = ev.statusCode;
      if (ev.statusCode === 'REM') {
        isCurrentlyActive = false;
      } else {
        isCurrentlyActive = true;
      }
    } else if (isCurrentlyActive) {
      result[v.versionKey] = 'CV';
    } else {
      result[v.versionKey] = '';
    }
  }
  return result;
}

/**
 * Validates foreign-key integrity across all 13 sheets:
 * RSE_ID, Ursache_ID, Schritt_ID, Kombi_ID, plus duplicate primary keys.
 */
export function validateSgeDataset(
  dataset: SgeDataset,
  preExistingIssues: IntegrityIssue[] = []
): IntegrityReport {
  const issues: IntegrityIssue[] = [...preExistingIssues];

  // Primary key sets
  const versionKeyCounts = new Map<string, number>();
  for (const v of dataset.versions) {
    if (!v.versionKey) continue;
    versionKeyCounts.set(v.versionKey, (versionKeyCounts.get(v.versionKey) ?? 0) + 1);
  }
  for (const [k, count] of versionKeyCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-ver-${k}`,
        severity: 'error',
        sheet: 'Phasen_Konfiguration',
        referenceId: k,
        foreignKeyType: 'Schema',
        message: `Doppelter Version_Key "${k}" (${count}× vorhanden).`,
      });
    }
  }

  const rseIdSet = new Set<string>();
  const rseCounts = new Map<string, number>();
  for (const r of dataset.rseList) {
    if (!r.rseId) {
      issues.push({
        id: `rse-missing-id-${r.rowIndex}`,
        severity: 'error',
        sheet: 'RSE_Stammdaten',
        foreignKeyType: 'RSE_ID',
        message: `Zeile ${r.rowIndex}: RSE ohne RSE_ID gefunden.`,
      });
      continue;
    }
    rseIdSet.add(r.rseId);
    rseCounts.set(r.rseId, (rseCounts.get(r.rseId) ?? 0) + 1);
  }
  for (const [id, count] of rseCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-rse-${id}`,
        severity: 'error',
        sheet: 'RSE_Stammdaten',
        referenceId: id,
        foreignKeyType: 'RSE_ID',
        message: `Doppelte RSE_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  const kombiIdSet = new Set<string>();
  for (const k of dataset.kombis) {
    if (k.kombiId) kombiIdSet.add(k.kombiId);
  }

  const stepIdSet = new Set<string>();
  const stepCounts = new Map<string, number>();
  for (const s of dataset.steps) {
    if (!s.id) continue;
    stepIdSet.add(s.id);
    stepCounts.set(s.id, (stepCounts.get(s.id) ?? 0) + 1);
  }
  for (const [id, count] of stepCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-step-${id}`,
        severity: 'error',
        sheet: 'Entwicklungsschritte',
        referenceId: id,
        foreignKeyType: 'Schritt_ID',
        message: `Doppelte Schritt_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  const causeIdSet = new Set<string>();
  const causeCounts = new Map<string, number>();
  for (const c of dataset.causes) {
    if (!c.id) continue;
    causeIdSet.add(c.id);
    causeCounts.set(c.id, (causeCounts.get(c.id) ?? 0) + 1);
  }
  for (const [id, count] of causeCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-cause-${id}`,
        severity: 'error',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: id,
        foreignKeyType: 'Ursache_ID',
        message: `Doppelte Ursache_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  // FK Checks: RSE_Stammdaten -> Kombi_ID
  for (const r of dataset.rseList) {
    for (const kId of r.currentKombiIds) {
      if (!kombiIdSet.has(kId)) {
        issues.push({
          id: `rse-bad-kombi-${r.rseId}-${kId}`,
          severity: 'error',
          sheet: 'RSE_Stammdaten',
          referenceId: r.rseId,
          foreignKeyType: 'Kombi_ID',
          message: `RSE "${r.rseId}" verweist auf verwaiste Aktuelle_Kombi_ID "${kId}".`,
        });
      }
    }
  }

  // FK Checks: RSE_Phasenwechsel -> RSE_ID, Ursache_ID, Schritt_ID, Kombi_ID
  const eventIdCounts = new Map<string, number>();
  for (const ev of dataset.events) {
    if (ev.eventId) {
      eventIdCounts.set(ev.eventId, (eventIdCounts.get(ev.eventId) ?? 0) + 1);
    }
    if (!ev.rseId || !rseIdSet.has(ev.rseId)) {
      issues.push({
        id: `ev-bad-rse-${ev.eventId || ev.rowIndex}`,
        severity: 'error',
        sheet: 'RSE_Phasenwechsel',
        referenceId: ev.eventId || `Zeile ${ev.rowIndex}`,
        foreignKeyType: 'RSE_ID',
        message: `Event "${ev.eventId || ev.rowIndex}" verweist auf unbekannte RSE_ID "${ev.rseId || 'leer'}".`,
      });
    }
    for (const cId of ev.causeIds) {
      if (!causeIdSet.has(cId)) {
        issues.push({
          id: `ev-bad-cause-${ev.eventId}-${cId}`,
          severity: 'error',
          sheet: 'RSE_Phasenwechsel',
          referenceId: ev.eventId,
          foreignKeyType: 'Ursache_ID',
          message: `Event "${ev.eventId}" (${ev.rseId}) verweist auf verwaiste Ursache_ID "${cId}".`,
        });
      }
    }
    for (const sId of ev.stepIds) {
      if (!stepIdSet.has(sId)) {
        issues.push({
          id: `ev-bad-step-${ev.eventId}-${sId}`,
          severity: 'error',
          sheet: 'RSE_Phasenwechsel',
          referenceId: ev.eventId,
          foreignKeyType: 'Schritt_ID',
          message: `Event "${ev.eventId}" (${ev.rseId}) verweist auf verwaiste Schritt_ID "${sId}".`,
        });
      }
    }
    for (const kId of ev.kombiPartIds) {
      if (!kombiIdSet.has(kId)) {
        issues.push({
          id: `ev-bad-kombi-${ev.eventId}-${kId}`,
          severity: 'error',
          sheet: 'RSE_Phasenwechsel',
          referenceId: ev.eventId,
          foreignKeyType: 'Kombi_ID',
          message: `Event "${ev.eventId}" (${ev.rseId}) verweist auf verwaiste Kombi_Bauteil_ID "${kId}".`,
        });
      }
    }
  }
  for (const [id, count] of eventIdCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-ev-${id}`,
        severity: 'error',
        sheet: 'RSE_Phasenwechsel',
        referenceId: id,
        foreignKeyType: 'Schema',
        message: `Doppelte Event_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  // FK Checks: Bauteil_Integrationen -> RSE_ID
  for (const k of dataset.kombis) {
    for (const rId of k.involvedRseIds) {
      if (!rseIdSet.has(rId)) {
        issues.push({
          id: `kombi-bad-rse-${k.kombiId}-${rId}`,
          severity: 'error',
          sheet: 'Bauteil_Integrationen',
          referenceId: k.kombiId,
          foreignKeyType: 'RSE_ID',
          message: `${k.kombiId} verweist auf unbekannte Beteiligte_RSE_ID "${rId}".`,
        });
      }
    }
  }

  // FK Checks: Mikro_Iterationen -> RSE_ID, Schritt_ID
  for (const m of dataset.microIterations) {
    if (m.rseId && !rseIdSet.has(m.rseId)) {
      issues.push({
        id: `micro-bad-rse-${m.id}-${m.rowIndex}`,
        severity: 'error',
        sheet: 'Mikro_Iterationen',
        referenceId: m.subVersionId || `Zeile ${m.rowIndex}`,
        foreignKeyType: 'RSE_ID',
        message: `Mikro-Iteration "${m.subVersionId || m.rowIndex}" verweist auf verwaiste RSE_ID "${m.rseId}".`,
      });
    }
    if (m.parentStepId && !stepIdSet.has(m.parentStepId)) {
      issues.push({
        id: `micro-bad-step-${m.id}-${m.rowIndex}`,
        severity: 'error',
        sheet: 'Mikro_Iterationen',
        referenceId: m.subVersionId || `Zeile ${m.rowIndex}`,
        foreignKeyType: 'Schritt_ID',
        message: `Mikro-Iteration "${m.subVersionId || m.rowIndex}" verweist auf verwaiste Schritt_ID "${m.parentStepId}".`,
      });
    }
  }

  // FK Checks: Entwicklungsschritte -> RSE_ID
  for (const s of dataset.steps) {
    for (const rId of s.rseIds) {
      if (!rseIdSet.has(rId)) {
        issues.push({
          id: `step-bad-rse-${s.id}-${rId}`,
          severity: 'error',
          sheet: 'Entwicklungsschritte',
          referenceId: s.id,
          foreignKeyType: 'RSE_ID',
          message: `Schritt "${s.id}" verweist auf unbekannte RSE_ID "${rId}".`,
        });
      }
    }
  }

  // FK Checks: Ursachen_Tests_Befunde -> Schritt_ID
  for (const c of dataset.causes) {
    if (c.affectedStepId && !stepIdSet.has(c.affectedStepId)) {
      issues.push({
        id: `cause-bad-affected-${c.id}`,
        severity: 'error',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: c.id,
        foreignKeyType: 'Schritt_ID',
        message: `Ursache "${c.id}": Betroffener_Schritt "${c.affectedStepId}" existiert nicht.`,
      });
    }
    if (c.triggeredStepId && !stepIdSet.has(c.triggeredStepId)) {
      issues.push({
        id: `cause-bad-triggered-${c.id}`,
        severity: 'error',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: c.id,
        foreignKeyType: 'Schritt_ID',
        message: `Ursache "${c.id}": Ausgeloester_Schritt "${c.triggeredStepId}" existiert nicht.`,
      });
    }
  }

  // FK Checks: Verbindungen_Pfeile -> Schritt_ID, Ursache_ID
  for (const a of dataset.arrows) {
    if (!a.from || !stepIdSet.has(a.from)) {
      issues.push({
        id: `arrow-bad-from-${a.id || a.rowIndex}`,
        severity: 'error',
        sheet: 'Verbindungen_Pfeile',
        referenceId: a.id || `Zeile ${a.rowIndex}`,
        foreignKeyType: 'Schritt_ID',
        message: `Pfeil "${a.id}": Von_Schritt_ID "${a.from}" existiert nicht.`,
      });
    }
    if (!a.to || !stepIdSet.has(a.to)) {
      issues.push({
        id: `arrow-bad-to-${a.id || a.rowIndex}`,
        severity: 'error',
        sheet: 'Verbindungen_Pfeile',
        referenceId: a.id || `Zeile ${a.rowIndex}`,
        foreignKeyType: 'Schritt_ID',
        message: `Pfeil "${a.id}": Nach_Schritt_ID "${a.to}" existiert nicht.`,
      });
    }
    for (const cId of a.causeIds) {
      if (!causeIdSet.has(cId)) {
        issues.push({
          id: `arrow-bad-cause-${a.id}-${cId}`,
          severity: 'error',
          sheet: 'Verbindungen_Pfeile',
          referenceId: a.id,
          foreignKeyType: 'Ursache_ID',
          message: `Pfeil "${a.id}" verweist auf verwaiste Ursache_ID "${cId}".`,
        });
      }
    }
  }

  // FK Checks: Methodik_Learnings -> Schritt_ID, Ursache_ID
  for (const l of dataset.learnings) {
    for (const sId of l.linkedStepIds) {
      if (!stepIdSet.has(sId)) {
        issues.push({
          id: `learn-bad-step-${l.id}-${sId}`,
          severity: 'warning',
          sheet: 'Methodik_Learnings',
          referenceId: l.id,
          foreignKeyType: 'Schritt_ID',
          message: `Learning "${l.id}" verweist auf unbekannte Schritt_ID "${sId}".`,
        });
      }
    }
    for (const cId of l.linkedCauseIds) {
      if (!causeIdSet.has(cId)) {
        issues.push({
          id: `learn-bad-cause-${l.id}-${cId}`,
          severity: 'warning',
          sheet: 'Methodik_Learnings',
          referenceId: l.id,
          foreignKeyType: 'Ursache_ID',
          message: `Learning "${l.id}" verweist auf unbekannte Ursache_ID "${cId}".`,
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    sheetsDetected: dataset.sheetNamesFound.length,
    checkedAt: new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    stats: {
      laneCount: dataset.lanes.length,
      versionCount: dataset.versions.length,
      milestoneCount: dataset.versions.filter((v) => v.isMilestone).length,
      rseCount: dataset.rseList.length,
      eventCount: dataset.events.length,
      kombiCount: dataset.kombis.length,
      microIterationCount: dataset.microIterations.length,
      placeholderCount: dataset.microIterations.filter((m) => m.isPlaceholder).length,
      stepCount: dataset.steps.length,
      causeCount: dataset.causes.length,
      arrowCount: dataset.arrows.length,
      learningCount: dataset.learnings.length,
      preDimCount: dataset.preDimensioning.length,
    },
  };
}

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  sourceName: string,
  isBundledDefault = false
): { dataset: SgeDataset; report: IntegrityReport } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const preIssues: IntegrityIssue[] = [];

  const requiredSheets: { key: SheetNameV14; aliases: string[] }[] = [
    { key: 'Überblick_Dashboard', aliases: ['Überblick_Dashboard', 'Ueberblick_Dashboard', 'Dashboard'] },
    { key: 'Phasen_Konfiguration', aliases: ['Phasen_Konfiguration', 'PhasenKonfiguration'] },
    { key: 'RSE_Stammdaten', aliases: ['RSE_Stammdaten', 'RSEStammdaten'] },
    { key: 'RSE_Phasenwechsel', aliases: ['RSE_Phasenwechsel', 'RSEPhasenwechsel'] },
    { key: 'RSE_Phasenmatrix', aliases: ['RSE_Phasenmatrix', 'RSEPhasenmatrix'] },
    { key: 'Bauteil_Integrationen', aliases: ['Bauteil_Integrationen', 'BauteilIntegrationen'] },
    { key: 'Mikro_Iterationen', aliases: ['Mikro_Iterationen', 'MikroIterationen'] },
    { key: 'Entwicklungsschritte', aliases: ['Entwicklungsschritte'] },
    { key: 'Ursachen_Tests_Befunde', aliases: ['Ursachen_Tests_Befunde'] },
    { key: 'Verbindungen_Pfeile', aliases: ['Verbindungen_Pfeile'] },
    { key: 'Methodik_Learnings', aliases: ['Methodik_Learnings'] },
    { key: 'Vorab_Dimensionierung', aliases: ['Vorab_Dimensionierung'] },
    { key: 'SGE_Auswertung', aliases: ['SGE_Auswertung'] },
  ];

  const sheetMap = new Map<SheetNameV14, XLSX.WorkSheet>();
  for (const req of requiredSheets) {
    const found = findSheet(workbook, req.aliases);
    if (found.sheet) {
      sheetMap.set(req.key, found.sheet);
    } else {
      preIssues.push({
        id: `missing-sheet-${req.key}`,
        severity: req.key === 'RSE_Stammdaten' || req.key === 'RSE_Phasenwechsel' ? 'error' : 'warning',
        sheet: 'Arbeitsmappe',
        foreignKeyType: 'Schema',
        message: `Tabellenblatt "${req.key}" wurde in der Arbeitsmappe nicht gefunden.`,
      });
    }
  }

  // 1. Phasen_Konfiguration (filter out empty reserve rows like v2.3..v2.7)
  const versions: PhaseVersionConfig[] = [];
  const phasesSheet = sheetMap.get('Phasen_Konfiguration');
  if (phasesSheet) {
    const { rows } = readSheetRow1Headers(phasesSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const versionKey = acc.get(['Version_Key', 'Phase_Key']);
      const phaseName = acc.get(['Phasen_Name']);
      if (!versionKey || !phaseName) continue; // skip reserve rows without Phasen_Name
      const sortOrder = parseNumber(acc.get(['Sortier_Nr']), versions.length + 1);
      const milestoneBadge = acc.get(['Meilenstein_Badge']);
      const isMilestone = /^M\d+/i.test(milestoneBadge.trim());
      const systemStateSummary = acc.get([
        'Technischer Systemstand & Einordnung',
        'Technischer Systemstand',
        'Einordnung',
      ]);
      versions.push({
        versionKey,
        sortOrder,
        phaseName,
        milestoneBadge: milestoneBadge === '-' ? '' : milestoneBadge,
        isMilestone,
        systemStateSummary,
        rowIndex: row.rowIndex,
      });
    }
    versions.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // 2. Überblick_Dashboard
  const dashboard: SpurDashboardRow[] = [];
  let dashboardTotal: SpurDashboardRow | null = null;
  const dashSheet = sheetMap.get('Überblick_Dashboard');
  if (dashSheet) {
    const { rows } = readSheetRow1Headers(dashSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const spurIdRaw = acc.get(['Spur_ID']);
      if (!spurIdRaw) continue;
      const item: SpurDashboardRow = {
        spurId: spurIdRaw.toUpperCase() === 'SUMME' ? 'SUMME' : resolveCanonicalLane(spurIdRaw),
        name: acc.get(['Systemspur / Baugruppe', 'Systemspur']),
        role: acc.get(['Rolle im Gesamtsystem']),
        totalRse: parseNumber(acc.get(['RSE gesamt'])),
        activeRseV22: parseNumber(acc.get(['Aktive RSE (v2.2)', 'Aktive RSE'])),
        removedOrReplaced: parseNumber(acc.get(['Entfernt / Ersetzt'])),
        integratedRse: parseNumber(acc.get(['Integrierte RSE (Kombi)', 'Integrierte RSE'])),
        versionEventsCount: parseNumber(acc.get(['Versions-Events'])),
        microIterationsCount: parseNumber(acc.get(['Mikro-Iterationen'])),
        eventsChecked: acc.get(['Events geprüft']),
        maturitySummary: acc.get(['Aktueller Reifegrad (SGE-Überblick)', 'Reifegrad']),
        rowIndex: row.rowIndex,
      };
      if (item.spurId === 'SUMME') {
        dashboardTotal = item;
      } else {
        dashboard.push(item);
      }
    }
  }

  // 3. RSE_Stammdaten
  const rseList: RseMaster[] = [];
  const rseSheet = sheetMap.get('RSE_Stammdaten');
  if (rseSheet) {
    const { rows } = readSheetRow1Headers(rseSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const rseId = acc.get(['RSE_ID']);
      if (!rseId) continue;
      const firstVerRaw = acc.get(['Erste_Version']);
      const firstVerNrRaw = parseNumber(
        acc.get(['Erste_Ver_Nr']),
        resolveVersionNrFromText(firstVerRaw, versions) ?? 1
      );
      const removalVersion = acc.get(['Entfall_Version']);
      const removalVerNrParsed = parseNumber(acc.get(['Entfall_Ver_Nr']), 999);
      const removalVersionNr =
        removalVersion && removalVerNrParsed < 900
          ? removalVerNrParsed
          : removalVersion
            ? resolveVersionNrFromText(removalVersion, versions)
            : null;
      const currentKombiIdRaw = acc.get(['Aktuelle_Kombi_ID']);
      rseList.push({
        rseId,
        spur: resolveCanonicalLane(acc.get(['Spur'])),
        name: acc.get(['RSE_Bezeichnung']),
        origin: acc.get(['Herkunft']),
        firstVersion: firstVerRaw,
        firstVersionNr: firstVerNrRaw,
        removalVersion,
        removalVersionNr,
        currentLifecycle: acc.get(['Aktueller_Lebenszyklus']) || 'Aktiv',
        predecessorOrReplacement: acc.get(['Vorgaenger_oder_Ersatz_RSE']),
        currentKombiIdRaw,
        currentKombiIds: parseIdList(currentKombiIdRaw),
        rseCountInPart: parseNumber(acc.get(['RSE_Anzahl_im_Bauteil']), 1),
        versionEventsCount: parseNumber(acc.get(['Anzahl_Versions_Events']), 0),
        microIterationsCount: parseNumber(acc.get(['Anzahl_Mikro_Iterationen']), 0),
        reviewStatus: acc.get(['Pruefstatus_Inhalt']),
        functionSummary: acc.get(['Kurzbeschreibung_Funktion']),
        rowIndex: row.rowIndex,
      });
    }
  }

  const rseById = new Map(rseList.map((r) => [r.rseId, r]));

  // 4. RSE_Phasenwechsel
  const events: RsePhaseEvent[] = [];
  const evSheet = sheetMap.get('RSE_Phasenwechsel');
  if (evSheet) {
    const { rows } = readSheetRow1Headers(evSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const eventId = acc.get(['Event_ID']);
      const rseId = acc.get(['RSE_ID']);
      if (!eventId && !rseId) continue;

      const version = acc.get(['Version']);
      const versionNr = parseNumber(
        acc.get(['Version_Nr']),
        resolveVersionNrFromText(version, versions) ?? 1
      );
      const rawStatus = acc.get(['Status_Code']);
      const statusCode = parseStatusCode(rawStatus) || 'CV';
      if (rawStatus && !parseStatusCode(rawStatus)) {
        preIssues.push({
          id: `ev-bad-status-${eventId || row.rowIndex}`,
          severity: 'warning',
          sheet: 'RSE_Phasenwechsel',
          referenceId: eventId || `Zeile ${row.rowIndex}`,
          foreignKeyType: 'Schema',
          message: `Unbekannter Status_Code "${rawStatus}" bei Event "${eventId}".`,
        });
      }

      const rawSpur = acc.get(['Spur']) || rseById.get(rseId)?.spur || '';
      const kombiPartIdRaw = acc.get(['Kombi_Bauteil_ID']);
      const causeIdRaw = acc.get(['Ursache_ID']);
      const stepIdRaw = acc.get(['Schritt_ID']);

      events.push({
        eventId: eventId || `EV_ROW_${row.rowIndex}`,
        rseId,
        spur: resolveCanonicalLane(rawSpur),
        version,
        versionNr,
        lookupKey: acc.get(['Lookup_Key']) || `${rseId}|${versionNr}`,
        statusCode,
        planningCategoryFig2:
          acc.get(['Planungs_Kategorie_Fig2']) || derivePlanningCategoryFromStatus(statusCode),
        variationType:
          acc.get(['SGE_Variationstyp']) || deriveVariationTypeFromStatus(statusCode),
        kombiPartIdRaw,
        kombiPartIds: parseIdList(kombiPartIdRaw),
        stateDescription: acc.get(['Kurzbeschreibung_Zustand']),
        rationale: acc.get(['Begruendung']),
        causeIdRaw,
        causeIds: parseIdList(causeIdRaw),
        stepIdRaw,
        stepIds: parseIdList(stepIdRaw),
        reviewStatus: acc.get(['Pruefstatus_Inhalt']),
        mediaRef: acc.get(['Medien_Ref']),
        rowIndex: row.rowIndex,
      });
    }
  }

  // Group events by RSE for fallback matrix computation & counts
  const eventsByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }
  for (const list of eventsByRse.values()) {
    list.sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex);
  }

  // 5. RSE_Phasenmatrix (reads cached values, with robust derivation fallback if formulas uncached)
  const matrix: RseMatrixRow[] = [];
  const matSheet = sheetMap.get('RSE_Phasenmatrix');
  if (matSheet) {
    const { headers, rows } = readSheetRow1Headers(matSheet);
    // Match version columns to PhaseVersionConfig
    const colByVersionKey = new Map<string, string>();
    for (const v of versions) {
      const matchedHeader = headers.find((h) => {
        const nh = normalizeKey(h);
        return (
          nh === normalizeKey(v.phaseName) ||
          nh === normalizeKey(v.versionKey) ||
          nh.startsWith(normalizeKey(v.versionKey))
        );
      });
      if (matchedHeader) {
        colByVersionKey.set(v.versionKey, matchedHeader);
      }
    }

    for (const row of rows) {
      const acc = makeAccessor(row);
      const rseId = acc.get(['RSE_ID']);
      if (!rseId) continue;
      const master = rseById.get(rseId);
      const statusByVersionKey: Record<string, StatusCode | ''> = {};
      let anyStatusFound = false;

      for (const v of versions) {
        const colName = colByVersionKey.get(v.versionKey);
        const rawCell = colName ? row.values[colName] ?? '' : '';
        const parsed = parseStatusCode(rawCell);
        statusByVersionKey[v.versionKey] = parsed;
        if (parsed) anyStatusFound = true;
      }

      // If Excel formulas were not cached (e.g., edited programmatically), derive directly from events
      const finalStatuses =
        anyStatusFound || !master
          ? statusByVersionKey
          : deriveMatrixRowFromEvents(master, versions, eventsByRse.get(rseId) ?? []);

      const kombiIdRaw = acc.get(['Kombi_ID']) || master?.currentKombiIdRaw || '';
      matrix.push({
        rseId,
        spur: resolveCanonicalLane(acc.get(['Spur']) || master?.spur || ''),
        name: acc.get(['RSE_Bezeichnung']) || master?.name || '',
        kombiIdRaw,
        kombiIds: parseIdList(kombiIdRaw),
        statusByVersionKey: finalStatuses,
        rowIndex: row.rowIndex,
      });
    }
  }

  // Fallback: if RSE_Phasenmatrix sheet was missing/empty, build it from RSE_Stammdaten + RSE_Phasenwechsel
  if (matrix.length === 0 && rseList.length > 0) {
    for (const rse of rseList) {
      matrix.push({
        rseId: rse.rseId,
        spur: rse.spur,
        name: rse.name,
        kombiIdRaw: rse.currentKombiIdRaw,
        kombiIds: rse.currentKombiIds,
        statusByVersionKey: deriveMatrixRowFromEvents(
          rse,
          versions,
          eventsByRse.get(rse.rseId) ?? []
        ),
        rowIndex: rse.rowIndex,
      });
    }
  }

  // 6. Bauteil_Integrationen (skip empty reserve rows like KOMBI-07..10)
  const kombis: KombiIntegration[] = [];
  const kombiSheet = sheetMap.get('Bauteil_Integrationen');
  if (kombiSheet) {
    const { rows } = readSheetRow1Headers(kombiSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const kombiId = acc.get(['Kombi_ID']);
      const partName = acc.get(['Bauteil_Bezeichnung']);
      if (!kombiId || !partName) continue; // skip reserve rows
      const involvedRseRaw = acc.get(['Beteiligte_RSE_IDs']);
      const involvedRseIds = parseIdList(involvedRseRaw);
      kombis.push({
        kombiId,
        partName,
        integratedFromPhase: acc.get(['Integration_ab_Phase']),
        rseCountInPart: parseNumber(acc.get(['Anzahl_RSE_im_Bauteil']), involvedRseIds.length),
        involvedRseRaw,
        involvedRseIds,
        involvedLanes: acc.get(['Beteiligte_Spuren']),
        variationType: acc.get(['SGE_Variationsart']),
        rationale: acc.get(['Begruendung_Funktionsintegration']),
        mediaRef: acc.get(['Medien_Ref']),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 7. Mikro_Iterationen
  const microIterations: MicroIteration[] = [];
  const microSheet = sheetMap.get('Mikro_Iterationen');
  if (microSheet) {
    const { rows } = readSheetRow1Headers(microSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const detailBox = acc.get(['Detail_Box']);
      const rseId = acc.get(['RSE_ID']);
      const subVersionId = acc.get(['Sub_Version_ID', 'Schritt_Nr']);
      const change = acc.get([
        'Konstruktive / Fertigungstechnische Änderung',
        'Konstruktive / Fertigungstechnische Aenderung',
      ]);
      if (!detailBox && !rseId && !subVersionId && !change) continue;

      const version = acc.get(['Version']);
      const evaluation = acc.get(['Bewertung']);
      const isPlaceholder =
        detailBox.toUpperCase().startsWith('BOX PH_') ||
        evaluation.toLowerCase().includes('platzhalter') ||
        change.trim().startsWith('[Platzhalter');

      microIterations.push({
        id: subVersionId || `${detailBox}_${row.rowIndex}`,
        detailBox,
        rseId,
        spur: resolveCanonicalLane(acc.get(['Spur']) || rseById.get(rseId)?.spur || ''),
        version,
        versionNr: resolveVersionNrFromText(version, versions),
        parentStepId: acc.get(['Gehört_zu_Schritt', 'Gehoert_zu_Schritt']),
        subVersionId,
        change,
        result: acc.get(['Beobachtetes Ergebnis']),
        evaluation,
        mediaRef: acc.get(['Medien_Ref']),
        isPlaceholder,
        rowIndex: row.rowIndex,
      });
    }
  }

  // Reconcile RSE event & micro counts if formulas weren't cached
  const microCountByRse = new Map<string, number>();
  for (const m of microIterations) {
    if (m.rseId) {
      microCountByRse.set(m.rseId, (microCountByRse.get(m.rseId) ?? 0) + 1);
    }
  }
  for (const r of rseList) {
    if (r.versionEventsCount === 0) {
      r.versionEventsCount = eventsByRse.get(r.rseId)?.length ?? 0;
    }
    if (r.microIterationsCount === 0) {
      r.microIterationsCount = microCountByRse.get(r.rseId) ?? 0;
    }
  }

  // 8. Entwicklungsschritte
  const steps: DevelopmentStep[] = [];
  const stepsSheet = sheetMap.get('Entwicklungsschritte');
  if (stepsSheet) {
    const { rows } = readSheetRow1Headers(stepsSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const id = acc.get(['Schritt_ID']);
      if (!id) continue;
      const version = acc.get(['Version', 'Phase']);
      const rseIdRaw = acc.get(['RSE_ID']);
      steps.push({
        id,
        spur: resolveCanonicalLane(acc.get(['Spur'])),
        rseIdRaw,
        rseIds: parseIdList(rseIdRaw),
        version,
        versionNr: parseNumber(
          acc.get(['Version_Nr', 'Phase_Nr']),
          resolveVersionNrFromText(version, versions) ?? 1
        ),
        stepType: acc.get(['Schritt_Typ']),
        title: acc.get(['Kurz_Titel']),
        implementation: acc.get([
          'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)',
          'Konstruktive / Logische Ausführung',
        ]),
        stand: acc.get(['Automatischer_Stand']),
        detailBox: acc.get(['Detail_Box']),
        learnings: parseIdList(acc.get(['Learnings'])),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 9. Ursachen_Tests_Befunde
  const causes: CauseFinding[] = [];
  const causesSheet = sheetMap.get('Ursachen_Tests_Befunde');
  if (causesSheet) {
    const { rows } = readSheetRow1Headers(causesSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const id = acc.get(['Ursache_ID']);
      if (!id) continue;
      causes.push({
        id,
        category: acc.get(['Kategorie']),
        laneRef: acc.get(['Spur_Bezug']),
        affectedStepId: acc.get(['Betroffener_Schritt']),
        triggeredStepId: acc.get(['Ausgeloester_Schritt']),
        title: acc.get(['Kurz_Titel (Befund / Test / Problem)', 'Kurz_Titel']),
        observation: acc.get(['Dokumentierte Beobachtung / Fakt', 'Beobachtung']),
        hypothesis: acc.get(['Hypothese / Grenze der Nachweiskraft', 'Hypothese']),
        learnings: parseIdList(acc.get(['Learnings'])),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 10. Verbindungen_Pfeile
  const arrows: ConnectionArrow[] = [];
  const arrowsSheet = sheetMap.get('Verbindungen_Pfeile');
  if (arrowsSheet) {
    const { rows } = readSheetRow1Headers(arrowsSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const id = acc.get(['Pfeil_ID']);
      const from = acc.get(['Von_Schritt_ID']);
      const to = acc.get(['Nach_Schritt_ID']);
      if (!id && !from && !to) continue;
      const arrowType = acc.get(['Pfeil_Typ (Visuelle Darstellung)', 'Pfeil_Typ']);
      const causeIdRaw = acc.get(['Begruendung_Ursache_ID']);
      arrows.push({
        id: id || `P_${row.rowIndex}`,
        from,
        to,
        arrowType,
        category: classifyArrowType(arrowType),
        causeIdRaw,
        causeIds: parseIdList(causeIdRaw),
        laneRef: acc.get(['Spur_Bezug']),
        rationale: acc.get([
          'Begründung des Entwicklungsschritts (Anzeige am Pfeil)',
          'Begruendung des Entwicklungsschritts',
        ]),
        layoutDirection: acc.get(['Wirkrichtung_Layout']),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 11. Methodik_Learnings
  const learnings: MethodikLearning[] = [];
  const learningsSheet = sheetMap.get('Methodik_Learnings');
  if (learningsSheet) {
    const { rows } = readSheetRow1Headers(learningsSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const id = acc.get(['Learning_ID']);
      if (!id) continue;
      learnings.push({
        id,
        topic: acc.get(['Themenfeld']),
        title: acc.get(['Kurz_Titel_Learning']),
        principle: acc.get(['Übertragbares Prinzip (losgelöst vom Duckomat)', 'Übertragbares Prinzip']),
        projectExample: acc.get(['Konkretes Projektbeispiel (Anker in Datenbank)', 'Projektbeispiel']),
        linkedStepIds: parseIdList(acc.get(['Verknuepfte_Schritte'])),
        linkedCauseIds: parseIdList(acc.get(['Verknuepfte_Ursachen'])),
        scientificContext: acc.get([
          'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)',
          'Wissenschaftliche Einordnung',
        ]),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 12. Vorab_Dimensionierung
  const preDimensioning: PreDimensioningRow[] = [];
  const preDimSheet = sheetMap.get('Vorab_Dimensionierung');
  if (preDimSheet) {
    const { rows } = readSheetRow1Headers(preDimSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const id = acc.get(['Parameter-ID', 'Parameter_ID']);
      if (!id) continue;
      preDimensioning.push({
        id,
        subDomain: acc.get(['Teilbereich']),
        parameter: acc.get(['Größe / Parameter', 'Groesse / Parameter']),
        value: acc.get(['Wert']),
        unit: acc.get(['Einheit']),
        formulaOrSource: acc.get(['Excel-Formel / Herkunft']),
        evidenceType: acc.get(['Evidenz-Typ']),
        methodicalNotes: acc.get(['Methodische Einordnung / Kritische Prüfung']),
        rowIndex: row.rowIndex,
      });
    }
  }

  // 13. SGE_Auswertung
  const sgeSummary: SgeSummaryRow[] = [];
  const summarySheet = sheetMap.get('SGE_Auswertung');
  if (summarySheet) {
    const { headers, rows } = readSheetRow1Headers(summarySheet);
    const colByVerKey = new Map<string, string>();
    for (const v of versions) {
      const matchedHeader = headers.find((h) => {
        const nh = normalizeKey(h);
        return nh === normalizeKey(v.phaseName) || nh.startsWith(normalizeKey(v.versionKey));
      });
      if (matchedHeader) colByVerKey.set(v.versionKey, matchedHeader);
    }
    for (const row of rows) {
      const acc = makeAccessor(row);
      const metricLabel = acc.get(['SGE_Kennzahl / Status_Code', 'SGE_Kennzahl']);
      if (!metricLabel) continue;
      const valuesByVersionKey: Record<string, string> = {};
      for (const v of versions) {
        const col = colByVerKey.get(v.versionKey);
        valuesByVersionKey[v.versionKey] = col ? row.values[col] ?? '' : '';
      }
      sgeSummary.push({
        metricLabel,
        valuesByVersionKey,
        totalOrSummary: acc.get(['Gesamt_Events_oder_Stand']),
        rowIndex: row.rowIndex,
      });
    }
  }

  const lanes = sortSgeLanes([
    ...dashboard.map((d) => d.spurId),
    ...rseList.map((r) => r.spur),
  ]);

  const dataset: SgeDataset = {
    sourceName,
    isBundledDefault,
    sheetNamesFound: [...workbook.SheetNames],
    dashboard,
    dashboardTotal,
    versions,
    lanes,
    rseList,
    events,
    matrix,
    kombis,
    microIterations,
    steps,
    causes,
    arrows,
    learnings,
    preDimensioning,
    sgeSummary,
  };

  const report = validateSgeDataset(dataset, preIssues);
  return { dataset, report };
}

export async function parseExcelFile(
  file: File
): Promise<{ dataset: SgeDataset; report: IntegrityReport }> {
  const buffer = await file.arrayBuffer();
  return parseExcelBuffer(buffer, file.name, false);
}

/**
 * Generates an updated 13-sheet XLSX workbook ArrayBuffer incorporating all
 * local text/status edits and updated Medien_Ref mappings.
 */
export function buildUpdatedWorkbookBytes(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay,
  mediaMap: Record<string, MediaAttachment>
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Merge edits into events, microIterations, kombis
  const mergedEvents = dataset.events.map((ev) => {
    const patch = edits.events[ev.eventId];
    const statusCode = patch?.statusCode ?? ev.statusCode;
    const refCandidate = patch?.mediaRef ?? ev.mediaRef;
    const resolvedMediaRef =
      refCandidate ||
      (mediaMap[`event:${ev.eventId}`]?.fileName
        ? `media/${mediaMap[`event:${ev.eventId}`].fileName}`
        : '');
    return {
      ...ev,
      statusCode,
      planningCategoryFig2: derivePlanningCategoryFromStatus(statusCode),
      variationType: deriveVariationTypeFromStatus(statusCode),
      stateDescription: patch?.stateDescription ?? ev.stateDescription,
      rationale: patch?.rationale ?? ev.rationale,
      mediaRef: resolvedMediaRef,
    };
  });

  const mergedMicro = dataset.microIterations.map((m) => {
    const patch = edits.microIterations[m.id];
    const refCandidate = patch?.mediaRef ?? m.mediaRef;
    const resolvedMediaRef =
      refCandidate ||
      (mediaMap[`micro:${m.id}`]?.fileName ? `media/${mediaMap[`micro:${m.id}`].fileName}` : '');
    return {
      ...m,
      change: patch?.change ?? m.change,
      result: patch?.result ?? m.result,
      evaluation: patch?.evaluation ?? m.evaluation,
      mediaRef: resolvedMediaRef,
    };
  });

  const mergedKombis = dataset.kombis.map((k) => {
    const patch = edits.kombis[k.kombiId];
    const refCandidate = patch?.mediaRef ?? k.mediaRef;
    const resolvedMediaRef =
      refCandidate ||
      (mediaMap[`kombi:${k.kombiId}`]?.fileName
        ? `media/${mediaMap[`kombi:${k.kombiId}`].fileName}`
        : '');
    return {
      ...k,
      partName: patch?.partName ?? k.partName,
      rationale: patch?.rationale ?? k.rationale,
      mediaRef: resolvedMediaRef,
    };
  });

  // Recompute matrix rows reflecting edited event statuses
  const evByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of mergedEvents) {
    const list = evByRse.get(ev.rseId) ?? [];
    list.push(ev);
    evByRse.set(ev.rseId, list);
  }
  const recomputedMatrix = dataset.rseList.map((rse) => {
    const statusByVersionKey = deriveMatrixRowFromEvents(
      rse,
      dataset.versions,
      evByRse.get(rse.rseId) ?? []
    );
    const row: Record<string, string> = {
      RSE_ID: rse.rseId,
      Spur: rse.spur,
      RSE_Bezeichnung: rse.name,
      Kombi_ID: rse.currentKombiIdRaw,
    };
    for (const v of dataset.versions) {
      row[v.phaseName] = statusByVersionKey[v.versionKey] ?? '';
    }
    return row;
  });

  // 1. Überblick_Dashboard
  const dashRows = dataset.dashboard.map((d) => ({
    Spur_ID: d.spurId,
    'Systemspur / Baugruppe': d.name,
    'Rolle im Gesamtsystem': d.role,
    'RSE gesamt': d.totalRse,
    'Aktive RSE (v2.2)': d.activeRseV22,
    'Entfernt / Ersetzt': d.removedOrReplaced,
    'Integrierte RSE (Kombi)': d.integratedRse,
    'Versions-Events': d.versionEventsCount,
    'Mikro-Iterationen': d.microIterationsCount,
    'Events geprüft': d.eventsChecked,
    'Aktueller Reifegrad (SGE-Überblick)': d.maturitySummary,
  }));
  if (dataset.dashboardTotal) {
    const t = dataset.dashboardTotal;
    dashRows.push({
      Spur_ID: 'SUMME',
      'Systemspur / Baugruppe': t.name,
      'Rolle im Gesamtsystem': t.role,
      'RSE gesamt': t.totalRse,
      'Aktive RSE (v2.2)': t.activeRseV22,
      'Entfernt / Ersetzt': t.removedOrReplaced,
      'Integrierte RSE (Kombi)': t.integratedRse,
      'Versions-Events': t.versionEventsCount,
      'Mikro-Iterationen': t.microIterationsCount,
      'Events geprüft': t.eventsChecked,
      'Aktueller Reifegrad (SGE-Überblick)': t.maturitySummary,
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashRows), 'Überblick_Dashboard');

  // 2. SGE_Auswertung
  const sgeRows = dataset.sgeSummary.map((s) => {
    const obj: Record<string, string> = {
      'SGE_Kennzahl / Status_Code': s.metricLabel,
    };
    for (const v of dataset.versions) {
      obj[v.phaseName] = s.valuesByVersionKey[v.versionKey] ?? '';
    }
    obj['Gesamt_Events_oder_Stand'] = s.totalOrSummary;
    return obj;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sgeRows), 'SGE_Auswertung');

  // 3. RSE_Phasenmatrix
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(recomputedMatrix),
    'RSE_Phasenmatrix'
  );

  // 4. RSE_Stammdaten
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.rseList.map((r) => ({
        RSE_ID: r.rseId,
        Spur: r.spur,
        RSE_Bezeichnung: r.name,
        Herkunft: r.origin,
        Erste_Version: r.firstVersion,
        Erste_Ver_Nr: r.firstVersionNr,
        Entfall_Version: r.removalVersion,
        Entfall_Ver_Nr: r.removalVersionNr ?? 999,
        Aktueller_Lebenszyklus: r.currentLifecycle,
        Vorgaenger_oder_Ersatz_RSE: r.predecessorOrReplacement,
        Aktuelle_Kombi_ID: r.currentKombiIdRaw,
        RSE_Anzahl_im_Bauteil: r.rseCountInPart,
        Anzahl_Versions_Events: r.versionEventsCount,
        Anzahl_Mikro_Iterationen: r.microIterationsCount,
        Pruefstatus_Inhalt: r.reviewStatus,
        Kurzbeschreibung_Funktion: r.functionSummary,
      }))
    ),
    'RSE_Stammdaten'
  );

  // 5. RSE_Phasenwechsel
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      mergedEvents.map((e) => ({
        Event_ID: e.eventId,
        RSE_ID: e.rseId,
        Spur: e.spur,
        Version: e.version,
        Version_Nr: e.versionNr,
        Lookup_Key: e.lookupKey,
        Status_Code: e.statusCode,
        Planungs_Kategorie_Fig2: e.planningCategoryFig2,
        SGE_Variationstyp: e.variationType,
        Kombi_Bauteil_ID: e.kombiPartIdRaw,
        Kurzbeschreibung_Zustand: e.stateDescription,
        Begruendung: e.rationale,
        Ursache_ID: e.causeIdRaw,
        Schritt_ID: e.stepIdRaw,
        Pruefstatus_Inhalt: e.reviewStatus,
        Medien_Ref: e.mediaRef,
      }))
    ),
    'RSE_Phasenwechsel'
  );

  // 6. Bauteil_Integrationen
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      mergedKombis.map((k) => ({
        Kombi_ID: k.kombiId,
        Bauteil_Bezeichnung: k.partName,
        Integration_ab_Phase: k.integratedFromPhase,
        Anzahl_RSE_im_Bauteil: k.rseCountInPart,
        Beteiligte_RSE_IDs: k.involvedRseRaw,
        Beteiligte_Spuren: k.involvedLanes,
        SGE_Variationsart: k.variationType,
        Begruendung_Funktionsintegration: k.rationale,
        Medien_Ref: k.mediaRef,
      }))
    ),
    'Bauteil_Integrationen'
  );

  // 7. Phasen_Konfiguration
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.versions.map((v) => ({
        Version_Key: v.versionKey,
        Sortier_Nr: v.sortOrder,
        Phasen_Name: v.phaseName,
        Meilenstein_Badge: v.milestoneBadge || '-',
        'Technischer Systemstand & Einordnung': v.systemStateSummary,
      }))
    ),
    'Phasen_Konfiguration'
  );

  // 8. Entwicklungsschritte
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.steps.map((s) => ({
        Schritt_ID: s.id,
        Spur: s.spur,
        RSE_ID: s.rseIdRaw,
        Version: s.version,
        Version_Nr: s.versionNr ?? '',
        Schritt_Typ: s.stepType,
        Kurz_Titel: s.title,
        'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)': s.implementation,
        Automatischer_Stand: s.stand,
        Detail_Box: s.detailBox,
        Learnings: s.learnings.join(', '),
      }))
    ),
    'Entwicklungsschritte'
  );

  // 9. Ursachen_Tests_Befunde
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.causes.map((c) => ({
        Ursache_ID: c.id,
        Kategorie: c.category,
        Spur_Bezug: c.laneRef,
        Betroffener_Schritt: c.affectedStepId,
        Ausgeloester_Schritt: c.triggeredStepId,
        'Kurz_Titel (Befund / Test / Problem)': c.title,
        'Dokumentierte Beobachtung / Fakt': c.observation,
        'Hypothese / Grenze der Nachweiskraft': c.hypothesis,
        Learnings: c.learnings.join(', '),
      }))
    ),
    'Ursachen_Tests_Befunde'
  );

  // 10. Verbindungen_Pfeile
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.arrows.map((a) => ({
        Pfeil_ID: a.id,
        Von_Schritt_ID: a.from,
        Nach_Schritt_ID: a.to,
        'Pfeil_Typ (Visuelle Darstellung)': a.arrowType,
        Begruendung_Ursache_ID: a.causeIdRaw,
        Spur_Bezug: a.laneRef,
        'Begründung des Entwicklungsschritts (Anzeige am Pfeil)': a.rationale,
        Wirkrichtung_Layout: a.layoutDirection,
      }))
    ),
    'Verbindungen_Pfeile'
  );

  // 11. Mikro_Iterationen
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      mergedMicro.map((m) => ({
        Detail_Box: m.detailBox,
        RSE_ID: m.rseId,
        Spur: m.spur,
        Version: m.version,
        Gehört_zu_Schritt: m.parentStepId,
        Sub_Version_ID: m.subVersionId,
        'Konstruktive / Fertigungstechnische Änderung': m.change,
        'Beobachtetes Ergebnis': m.result,
        Bewertung: m.evaluation,
        Medien_Ref: m.mediaRef,
      }))
    ),
    'Mikro_Iterationen'
  );

  // 12. Methodik_Learnings
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.learnings.map((l) => ({
        Learning_ID: l.id,
        Themenfeld: l.topic,
        Kurz_Titel_Learning: l.title,
        'Übertragbares Prinzip (losgelöst vom Duckomat)': l.principle,
        'Konkretes Projektbeispiel (Anker in Datenbank)': l.projectExample,
        Verknuepfte_Schritte: l.linkedStepIds.join(', '),
        Verknuepfte_Ursachen: l.linkedCauseIds.join(', '),
        'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)': l.scientificContext,
      }))
    ),
    'Methodik_Learnings'
  );

  // 13. Vorab_Dimensionierung
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.preDimensioning.map((d) => ({
        'Parameter-ID': d.id,
        Teilbereich: d.subDomain,
        'Größe / Parameter': d.parameter,
        Wert: d.value,
        Einheit: d.unit,
        'Excel-Formel / Herkunft': d.formulaOrSource,
        'Evidenz-Typ': d.evidenceType,
        'Methodische Einordnung / Kritische Prüfung': d.methodicalNotes,
      }))
    ),
    'Vorab_Dimensionierung'
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out as ArrayBuffer);
}

export function downloadUpdatedXlsx(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay,
  mediaMap: Record<string, MediaAttachment>
): void {
  const bytes = buildUpdatedWorkbookBytes(dataset, edits, mediaMap);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Duckomat_Entwicklungsdatenbank_v14_aktualisiert.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
