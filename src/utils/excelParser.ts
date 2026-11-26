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
  RseReferenceLink,
  SgeDataset,
  SgeSummaryRow,
  SgeVariationKind,
  SheetNameV14,
  SpurDashboardRow,
  StatusCode,
} from '../types/sge';
import {
  ALL_STATUS_CODES,
  CANONICAL_SGE_LANES,
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
  isPlannedStatusCode,
  statusCodeToVariationKind,
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

/**
 * Parses Status_Code and automatically maps legacy GV codes from older v14 Excel files
 * to canonical SGE AV (Attribute Variation) codes:
 * - EC-GV -> EC-AV
 * - UD-GV -> UD-AV
 * - GV    -> EC-AV
 */
export function parseStatusCode(raw: string): StatusCode | '' {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!upper) return '';
  if (upper === 'EC-GV' || upper === 'GV' || upper === 'AV') return 'EC-AV';
  if (upper === 'UD-GV') return 'UD-AV';
  if (upper === 'PV') return 'EC-PV';
  if (upper === 'ÜV' || upper === 'UEV') return 'CV';
  if (upper === 'ENTFALL' || upper === 'PV-') return 'REM';
  if ((ALL_STATUS_CODES as string[]).includes(upper)) {
    return upper as StatusCode;
  }
  return '';
}

export function parseVariationKind(raw: string): SgeVariationKind {
  const u = raw.trim().toUpperCase();
  if (u.startsWith('CV') || u.startsWith('ÜV') || u.startsWith('UEV')) return 'CV';
  if (u.startsWith('AV') || u.startsWith('GV') || u.includes('ATTRIBUT') || u.includes('GESTALT')) {
    return 'AV';
  }
  if (u.startsWith('REM') || u.includes('ENTFALL') || u.includes('ENTFERN') || u.startsWith('PV-')) {
    return 'REM';
  }
  return 'PV';
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

/**
 * Default SGE Generation Hierarchy ("Model of SGE" – Albers et al.) for legacy v14 workbooks
 * that do not yet carry explicit Generation_ID / Engineering_Gen_ID columns:
 * - G_0: Referenzsystem (Gen. n-1, v0.0)
 * - G_1: GSD-Abschluss (v1.0 -> E_{1,1}, ME G_1)
 * - G_2: Entenrennen (v1.1 -> E_{2,1}, ME G_2)
 * - G_3: Antrittsvorlesung / Aktueller Stand (v1.2 E_{3,1}, v2.0 E_{3,2}, v2.1 E_{3,3}, v2.2 E_{3,4} -> ME G_3)
 */
function inferDefaultGenerationMeta(
  versionKey: string,
  sortOrder: number,
  milestoneBadge: string
): {
  generationId: string;
  generationName: string;
  engineeringGenId: string;
  milestoneLabel: string;
} {
  const vk = versionKey.trim().toLowerCase();
  if (vk === 'v0.0' || sortOrder === 1) {
    return {
      generationId: 'G_0',
      generationName: 'Referenzsystem (Gen. n-1)',
      engineeringGenId: 'G_0',
      milestoneLabel: 'Ref. G_0',
    };
  }
  if (vk === 'v1.0' || sortOrder === 2) {
    return {
      generationId: 'G_1',
      generationName: 'GSD-Abschluss',
      engineeringGenId: 'E_{1,1}',
      milestoneLabel: 'ME G_1',
    };
  }
  if (vk === 'v1.1' || sortOrder === 3) {
    return {
      generationId: 'G_2',
      generationName: 'Entenrennen',
      engineeringGenId: 'E_{2,1}',
      milestoneLabel: 'ME G_2',
    };
  }
  if (vk === 'v1.2' || sortOrder === 4) {
    return {
      generationId: 'G_3',
      generationName: 'Antrittsvorlesung / Aktueller Stand',
      engineeringGenId: 'E_{3,1}',
      milestoneLabel: milestoneBadge ? 'M2' : '',
    };
  }
  if (vk === 'v2.0' || sortOrder === 5) {
    return {
      generationId: 'G_3',
      generationName: 'Antrittsvorlesung / Aktueller Stand',
      engineeringGenId: 'E_{3,2}',
      milestoneLabel: '',
    };
  }
  if (vk === 'v2.1' || sortOrder === 6) {
    return {
      generationId: 'G_3',
      generationName: 'Antrittsvorlesung / Aktueller Stand',
      engineeringGenId: 'E_{3,3}',
      milestoneLabel: milestoneBadge ? 'M3' : '',
    };
  }
  if (vk === 'v2.2' || sortOrder === 7) {
    return {
      generationId: 'G_3',
      generationName: 'Antrittsvorlesung / Aktueller Stand',
      engineeringGenId: 'E_{3,4}',
      milestoneLabel: 'ME G_3',
    };
  }
  return {
    generationId: `G_${Math.max(1, sortOrder - 3)}`,
    generationName: `Generation ${Math.max(1, sortOrder - 3)}`,
    engineeringGenId: `E_{${Math.max(1, sortOrder - 3)},1}`,
    milestoneLabel: milestoneBadge || '',
  };
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
  rowIndex: number;
  values: Record<string, string>;
}

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
      v.engineeringGenId === trimmed ||
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

function deriveMatrixRowFromEvents(
  versions: PhaseVersionConfig[],
  eventsForRse: RsePhaseEvent[]
): Record<string, StatusCode | ''> {
  const byVersionNr = new Map<number, RsePhaseEvent>();
  for (const ev of eventsForRse) byVersionNr.set(ev.versionNr, ev);
  const result: Record<string, StatusCode | ''> = {};
  let active = false;
  for (const v of versions) {
    const ev = byVersionNr.get(v.sortOrder);
    if (ev) {
      result[v.versionKey] = ev.statusCode;
      active = ev.statusCode !== 'REM';
    } else if (active) {
      result[v.versionKey] = 'CV';
    } else {
      result[v.versionKey] = '';
    }
  }
  return result;
}

/**
 * Automatically derives structured RseReferenceLink[] for each development event
 * when no explicit RSE_Referenzen sheet is present in the imported workbook.
 */
function populateEventReferences(
  events: RsePhaseEvent[],
  rseList: RseMaster[],
  versions: PhaseVersionConfig[],
  kombis: KombiIntegration[],
  steps: DevelopmentStep[],
  arrows: ConnectionArrow[],
  explicitRefsByEventId: Map<string, RseReferenceLink[]>
): RsePhaseEvent[] {
  const rseById = new Map(rseList.map((r) => [r.rseId, r]));
  const verBySort = new Map(versions.map((v) => [v.sortOrder, v]));
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const kombiById = new Map(kombis.map((k) => [k.kombiId, k]));

  const eventsByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }
  for (const list of eventsByRse.values()) {
    list.sort((a, b) => a.versionNr - b.versionNr);
  }

  return events.map((ev) => {
    const explicit = explicitRefsByEventId.get(ev.eventId);
    if (explicit && explicit.length > 0) {
      return { ...ev, references: explicit };
    }

    const refs: RseReferenceLink[] = [];
    const seenKeys = new Set<string>();
    const pushRef = (item: Omit<RseReferenceLink, 'id'>) => {
      const dedupe = `${item.refRseId}::${item.variationType}`;
      if (seenKeys.has(dedupe)) return;
      seenKeys.add(dedupe);
      refs.push({ id: `${ev.eventId}_ref_${refs.length + 1}`, ...item });
    };

    const master = rseById.get(ev.rseId);
    const rseHistory = eventsByRse.get(ev.rseId) ?? [];
    const prevEv = [...rseHistory].reverse().find((p) => p.versionNr < ev.versionNr);

    // 1. Predecessor state of the same RSE in an earlier generation
    if (ev.statusCode === 'BASE') {
      pushRef({
        refRseId: ev.rseId,
        refName: master?.name || ev.rseId,
        originGeneration: 'G_0 (Vorgängersystem)',
        variationType: 'CV',
        rationale: 'Übernommen als Referenzbasis aus Vorgängergeneration (Gen. n-1).',
      });
    } else if (ev.statusCode === 'NEW') {
      pushRef({
        refRseId: ev.rseId,
        refName: master?.name || ev.rseId,
        originGeneration: 'Extern / Neu',
        variationType: 'PV',
        rationale: ev.rationale || 'Neu hinzugefügtes Referenzsystemelement (Prinzipvariation).',
      });
    } else if (prevEv) {
      const prevVer = verBySort.get(prevEv.versionNr);
      pushRef({
        refRseId: ev.rseId,
        refName: master?.name || ev.rseId,
        originGeneration: prevVer
          ? `${prevVer.generationId} (${prevVer.engineeringGenId})`
          : `v${prevEv.versionNr}`,
        variationType: ev.sgeVariation,
        rationale:
          ev.rationale ||
          (ev.statusCode === 'REM'
            ? 'Element entfernt bzw. abgelöst.'
            : 'Weiterentwicklung auf Basis des Vorgängerstands.'),
      });
    }

    // 2. Incoming causal arrows targeting this event's Entwicklungsschritte
    if (ev.stepIds.length > 0) {
      const stepSet = new Set(ev.stepIds);
      for (const a of arrows) {
        if (!stepSet.has(a.to)) continue;
        const fromStep = stepById.get(a.from);
        const srcRseId = a.fromRseId || fromStep?.rseIds[0] || '';
        if (!srcRseId || srcRseId === ev.rseId) continue;
        const srcRse = rseById.get(srcRseId);
        const srcVer = fromStep?.versionNr ? verBySort.get(fromStep.versionNr) : undefined;
        const vType: SgeVariationKind =
          a.category === 'transfer'
            ? 'CV'
            : a.category === 'paradigmShift'
              ? 'PV'
              : 'AV';
        pushRef({
          refRseId: srcRseId,
          refName: srcRse?.name || fromStep?.title || srcRseId,
          originGeneration: srcVer
            ? `${srcVer.generationId} (${srcVer.engineeringGenId})`
            : 'Referenz',
          variationType: vType,
          rationale: a.rationale || `${a.id}: ${a.arrowType}`,
        });
      }
    }

    // 3. Cross-lane KOMBI-xx siblings merged at this event
    for (const kId of ev.kombiPartIds) {
      const kombi = kombiById.get(kId);
      if (!kombi) continue;
      for (const siblingId of kombi.involvedRseIds) {
        if (siblingId === ev.rseId) continue;
        const sib = rseById.get(siblingId);
        pushRef({
          refRseId: siblingId,
          refName: sib?.name || siblingId,
          originGeneration: `${kId} (Integration)`,
          variationType: 'PV',
          rationale: `Funktionsintegration gemeinsam in ${kId} (${kombi.partName.slice(0, 60)}).`,
        });
      }
    }

    return { ...ev, references: refs };
  });
}

export function validateSgeDataset(
  dataset: SgeDataset,
  preExistingIssues: IntegrityIssue[] = []
): IntegrityReport {
  const issues: IntegrityIssue[] = [...preExistingIssues];

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

  const kombiIdSet = new Set<string>(dataset.kombis.map((k) => k.kombiId).filter(Boolean));
  const stepIdSet = new Set<string>(dataset.steps.map((s) => s.id).filter(Boolean));
  const causeIdSet = new Set<string>(dataset.causes.map((c) => c.id).filter(Boolean));

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

  const eventIdCounts = new Map<string, number>();
  for (const ev of dataset.events) {
    if (ev.eventId) eventIdCounts.set(ev.eventId, (eventIdCounts.get(ev.eventId) ?? 0) + 1);
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

  const requiredSheets: { key: SheetNameV14; aliases: string[]; optional?: boolean }[] = [
    { key: 'Überblick_Dashboard', aliases: ['Überblick_Dashboard', 'Ueberblick_Dashboard', 'Dashboard'] },
    { key: 'Phasen_Konfiguration', aliases: ['Phasen_Konfiguration', 'PhasenKonfiguration'] },
    { key: 'RSE_Stammdaten', aliases: ['RSE_Stammdaten', 'RSEStammdaten'] },
    { key: 'RSE_Phasenwechsel', aliases: ['RSE_Phasenwechsel', 'RSEPhasenwechsel'] },
    { key: 'RSE_Phasenmatrix', aliases: ['RSE_Phasenmatrix', 'RSEPhasenmatrix'] },
    { key: 'RSE_Referenzen', aliases: ['RSE_Referenzen', 'Referenzen'], optional: true },
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
    } else if (!req.optional) {
      preIssues.push({
        id: `missing-sheet-${req.key}`,
        severity: req.key === 'RSE_Stammdaten' || req.key === 'RSE_Phasenwechsel' ? 'error' : 'warning',
        sheet: 'Arbeitsmappe',
        foreignKeyType: 'Schema',
        message: `Tabellenblatt "${req.key}" wurde in der Arbeitsmappe nicht gefunden.`,
      });
    }
  }

  // 1. Phasen_Konfiguration (supports explicit Generation_ID, Engineering_Gen_ID, Meilenstein_Label)
  const versions: PhaseVersionConfig[] = [];
  const phasesSheet = sheetMap.get('Phasen_Konfiguration');
  if (phasesSheet) {
    const { rows } = readSheetRow1Headers(phasesSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const versionKey = acc.get(['Version_Key', 'Phase_Key']);
      const phaseName = acc.get(['Phasen_Name']);
      if (!versionKey || !phaseName) continue;
      const sortOrder = parseNumber(acc.get(['Sortier_Nr']), versions.length + 1);
      const milestoneBadgeRaw = acc.get(['Meilenstein_Badge']);
      const milestoneBadge = milestoneBadgeRaw === '-' ? '' : milestoneBadgeRaw;
      const inferred = inferDefaultGenerationMeta(versionKey, sortOrder, milestoneBadge);

      const generationId = acc.get(['Generation_ID']) || inferred.generationId;
      const generationName = acc.get(['Generation_Name']) || inferred.generationName;
      const engineeringGenId = acc.get(['Engineering_Gen_ID']) || inferred.engineeringGenId;
      const milestoneLabelRaw = acc.get(['Meilenstein_Label']);
      const milestoneLabel =
        milestoneLabelRaw === '-' ? '' : milestoneLabelRaw || inferred.milestoneLabel;

      const isMilestone =
        /^ME\s*G/i.test(milestoneLabel) ||
        /^M\d+/i.test(milestoneBadge.trim()) ||
        /^M\d+/i.test(milestoneLabel.trim());

      versions.push({
        versionKey,
        sortOrder,
        generationId,
        generationName,
        engineeringGenId,
        milestoneLabel,
        phaseName,
        milestoneBadge,
        isMilestone,
        systemStateSummary: acc.get([
          'Technischer Systemstand & Einordnung',
          'Technischer Systemstand',
          'Einordnung',
        ]),
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
      if (item.spurId === 'SUMME') dashboardTotal = item;
      else dashboard.push(item);
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

  // 4. RSE_Phasenwechsel (auto-maps EC-GV -> EC-AV, UD-GV -> UD-AV)
  let events: RsePhaseEvent[] = [];
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
        sgeVariation: statusCodeToVariationKind(statusCode),
        isPlanned: isPlannedStatusCode(statusCode),
        planningCategoryFig2: derivePlanningCategoryFromStatus(statusCode),
        variationType: deriveVariationTypeFromStatus(statusCode, 'en'),
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
        references: [],
        rowIndex: row.rowIndex,
      });
    }
  }

  // Optional Sheet: RSE_Referenzen
  const explicitRefsByEventId = new Map<string, RseReferenceLink[]>();
  const refSheet = sheetMap.get('RSE_Referenzen');
  if (refSheet) {
    const { rows } = readSheetRow1Headers(refSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const eventId = acc.get(['Event_ID']);
      const refRseId = acc.get(['Ref_RSE_ID', 'RSE_ID']);
      if (!eventId || !refRseId) continue;
      const list = explicitRefsByEventId.get(eventId) ?? [];
      list.push({
        id: acc.get(['Ref_ID']) || `${eventId}_ref_${list.length + 1}`,
        refRseId,
        refName: acc.get(['Ref_Bezeichnung', 'RSE_Bezeichnung']) || rseById.get(refRseId)?.name || refRseId,
        originGeneration: acc.get(['Herkunft_Generation', 'Herkunft']) || 'G_0',
        variationType: parseVariationKind(acc.get(['Variationsart', 'SGE_Variationsart']) || 'CV'),
        rationale: acc.get(['Begruendung', 'Anpassungs_Begruendung']),
      });
      explicitRefsByEventId.set(eventId, list);
    }
  }

  const eventsByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }
  for (const list of eventsByRse.values()) {
    list.sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex);
  }

  // 5. RSE_Phasenmatrix (maps EC-GV -> EC-AV, UD-GV -> UD-AV)
  const matrix: RseMatrixRow[] = [];
  const matSheet = sheetMap.get('RSE_Phasenmatrix');
  if (matSheet) {
    const { headers, rows } = readSheetRow1Headers(matSheet);
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
      if (matchedHeader) colByVersionKey.set(v.versionKey, matchedHeader);
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

      const finalStatuses =
        anyStatusFound || !master
          ? statusByVersionKey
          : deriveMatrixRowFromEvents(versions, eventsByRse.get(rseId) ?? []);

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
  if (matrix.length === 0 && rseList.length > 0) {
    for (const rse of rseList) {
      matrix.push({
        rseId: rse.rseId,
        spur: rse.spur,
        name: rse.name,
        kombiIdRaw: rse.currentKombiIdRaw,
        kombiIds: rse.currentKombiIds,
        statusByVersionKey: deriveMatrixRowFromEvents(versions, eventsByRse.get(rse.rseId) ?? []),
        rowIndex: rse.rowIndex,
      });
    }
  }

  // 6. Bauteil_Integrationen
  const kombis: KombiIntegration[] = [];
  const kombiSheet = sheetMap.get('Bauteil_Integrationen');
  if (kombiSheet) {
    const { rows } = readSheetRow1Headers(kombiSheet);
    for (const row of rows) {
      const acc = makeAccessor(row);
      const kombiId = acc.get(['Kombi_ID']);
      const partName = acc.get(['Bauteil_Bezeichnung']);
      if (!kombiId || !partName) continue;
      const involvedRseRaw = acc.get(['Beteiligte_RSE_IDs']);
      const involvedRseIds = parseIdList(involvedRseRaw);
      const rawVar = acc.get(['SGE_Variationsart']).replace(/\bGV\b/g, 'AV');
      kombis.push({
        kombiId,
        partName,
        integratedFromPhase: acc.get(['Integration_ab_Phase']),
        rseCountInPart: parseNumber(acc.get(['Anzahl_RSE_im_Bauteil']), involvedRseIds.length),
        involvedRseRaw,
        involvedRseIds,
        involvedLanes: acc.get(['Beteiligte_Spuren']),
        variationType: rawVar,
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
      const rawVar = acc.get(['Variationsart', 'SGE_Variationsart']);
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
        variationType: rawVar ? parseVariationKind(rawVar) : 'AV',
        change,
        result: acc.get(['Beobachtetes Ergebnis']),
        evaluation,
        mediaRef: acc.get(['Medien_Ref']),
        isPlaceholder,
        rowIndex: row.rowIndex,
      });
    }
  }

  const microCountByRse = new Map<string, number>();
  for (const m of microIterations) {
    if (m.rseId) microCountByRse.set(m.rseId, (microCountByRse.get(m.rseId) ?? 0) + 1);
  }
  for (const r of rseList) {
    if (r.versionEventsCount === 0) r.versionEventsCount = eventsByRse.get(r.rseId)?.length ?? 0;
    if (r.microIterationsCount === 0) r.microIterationsCount = microCountByRse.get(r.rseId) ?? 0;
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

  // 13. SGE_Auswertung (normalize legacy GV text labels -> AV)
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
      const rawMetric = acc.get(['SGE_Kennzahl / Status_Code', 'SGE_Kennzahl']);
      if (!rawMetric) continue;
      const metricLabel = rawMetric
        .replace(/EC-GV/g, 'EC-AV')
        .replace(/UD-GV/g, 'UD-AV')
        .replace(/Gestaltvariation/g, 'Attribute Variation (AV)')
        .replace(/Gestaltabweichung/g, 'Attributabweichung (UD-AV)');
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

  // Populate structured references for every development event
  events = populateEventReferences(
    events,
    rseList,
    versions,
    kombis,
    steps,
    arrows,
    explicitRefsByEventId
  );

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
 * Generates an updated 14-sheet SGE XLSX workbook incorporating all edits,
 * canonical CV/AV/PV nomenclature, G_n / E_{n,m} hierarchy, and RSE_Referenzen.
 */
export function buildUpdatedWorkbookBytes(
  dataset: SgeDataset,
  edits?: ProjectEditsOverlay,
  mediaMap: Record<string, MediaAttachment> = {}
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const mergedEvents = dataset.events.map((ev) => {
    const patch = edits?.events[ev.eventId];
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
      variationType: deriveVariationTypeFromStatus(statusCode, 'en'),
      stateDescription: patch?.stateDescription ?? ev.stateDescription,
      rationale: patch?.rationale ?? ev.rationale,
      mediaRef: resolvedMediaRef,
    };
  });

  const mergedMicro = dataset.microIterations.map((m) => {
    const patch = edits?.microIterations[m.id];
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
    const patch = edits?.kombis[k.kombiId];
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

  const evByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of mergedEvents) {
    const list = evByRse.get(ev.rseId) ?? [];
    list.push(ev);
    evByRse.set(ev.rseId, list);
  }

  const recomputedMatrix = dataset.rseList.map((rse) => {
    const statusByVersionKey = deriveMatrixRowFromEvents(
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recomputedMatrix), 'RSE_Phasenmatrix');

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

  // 6. RSE_Referenzen (structured references for each event)
  const refRows: Record<string, string>[] = [];
  for (const ev of mergedEvents) {
    for (const ref of ev.references) {
      refRows.push({
        Ref_ID: ref.id,
        Event_ID: ev.eventId,
        Ziel_RSE_ID: ev.rseId,
        Version: ev.version,
        Ref_RSE_ID: ref.refRseId,
        Ref_Bezeichnung: ref.refName,
        Herkunft_Generation: ref.originGeneration,
        Variationsart: ref.variationType,
        Begruendung: ref.rationale,
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refRows), 'RSE_Referenzen');

  // 7. Bauteil_Integrationen
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

  // 8. Phasen_Konfiguration (with G_n, E_{n,m}, ME G_n)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      dataset.versions.map((v) => ({
        Version_Key: v.versionKey,
        Sortier_Nr: v.sortOrder,
        Generation_ID: v.generationId,
        Generation_Name: v.generationName,
        Engineering_Gen_ID: v.engineeringGenId,
        Phasen_Name: v.phaseName,
        Meilenstein_Label: v.milestoneLabel || '-',
        Meilenstein_Badge: v.milestoneBadge || '-',
        'Technischer Systemstand & Einordnung': v.systemStateSummary,
      }))
    ),
    'Phasen_Konfiguration'
  );

  // 9. Entwicklungsschritte
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

  // 10. Ursachen_Tests_Befunde
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

  // 11. Verbindungen_Pfeile
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

  // 12. Mikro_Iterationen
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
        Variationsart: m.variationType ?? 'AV',
        'Konstruktive / Fertigungstechnische Änderung': m.change,
        'Beobachtetes Ergebnis': m.result,
        Bewertung: m.evaluation,
        Medien_Ref: m.mediaRef,
      }))
    ),
    'Mikro_Iterationen'
  );

  // 13. Methodik_Learnings
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

  // 14. Vorab_Dimensionierung
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

function triggerXlsxDownload(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadUpdatedXlsx(
  dataset: SgeDataset,
  edits?: ProjectEditsOverlay,
  mediaMap: Record<string, MediaAttachment> = {}
): void {
  const bytes = buildUpdatedWorkbookBytes(dataset, edits, mediaMap);
  triggerXlsxDownload(bytes, 'Duckomat_Entwicklungsdatenbank_SGE_aktualisiert.xlsx');
}

export function downloadSampleProjectXlsx(
  dataset: SgeDataset,
  mediaMap: Record<string, MediaAttachment> = {}
): void {
  const bytes = buildUpdatedWorkbookBytes(dataset, undefined, mediaMap);
  triggerXlsxDownload(bytes, 'Duckomat_SGE_Beispielprojekt_G0_G3.xlsx');
}

/**
 * Generates and downloads a clean empty SGE Excel template including an instructional
 * sheet ("Anleitung_SGE_Modell") explaining G_n, E_{n,m}, ME G_n, CV/AV/PV, and RSE_Referenzen.
 */
export function buildEmptySgeTemplateBytes(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 0: Anleitung_SGE_Modell
  const guideRows = [
    {
      Abschnitt: '1. Generationen-Hierarchie (G_n & E_{n,m})',
      Konzept: 'Systemgenerationen G_0 .. G_n',
      Erklaerung:
        'G_0 bezeichnet das Referenzsystem (Gen. n-1). G_1, G_2, G_3 ... sind die Systemgenerationen (z. B. G_1: GSD-Abschluss, G_2: Entenrennen, G_3: Antrittsvorlesung / Aktueller Stand).',
      Beispiel: 'Generation_ID = G_1; Engineering_Gen_ID = E_{1,1}; Meilenstein_Label = ME G_1',
    },
    {
      Abschnitt: '1. Generationen-Hierarchie (G_n & E_{n,m})',
      Konzept: 'Engineering Generations E_{n,m}',
      Erklaerung:
        'Zwischenstände innerhalb der Entwicklung von G_n werden als E_{n,1}, E_{n,2}, ... dokumentiert und münden im Meilenstein ME G_n.',
      Beispiel: 'E_{3,1} -> E_{3,2} -> E_{3,3} -> E_{3,4} (ME G_3)',
    },
    {
      Abschnitt: '2. Kanonische SGE-Variationsarten (Albers et al.)',
      Konzept: 'CV – Carryover Variation (ÜV)',
      Erklaerung:
        'Element/Subsystem aus Referenzsystem übernommen (max. Schnittstellenanpassung). Erzeugt in der 2D-Swimlane KEINEN Kasten (nur Referenzzähler).',
      Beispiel: 'Status_Code = CV',
    },
    {
      Abschnitt: '2. Kanonische SGE-Variationsarten (Albers et al.)',
      Konzept: 'AV – Attribute Variation',
      Erklaerung:
        'Prinzip & Struktur bleiben erhalten; Attribute/Geometrie/Werkstoff werden angepasst. Geplant: EC-AV, Ungeplant: UD-AV.',
      Beispiel: 'Status_Code = EC-AV oder UD-AV',
    },
    {
      Abschnitt: '2. Kanonische SGE-Variationsarten (Albers et al.)',
      Konzept: 'PV – Principle Variation',
      Erklaerung:
        'Elemente und Wirkzusammenhänge werden geändert (EC-PV / UD-PV), neu hinzugefügt (NEW) oder entfernt/ersetzt (REM / Entfall).',
      Beispiel: 'Status_Code = EC-PV, UD-PV, NEW oder REM',
    },
    {
      Abschnitt: '3. Referenz-Zuordnung (RSE_Referenzen)',
      Konzept: 'Genutzte Referenzsystemelemente pro Schritt',
      Erklaerung:
        'Im Blatt RSE_Referenzen werden je Event_ID alle referenzierten RSE aus G_{n-1} oder extern mit ihrer Variationsart (CV, AV, PV, REM) und Begründung erfasst.',
      Beispiel: 'Event_ID = EV001; Ref_RSE_ID = R1.1; Herkunft_Generation = G_0; Variationsart = AV',
    },
    {
      Abschnitt: '4. Medien & Fotos (Medien_Ref)',
      Konzept: 'Relative Pfade im Repo',
      Erklaerung:
        'Tragen Sie relative Pfade wie media/v1_0_R1_1.png ein. Hochgeladene Fotos werden beim ZIP-Export automatisch unter public/media/ abgelegt.',
      Beispiel: 'Medien_Ref = media/E1_1_R1_1.png',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'Anleitung_SGE_Modell');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Spur_ID: 'S1_Rahmen_Peripherie',
        'Systemspur / Baugruppe': 'Rahmen & Peripherie',
        'Rolle im Gesamtsystem': 'Beschreibung der Baugruppenrolle',
        'RSE gesamt': 1,
        'Aktive RSE (v2.2)': 1,
        'Entfernt / Ersetzt': 0,
        'Integrierte RSE (Kombi)': 0,
        'Versions-Events': 2,
        'Mikro-Iterationen': 0,
        'Events geprüft': '2 / 2',
        'Aktueller Reifegrad (SGE-Überblick)': 'Kurzfassung Reifegrad',
      },
    ]),
    'Überblick_Dashboard'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Version_Key: 'v0.0',
        Sortier_Nr: 1,
        Generation_ID: 'G_0',
        Generation_Name: 'Referenzsystem (Gen. n-1)',
        Engineering_Gen_ID: 'G_0',
        Phasen_Name: 'v0.0 Referenzsystem',
        Meilenstein_Label: 'Ref. G_0',
        Meilenstein_Badge: 'Referenz (G_0)',
        'Technischer Systemstand & Einordnung': 'Ausgangssystem der Vorgängergeneration.',
      },
      {
        Version_Key: 'v1.0',
        Sortier_Nr: 2,
        Generation_ID: 'G_1',
        Generation_Name: 'GSD-Abschluss',
        Engineering_Gen_ID: 'E_{1,1}',
        Phasen_Name: 'v1.0 GSD-Abschluss',
        Meilenstein_Label: 'ME G_1',
        Meilenstein_Badge: 'ME G_1: GSD-Abschluss',
        'Technischer Systemstand & Einordnung': 'Erste Systemgeneration G_1.',
      },
      {
        Version_Key: 'v2.0',
        Sortier_Nr: 3,
        Generation_ID: 'G_2',
        Generation_Name: 'Entenrennen',
        Engineering_Gen_ID: 'E_{2,1}',
        Phasen_Name: 'v2.0 Entenrennen',
        Meilenstein_Label: 'ME G_2',
        Meilenstein_Badge: 'ME G_2: Entenrennen',
        'Technischer Systemstand & Einordnung': 'Zweite Systemgeneration G_2.',
      },
    ]),
    'Phasen_Konfiguration'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        RSE_ID: 'R1.1',
        Spur: 'S1_Rahmen_Peripherie',
        RSE_Bezeichnung: 'Beispiel-Referenzsystemelement',
        Herkunft: 'Vorgängermodell (Gen. n-1)',
        Erste_Version: 'v0.0 Referenzsystem',
        Erste_Ver_Nr: 1,
        Entfall_Version: '',
        Entfall_Ver_Nr: 999,
        Aktueller_Lebenszyklus: 'Aktiv',
        Vorgaenger_oder_Ersatz_RSE: '',
        Aktuelle_Kombi_ID: '',
        RSE_Anzahl_im_Bauteil: 1,
        Anzahl_Versions_Events: 2,
        Anzahl_Mikro_Iterationen: 0,
        Pruefstatus_Inhalt: 'Vorlage',
        Kurzbeschreibung_Funktion: 'Kurzbeschreibung der Funktion dieses RSE.',
      },
    ]),
    'RSE_Stammdaten'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Event_ID: 'EV001',
        RSE_ID: 'R1.1',
        Spur: 'S1_Rahmen_Peripherie',
        Version: 'v0.0 Referenzsystem',
        Version_Nr: 1,
        Lookup_Key: 'R1.1|1',
        Status_Code: 'BASE',
        Planungs_Kategorie_Fig2: 'Referenzsystem G_0 (Grau)',
        SGE_Variationstyp: 'Referenzsystem (G_0)',
        Kombi_Bauteil_ID: '',
        Kurzbeschreibung_Zustand: 'Ausgangsstand aus Referenzsystem G_0.',
        Begruendung: 'Referenzbasis',
        Ursache_ID: '',
        Schritt_ID: 'E01',
        Pruefstatus_Inhalt: 'Vorlage',
        Medien_Ref: '',
      },
      {
        Event_ID: 'EV002',
        RSE_ID: 'R1.1',
        Spur: 'S1_Rahmen_Peripherie',
        Version: 'v1.0 GSD-Abschluss',
        Version_Nr: 2,
        Lookup_Key: 'R1.1|2',
        Status_Code: 'EC-AV',
        Planungs_Kategorie_Fig2: 'Engineering change (Orange)',
        SGE_Variationstyp: 'AV (Attribute Variation)',
        Kombi_Bauteil_ID: '',
        Kurzbeschreibung_Zustand: 'Geometrie/Material angepasst (Attribute Variation).',
        Begruendung: 'Gewichts- und Bauraumoptimierung',
        Ursache_ID: 'U01',
        Schritt_ID: 'E02',
        Pruefstatus_Inhalt: 'Vorlage',
        Medien_Ref: '',
      },
    ]),
    'RSE_Phasenwechsel'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        RSE_ID: 'R1.1',
        Spur: 'S1_Rahmen_Peripherie',
        RSE_Bezeichnung: 'Beispiel-Referenzsystemelement',
        Kombi_ID: '',
        'v0.0 Referenzsystem': 'BASE',
        'v1.0 GSD-Abschluss': 'EC-AV',
        'v2.0 Entenrennen': 'CV',
      },
    ]),
    'RSE_Phasenmatrix'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Ref_ID: 'EV002_ref_1',
        Event_ID: 'EV002',
        Ziel_RSE_ID: 'R1.1',
        Version: 'v1.0 GSD-Abschluss',
        Ref_RSE_ID: 'R1.1',
        Ref_Bezeichnung: 'Beispiel-Referenzsystemelement',
        Herkunft_Generation: 'G_0',
        Variationsart: 'AV',
        Begruendung: 'Geometrie- und Werkstoffanpassung bei gleichbleibendem Wirkprinzip.',
      },
    ]),
    'RSE_Referenzen'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Kombi_ID: 'KOMBI-01',
        Bauteil_Bezeichnung: '',
        Integration_ab_Phase: '',
        Anzahl_RSE_im_Bauteil: 0,
        Beteiligte_RSE_IDs: '',
        Beteiligte_Spuren: '',
        SGE_Variationsart: 'PV (Funktionsintegration)',
        Begruendung_Funktionsintegration: '',
        Medien_Ref: '',
      },
    ]),
    'Bauteil_Integrationen'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Detail_Box: 'Box A1',
        RSE_ID: 'R1.1',
        Spur: 'S1_Rahmen_Peripherie',
        Version: 'v1.0 GSD-Abschluss',
        Gehört_zu_Schritt: 'E02',
        Sub_Version_ID: 'E1_1_M1',
        Variationsart: 'AV',
        'Konstruktive / Fertigungstechnische Änderung': 'Erste Detailiteration (Vorlage)',
        'Beobachtetes Ergebnis': 'Funktion bestätigt',
        Bewertung: 'Übernommen',
        Medien_Ref: '',
      },
    ]),
    'Mikro_Iterationen'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Schritt_ID: 'E01',
        Spur: 'S1_Rahmen_Peripherie',
        RSE_ID: 'R1.1',
        Version: 'v0.0 Referenzsystem',
        Version_Nr: 1,
        Schritt_Typ: 'Ausgangsstand',
        Kurz_Titel: 'Referenzstand G_0',
        'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)': 'Referenzstand',
        Automatischer_Stand: 'Überarbeitet / Abgelöst',
        Detail_Box: '',
        Learnings: '',
      },
      {
        Schritt_ID: 'E02',
        Spur: 'S1_Rahmen_Peripherie',
        RSE_ID: 'R1.1',
        Version: 'v1.0 GSD-Abschluss',
        Version_Nr: 2,
        Schritt_Typ: 'Weiterentwicklung',
        Kurz_Titel: 'Attributvariation G_1',
        'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)': 'Geometrie angepasst',
        Automatischer_Stand: 'Aktueller Stand (Final)',
        Detail_Box: 'Box A1',
        Learnings: 'M01',
      },
    ]),
    'Entwicklungsschritte'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Ursache_ID: 'U01',
        Kategorie: 'Planung / Anforderung',
        Spur_Bezug: 'S1_Rahmen_Peripherie',
        Betroffener_Schritt: 'E01',
        Ausgeloester_Schritt: 'E02',
        'Kurz_Titel (Befund / Test / Problem)': 'Beispiel-Befund',
        'Dokumentierte Beobachtung / Fakt': 'Messbare Beobachtung / Fakt.',
        'Hypothese / Grenze der Nachweiskraft': 'Abgeleitete Hypothese.',
        Learnings: 'M01',
      },
    ]),
    'Ursachen_Tests_Befunde'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Pfeil_ID: 'P_01',
        Von_Schritt_ID: 'E01',
        Nach_Schritt_ID: 'E02',
        'Pfeil_Typ (Visuelle Darstellung)': 'Weiterentwicklung (Optimierung)',
        Begruendung_Ursache_ID: 'U01',
        Spur_Bezug: 'S1 -> S1',
        'Begründung des Entwicklungsschritts (Anzeige am Pfeil)': 'Begründung der AV.',
        Wirkrichtung_Layout: 'Versionsübergreifend: Links -> Rechts',
      },
    ]),
    'Verbindungen_Pfeile'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Learning_ID: 'M01',
        Themenfeld: 'Konstruktionsmethodik',
        Kurz_Titel_Learning: 'Beispiel-Learning',
        'Übertragbares Prinzip (losgelöst vom Duckomat)': 'Allgemeines Gestaltungsprinzip.',
        'Konkretes Projektbeispiel (Anker in Datenbank)': 'Anwendung in E02.',
        Verknuepfte_Schritte: 'E02',
        Verknuepfte_Ursachen: 'U01',
        'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)': 'Einordnung im SGE-Kontext.',
      },
    ]),
    'Methodik_Learnings'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        'Parameter-ID': 'D01',
        Teilbereich: 'Allgemein',
        'Größe / Parameter': 'Beispiel-Parameter',
        Wert: '100',
        Einheit: 'mm',
        'Excel-Formel / Herkunft': 'Messung',
        'Evidenz-Typ': 'Messwert',
        'Methodische Einordnung / Kritische Prüfung': '',
      },
    ]),
    'Vorab_Dimensionierung'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        'SGE_Kennzahl / Status_Code': 'CV – Carryover Variation',
        'v0.0 Referenzsystem': '0',
        'v1.0 GSD-Abschluss': '0',
        'v2.0 Entenrennen': '1',
        Gesamt_Events_oder_Stand: '1',
      },
      {
        'SGE_Kennzahl / Status_Code': 'AV – Attribute Variation (EC-AV + UD-AV)',
        'v0.0 Referenzsystem': '0',
        'v1.0 GSD-Abschluss': '1',
        'v2.0 Entenrennen': '0',
        Gesamt_Events_oder_Stand: '1',
      },
    ]),
    'SGE_Auswertung'
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out as ArrayBuffer);
}

export function downloadEmptySgeTemplateXlsx(): void {
  const bytes = buildEmptySgeTemplateBytes();
  triggerXlsxDownload(bytes, 'SGE_Entwicklungsdatenbank_Leeres_Template.xlsx');
}
