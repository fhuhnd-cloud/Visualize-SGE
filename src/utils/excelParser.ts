import * as XLSX from 'xlsx';
import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  DuckomatDataset,
  EdgeCategory,
  MethodikLearning,
  MicroIteration,
  PhaseConfig,
  PhaseType,
  SheetNameV2,
  StandCategory,
  ValidationIssue,
  ValidationReport,
} from '../types/duckomat';
import { CANONICAL_LANES } from './visualConfig';

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

export function isMilestoneStepType(stepType: string): boolean {
  const t = normalizeKey(stepType);
  return t.includes('meilenstein') || t.includes('pruefpunkt') || t.includes('milestone');
}

/**
 * Classifies Automatischer_Stand strictly per v5 rules:
 * - Milestone nodes (Schritt_Typ === "Meilenstein" or Automatischer_Stand === "Meilenstein (Prüfpunkt)")
 *   are NEVER marked as "final".
 * - Green "FINAL" applies EXCLUSIVELY to Automatischer_Stand === "Aktueller Stand (Final)".
 */
export function classifyStand(
  rawStand: string,
  stepType = '',
  isMilestonePhase = false
): StandCategory {
  const trimmed = rawStand.trim();
  const s = normalizeKey(trimmed);

  // Explicit milestone check first — milestones are NEVER Final
  if (
    isMilestoneStepType(stepType) ||
    s.includes('meilenstein') ||
    s.includes('pruefpunkt') ||
    s.includes('milestone')
  ) {
    return 'milestone';
  }

  if (!trimmed || trimmed.startsWith('#') || !s) {
    return 'other';
  }

  // Explicit negations
  if (
    s.includes('nichtmehraktuell') ||
    s.includes('nichtaktuell') ||
    s.includes('nichtfinal')
  ) {
    return 'superseded';
  }

  // Strict Final check: "Aktueller Stand (Final)" (never auto-promoted for milestone phases unless explicitly stated)
  const isExplicitFinalText =
    s === 'aktuellerstandfinal' ||
    (s.includes('aktuellerstand') && s.includes('final'));

  if (isExplicitFinalText) {
    return 'final';
  }

  // Superseded / reworked stand indicators
  if (
    s.includes('ueberarbeitet') ||
    s.includes('abgeloest') ||
    s.includes('ersetzt') ||
    s.includes('verworfen') ||
    s.includes('vorgaenger') ||
    s.includes('historisch') ||
    s.includes('veraltet') ||
    s.includes('obsolet') ||
    s.includes('zwischenstand')
  ) {
    return 'superseded';
  }

  // Do not auto-promote steps inside milestone phases
  if (isMilestonePhase) {
    return 'other';
  }

  return 'other';
}

export function classifyPhaseType(rawType: string): PhaseType {
  const t = normalizeKey(rawType);
  if (t.includes('meilenstein') || t.includes('milestone')) {
    return 'Meilenstein';
  }
  return 'Arbeitsphase';
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

export function parseCauseIdList(raw: string): string[] {
  return parseIdList(raw);
}

export function resolveCanonicalLane(rawSpur: string): string {
  const trimmed = rawSpur.trim();
  if (!trimmed) return 'S0_Gesamtsystem';

  const norm = normalizeKey(trimmed);
  for (const canonical of CANONICAL_LANES) {
    if (canonical === trimmed || normalizeKey(canonical) === norm) {
      return canonical;
    }
  }

  const codeMatch = trimmed.match(/^(S\d+)(?:[_\-:\s]|$)/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const byCode = CANONICAL_LANES.find((c) => c.toUpperCase().startsWith(`${code}_`));
    if (byCode) return byCode;
  }

  return trimmed;
}

export function sortLanesV2(lanesFromData: string[]): string[] {
  const canonicalOrder = new Map<string, number>(
    CANONICAL_LANES.map((lane, idx) => [lane, idx])
  );
  const allLanes = new Set<string>([...CANONICAL_LANES, ...lanesFromData.filter(Boolean)]);

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
  targetNames: string[]
): { sheet?: XLSX.WorkSheet; matchedName?: string } {
  const normalizedTargets = targetNames.map(normalizeKey);
  for (const name of workbook.SheetNames) {
    const norm = normalizeKey(name);
    if (normalizedTargets.includes(norm)) {
      return { sheet: workbook.Sheets[name], matchedName: name };
    }
  }
  for (const name of workbook.SheetNames) {
    const norm = normalizeKey(name);
    if (normalizedTargets.some((t) => norm.includes(t) || t.includes(norm))) {
      return { sheet: workbook.Sheets[name], matchedName: name };
    }
  }
  return {};
}

interface ParsedSheetRow {
  rowIndex: number; // 1-based Excel row number
  values: Record<string, string>;
  uncachedFormulaKeys: Set<string>;
}

function buildRowAccessor(row: ParsedSheetRow) {
  const normalizedEntries = Object.entries(row.values).map(([k, v]) => ({
    key: k,
    norm: normalizeKey(k),
    value: v,
    hasUncachedFormula: row.uncachedFormulaKeys.has(k),
  }));

  const findEntry = (candidates: string[]) => {
    const normCandidates = candidates.map((c) => normalizeKey(c.trim()));
    for (const nc of normCandidates) {
      const exact = normalizedEntries.find((e) => e.norm === nc);
      if (exact) return exact;
    }
    for (const nc of normCandidates) {
      const partial = normalizedEntries.find(
        (e) =>
          e.norm.includes(nc) ||
          (e.norm.length >= 4 && nc.includes(e.norm))
      );
      if (partial) return partial;
    }
    return undefined;
  };

  const get = (candidates: string[]): string => findEntry(candidates)?.value ?? '';
  const isUncachedFormula = (candidates: string[]): boolean =>
    findEntry(candidates)?.hasUncachedFormula ?? false;

  return { get, isUncachedFormula };
}

function detectHeaderRowIndex(
  sheet: XLSX.WorkSheet,
  keyColumnAliases: string[],
  maxScanRows = 10
): number {
  if (!sheet['!ref']) return 0;
  const ref = XLSX.utils.decode_range(sheet['!ref']);
  const lastScanRow = Math.min(maxScanRows - 1, ref.e.r);
  const normAliases = keyColumnAliases.map((a) => normalizeKey(a.trim()));

  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r <= lastScanRow; r++) {
      for (let c = ref.s.c; c <= ref.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const text = cell ? cleanCell(cell.v ?? cell.w) : '';
        if (!text) continue;
        const normCell = normalizeKey(text);
        const matched =
          pass === 0
            ? normAliases.includes(normCell)
            : normAliases.some((alias) => normCell.startsWith(alias));
        if (matched) return r;
      }
    }
  }
  return 0;
}

function readSheetWithMeta(
  sheet: XLSX.WorkSheet,
  keyColumnAliases: string[]
): { headerRowIndex: number; headers: string[]; rows: ParsedSheetRow[] } {
  if (!sheet['!ref']) {
    return { headerRowIndex: 0, headers: [], rows: [] };
  }

  const ref = XLSX.utils.decode_range(sheet['!ref']);
  const headerRowIndex = detectHeaderRowIndex(sheet, keyColumnAliases, 10);

  const colHeaders = new Map<number, string>();
  const headers: string[] = [];
  for (let c = ref.s.c; c <= ref.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c })];
    const text = cell ? cleanCell(cell.v ?? cell.w) : '';
    if (text) {
      colHeaders.set(c, text);
      headers.push(text);
    }
  }

  const rows: ParsedSheetRow[] = [];
  for (let r = headerRowIndex + 1; r <= ref.e.r; r++) {
    const values: Record<string, string> = {};
    const uncachedFormulaKeys = new Set<string>();
    let hasAnyContent = false;

    for (const [c, headerName] of colHeaders.entries()) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) {
        values[headerName] = '';
        continue;
      }

      if (cell.t === 'e') {
        values[headerName] = '';
        uncachedFormulaKeys.add(headerName);
        continue;
      }

      const rawVal = cell.v !== undefined && cell.v !== null ? cell.v : cell.w;
      const text = cleanCell(rawVal);

      if (!text && cell.f) {
        values[headerName] = '';
        uncachedFormulaKeys.add(headerName);
        continue;
      }

      values[headerName] = text;
      if (text) hasAnyContent = true;
    }

    if (hasAnyContent) {
      rows.push({
        rowIndex: r + 1,
        values,
        uncachedFormulaKeys,
      });
    }
  }

  return { headerRowIndex, headers, rows };
}

function extractLeadingPhaseCode(value: string): string | null {
  const match = value.trim().match(/^([PM]\d+)\b/i) ?? value.trim().match(/^([PM]\d+)[_\-:\s]/i);
  return match ? match[1].toUpperCase() : null;
}

function resolveStepPhase(
  rawPhase: string,
  rawPhaseNr: string,
  configuredPhases: PhaseConfig[]
): PhaseConfig | null {
  if (configuredPhases.length === 0) return null;

  const trimmedPhase = rawPhase.trim();
  const normPhase = normalizeKey(trimmedPhase);

  if (trimmedPhase) {
    const byExactKey = configuredPhases.find((p) => p.phaseKey === trimmedPhase);
    if (byExactKey) return byExactKey;

    const byExactName = configuredPhases.find((p) => p.name === trimmedPhase);
    if (byExactName) return byExactName;

    const byNormKey = configuredPhases.find((p) => normalizeKey(p.phaseKey) === normPhase);
    if (byNormKey) return byNormKey;

    const byNormName = configuredPhases.find((p) => normalizeKey(p.name) === normPhase);
    if (byNormName) return byNormName;

    const stepCode = extractLeadingPhaseCode(trimmedPhase);
    if (stepCode) {
      const codeMatches = configuredPhases.filter(
        (p) =>
          extractLeadingPhaseCode(p.phaseKey) === stepCode ||
          extractLeadingPhaseCode(p.name) === stepCode
      );
      if (codeMatches.length === 1) return codeMatches[0];
    }

    if (normPhase.length >= 3) {
      const subMatches = configuredPhases.filter((p) => {
        const nk = normalizeKey(p.phaseKey);
        const nn = normalizeKey(p.name);
        return (
          (nk.length >= 3 && (normPhase.includes(nk) || nk.includes(normPhase))) ||
          (nn.length >= 4 && (normPhase.includes(nn) || nn.includes(normPhase)))
        );
      });
      if (subMatches.length === 1) return subMatches[0];
    }
  }

  const trimmedNr = rawPhaseNr.trim();
  if (trimmedNr) {
    const parsedNr = Number(trimmedNr.replace(',', '.'));
    if (Number.isFinite(parsedNr)) {
      const bySortNr = configuredPhases.find((p) => p.sortOrder === parsedNr);
      if (bySortNr) return bySortNr;
    }
  }

  const numericPhaseMatch = trimmedPhase.match(/^(?:phase\s*)?(\d+)$/i);
  if (numericPhaseMatch) {
    const parsed = Number(numericPhaseMatch[1]);
    const bySortNr = configuredPhases.find((p) => p.sortOrder === parsed);
    if (bySortNr) return bySortNr;
  }

  return null;
}

function checkMissingColumns(
  headers: string[],
  requiredGroups: { label: string; aliases: string[] }[],
  sheetName: SheetNameV2,
  issues: ValidationIssue[]
) {
  const normHeaders = headers.map((h) => normalizeKey(h.trim()));
  for (const req of requiredGroups) {
    const normAliases = req.aliases.map((a) => normalizeKey(a.trim()));
    const found = normHeaders.some((h) =>
      normAliases.some((a) => h === a || h.includes(a) || a.includes(h))
    );
    if (!found) {
      issues.push({
        id: `col-${sheetName}-${normalizeKey(req.label)}`,
        severity: 'warning',
        sheet: sheetName,
        message: `Erwartete Spalte "${req.label}" wurde im Tabellenblatt "${sheetName}" (Zeile 1) nicht erkannt.`,
        hint: 'Prüfen Sie die Spaltenüberschrift in Zeile 1 Ihrer Excel-Datei.',
      });
    }
  }
}

export function validateDataset(
  dataset: DuckomatDataset,
  preExistingIssues: ValidationIssue[] = []
): ValidationReport {
  const issues: ValidationIssue[] = [...preExistingIssues];

  // 1. Validate Phasen_Konfiguration
  const phaseKeyCounts = new Map<string, number>();
  const phaseKeySet = new Set<string>();
  for (const phase of dataset.phases) {
    if (!phase.phaseKey) {
      issues.push({
        id: `phase-missing-key-${phase.rowIndex}`,
        severity: 'error',
        sheet: 'Phasen_Konfiguration',
        message: `Zeile ${phase.rowIndex}: Phase ohne Phase_Key gefunden.`,
      });
      continue;
    }
    phaseKeyCounts.set(phase.phaseKey, (phaseKeyCounts.get(phase.phaseKey) ?? 0) + 1);
    phaseKeySet.add(phase.phaseKey);
  }
  for (const [key, count] of phaseKeyCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-phase-${key}`,
        severity: 'error',
        sheet: 'Phasen_Konfiguration',
        referenceId: key,
        message: `Doppelter Phase_Key "${key}" (${count}× vorhanden).`,
      });
    }
  }

  // 2. Validate Entwicklungsschritte
  const stepIdCounts = new Map<string, number>();
  const stepMap = new Map<string, DevelopmentStep>();
  for (const step of dataset.steps) {
    if (!step.id) {
      issues.push({
        id: `step-missing-id-${step.rowIndex}`,
        severity: 'error',
        sheet: 'Entwicklungsschritte',
        message: `Zeile ${step.rowIndex}: Entwicklungsschritt ohne Schritt_ID gefunden.`,
      });
      continue;
    }
    stepIdCounts.set(step.id, (stepIdCounts.get(step.id) ?? 0) + 1);
    stepMap.set(step.id, step);

    if (step.phase && phaseKeySet.size > 0 && !phaseKeySet.has(step.phase)) {
      issues.push({
        id: `step-unknown-phase-${step.id}`,
        severity: 'warning',
        sheet: 'Entwicklungsschritte',
        referenceId: step.id,
        message: `Schritt "${step.id}" verweist auf Phase "${step.phase}", die nicht in Phasen_Konfiguration definiert ist.`,
        hint: 'Prüfen Sie die Schreibweise von Phase und Phase_Key.',
      });
    }

    if (!step.title) {
      issues.push({
        id: `step-missing-title-${step.id}`,
        severity: 'warning',
        sheet: 'Entwicklungsschritte',
        referenceId: step.id,
        message: `Schritt "${step.id}" besitzt keinen Kurz_Titel.`,
      });
    }
  }

  for (const [id, count] of stepIdCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-step-${id}`,
        severity: 'error',
        sheet: 'Entwicklungsschritte',
        referenceId: id,
        message: `Doppelte Schritt_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  // 3. Validate Ursachen_Tests_Befunde
  const causeIdCounts = new Map<string, number>();
  const causeMap = new Map<string, CauseFinding>();
  for (const cause of dataset.causes) {
    if (!cause.id) {
      issues.push({
        id: `cause-missing-id-${cause.rowIndex}`,
        severity: 'warning',
        sheet: 'Ursachen_Tests_Befunde',
        message: `Zeile ${cause.rowIndex}: Eintrag ohne Ursache_ID gefunden.`,
      });
      continue;
    }
    causeIdCounts.set(cause.id, (causeIdCounts.get(cause.id) ?? 0) + 1);
    causeMap.set(cause.id, cause);

    if (cause.affectedStepId && !stepMap.has(cause.affectedStepId)) {
      issues.push({
        id: `cause-bad-affected-${cause.id}`,
        severity: 'warning',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: cause.id,
        message: `Ursache "${cause.id}": Betroffener_Schritt "${cause.affectedStepId}" existiert nicht in Entwicklungsschritte.`,
      });
    }
    if (cause.triggeredStepId && !stepMap.has(cause.triggeredStepId)) {
      issues.push({
        id: `cause-bad-triggered-${cause.id}`,
        severity: 'warning',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: cause.id,
        message: `Ursache "${cause.id}": Ausgeloester_Schritt "${cause.triggeredStepId}" existiert nicht in Entwicklungsschritte.`,
      });
    }
  }

  for (const [id, count] of causeIdCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-cause-${id}`,
        severity: 'error',
        sheet: 'Ursachen_Tests_Befunde',
        referenceId: id,
        message: `Doppelte Ursache_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  // 4. Validate Verbindungen_Pfeile
  const arrowIdCounts = new Map<string, number>();
  const connectedStepIds = new Set<string>();
  for (const arrow of dataset.arrows) {
    if (arrow.id) {
      arrowIdCounts.set(arrow.id, (arrowIdCounts.get(arrow.id) ?? 0) + 1);
    }

    const hasFrom = Boolean(arrow.from && stepMap.has(arrow.from));
    const hasTo = Boolean(arrow.to && stepMap.has(arrow.to));

    if (!arrow.from || !hasFrom) {
      issues.push({
        id: `arrow-bad-from-${arrow.id || arrow.rowIndex}`,
        severity: 'error',
        sheet: 'Verbindungen_Pfeile',
        referenceId: arrow.id || `Zeile ${arrow.rowIndex}`,
        message: `Pfeil "${arrow.id || `Zeile ${arrow.rowIndex}`}": Von_Schritt_ID (${arrow.from || 'leer'}) existiert nicht in Entwicklungsschritte.`,
        hint: 'Prüfen Sie Schreibweise und ID im Blatt Entwicklungsschritte.',
      });
    }

    if (!arrow.to || !hasTo) {
      issues.push({
        id: `arrow-bad-to-${arrow.id || arrow.rowIndex}`,
        severity: 'error',
        sheet: 'Verbindungen_Pfeile',
        referenceId: arrow.id || `Zeile ${arrow.rowIndex}`,
        message: `Pfeil "${arrow.id || `Zeile ${arrow.rowIndex}`}": Nach_Schritt_ID (${arrow.to || 'leer'}) existiert nicht in Entwicklungsschritte.`,
        hint: 'Prüfen Sie Schreibweise und ID im Blatt Entwicklungsschritte.',
      });
    }

    if (arrow.from && arrow.to && arrow.from === arrow.to) {
      issues.push({
        id: `arrow-self-${arrow.id || arrow.rowIndex}`,
        severity: 'warning',
        sheet: 'Verbindungen_Pfeile',
        referenceId: arrow.from,
        message: `Pfeil "${arrow.id || `Zeile ${arrow.rowIndex}`}" verweist auf sich selbst (${arrow.from} → ${arrow.to}).`,
      });
    }

    for (const cId of arrow.causeIds) {
      if (!causeMap.has(cId)) {
        issues.push({
          id: `arrow-bad-cause-${arrow.id}-${cId}`,
          severity: 'warning',
          sheet: 'Verbindungen_Pfeile',
          referenceId: arrow.id,
          message: `Pfeil "${arrow.id}" verweist auf Begruendung_Ursache_ID "${cId}", die nicht in Ursachen_Tests_Befunde existiert.`,
        });
      }
    }

    if (hasFrom && hasTo) {
      connectedStepIds.add(arrow.from);
      connectedStepIds.add(arrow.to);
    }
  }

  for (const [id, count] of arrowIdCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-arrow-${id}`,
        severity: 'error',
        sheet: 'Verbindungen_Pfeile',
        referenceId: id,
        message: `Doppelte Pfeil_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  // Isolated steps
  if (dataset.steps.length > 1) {
    for (const step of dataset.steps) {
      if (step.id && !connectedStepIds.has(step.id)) {
        issues.push({
          id: `isolated-step-${step.id}`,
          severity: 'warning',
          sheet: 'Entwicklungsschritte',
          referenceId: step.id,
          message: `Isolierter Entwicklungsschritt "${step.id}" (${step.title || 'ohne Titel'}) besitzt keine Verbindung in Verbindungen_Pfeile.`,
        });
      }
    }
  }

  // 5. Validate Mikro_Iterationen & Detail_Box
  const microBoxes = new Set(dataset.microIterations.map((m) => m.detailBox).filter(Boolean));
  for (const step of dataset.steps) {
    if (step.detailBox && !microBoxes.has(step.detailBox)) {
      issues.push({
        id: `missing-detailbox-${step.id}-${step.detailBox}`,
        severity: 'warning',
        sheet: 'Mikro_Iterationen',
        referenceId: step.id,
        message: `Schritt "${step.id}" verweist auf Detail_Box "${step.detailBox}", es existieren jedoch keine Einträge in Mikro_Iterationen.`,
      });
    }
  }

  for (const micro of dataset.microIterations) {
    if (micro.parentStepId && !stepMap.has(micro.parentStepId)) {
      issues.push({
        id: `micro-bad-parent-${micro.rowIndex}`,
        severity: 'warning',
        sheet: 'Mikro_Iterationen',
        referenceId: micro.parentStepId,
        message: `Mikro-Iteration Zeile ${micro.rowIndex}: Gehört_zu_Schritt "${micro.parentStepId}" existiert nicht in Entwicklungsschritte.`,
      });
    }
  }

  // 6. Validate Methodik_Learnings (only duplicate Learning_ID; comma-separated Learnings on steps/causes never trigger errors)
  const learningIdCounts = new Map<string, number>();
  for (const learning of dataset.learnings) {
    if (!learning.id) continue;
    learningIdCounts.set(learning.id, (learningIdCounts.get(learning.id) ?? 0) + 1);
  }
  for (const [id, count] of learningIdCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `dup-learning-${id}`,
        severity: 'error',
        sheet: 'Methodik_Learnings',
        referenceId: id,
        message: `Doppelte Learning_ID "${id}" (${count}× vorhanden).`,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    checkedAt: new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    stats: {
      phaseCount: dataset.phases.length,
      milestoneCount: dataset.phases.filter((p) => p.phaseType === 'Meilenstein').length,
      stepCount: dataset.steps.length,
      finalStepCount: dataset.steps.filter((s) => s.standCategory === 'final').length,
      causeCount: dataset.causes.length,
      arrowCount: dataset.arrows.length,
      microIterationCount: dataset.microIterations.length,
      learningCount: dataset.learnings.length,
      laneCount: dataset.lanes.length,
    },
  };
}

export async function parseExcelFile(
  file: File
): Promise<{ dataset: DuckomatDataset; report: ValidationReport }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const preIssues: ValidationIssue[] = [];

  const phasesSheetMatch = findSheet(workbook, [
    'Phasen_Konfiguration',
    'PhasenKonfiguration',
    'Phasen',
  ]);
  const stepsSheetMatch = findSheet(workbook, [
    'Entwicklungsschritte',
    'Entwicklungsknoten',
    'Schritte',
  ]);
  const causesSheetMatch = findSheet(workbook, [
    'Ursachen_Tests_Befunde',
    'UrsachenTestsBefunde',
    'Ursachen',
    'Befunde',
  ]);
  const arrowsSheetMatch = findSheet(workbook, [
    'Verbindungen_Pfeile',
    'VerbindungenPfeile',
    'Pfeile',
    'Verbindungen',
  ]);
  const microSheetMatch = findSheet(workbook, [
    'Mikro_Iterationen',
    'MikroIterationen',
    'Mikro-Iterationen',
  ]);
  const learningsSheetMatch = findSheet(workbook, [
    'Methodik_Learnings',
    'MethodikLearnings',
    'Learnings',
  ]);

  if (!phasesSheetMatch.sheet) {
    preIssues.push({
      id: 'missing-sheet-phases',
      severity: 'error',
      sheet: 'Arbeitsmappe',
      message: 'Tabellenblatt "Phasen_Konfiguration" wurde nicht gefunden.',
      hint: `Gefundene Blätter: ${workbook.SheetNames.join(', ') || 'keine'}.`,
    });
  }
  if (!stepsSheetMatch.sheet) {
    preIssues.push({
      id: 'missing-sheet-steps',
      severity: 'error',
      sheet: 'Arbeitsmappe',
      message: 'Tabellenblatt "Entwicklungsschritte" wurde nicht gefunden.',
      hint: `Gefundene Blätter: ${workbook.SheetNames.join(', ') || 'keine'}.`,
    });
  }
  if (!causesSheetMatch.sheet) {
    preIssues.push({
      id: 'missing-sheet-causes',
      severity: 'warning',
      sheet: 'Arbeitsmappe',
      message: 'Tabellenblatt "Ursachen_Tests_Befunde" wurde nicht gefunden.',
    });
  }
  if (!arrowsSheetMatch.sheet) {
    preIssues.push({
      id: 'missing-sheet-arrows',
      severity: 'error',
      sheet: 'Arbeitsmappe',
      message: 'Tabellenblatt "Verbindungen_Pfeile" wurde nicht gefunden.',
      hint: `Gefundene Blätter: ${workbook.SheetNames.join(', ') || 'keine'}.`,
    });
  }
  if (!microSheetMatch.sheet) {
    preIssues.push({
      id: 'missing-sheet-micro',
      severity: 'warning',
      sheet: 'Arbeitsmappe',
      message: 'Tabellenblatt "Mikro_Iterationen" wurde nicht gefunden (Detail-Boxen bleiben leer).',
    });
  }

  // 1. Parse Phasen_Konfiguration
  const phases: PhaseConfig[] = [];
  if (phasesSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(phasesSheetMatch.sheet, [
      'Phase_Key',
      'PhaseKey',
      'Phasen_Name',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Phase_Key', aliases: ['Phase_Key', 'PhaseKey', 'Phase'] },
        { label: 'Sortier_Nr', aliases: ['Sortier_Nr', 'SortierNr', 'Sortierung'] },
        { label: 'Phasen_Name', aliases: ['Phasen_Name', 'PhasenName', 'Name'] },
        { label: 'Phasen_Typ', aliases: ['Phasen_Typ', 'PhasenTyp', 'Typ'] },
      ],
      'Phasen_Konfiguration',
      preIssues
    );

    rows.forEach((row, idx) => {
      const { get } = buildRowAccessor(row);
      const phaseKey = get(['Phase_Key', 'PhaseKey', 'Phase']);
      const sortRaw = get(['Sortier_Nr', 'SortierNr', 'Sortierung', 'Nr']);
      const name = get(['Phasen_Name', 'PhasenName', 'Name', 'Bezeichnung']);
      const rawPhaseType = get(['Phasen_Typ', 'PhasenTyp', 'Typ']);

      if (!phaseKey && !name && !sortRaw) return;

      const parsedSort = Number(sortRaw.replace(',', '.'));
      phases.push({
        phaseKey: phaseKey || name,
        sortOrder: Number.isFinite(parsedSort) && sortRaw !== '' ? parsedSort : idx + 1,
        name: name || phaseKey,
        phaseType: classifyPhaseType(rawPhaseType),
        rawPhaseType: rawPhaseType || 'Arbeitsphase',
        rowIndex: row.rowIndex,
      });
    });
  }

  phases.sort((a, b) => a.sortOrder - b.sortOrder || a.phaseKey.localeCompare(b.phaseKey, 'de'));
  const phaseTypeByKey = new Map(phases.map((p) => [p.phaseKey, p.phaseType]));

  // 2. Parse Entwicklungsschritte
  const steps: DevelopmentStep[] = [];
  const stepNeedsAutoStand = new Set<string>();

  if (stepsSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(stepsSheetMatch.sheet, [
      'Schritt_ID',
      'SchrittID',
      'Knoten-ID',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Schritt_ID', aliases: ['Schritt_ID', 'SchrittID', 'ID'] },
        { label: 'Spur', aliases: ['Spur', 'Swimlane'] },
        { label: 'Phase', aliases: ['Phase', 'Phase_Key'] },
        { label: 'Kurz_Titel', aliases: ['Kurz_Titel', 'Kurz-Titel', 'Titel'] },
        { label: 'Automatischer_Stand', aliases: ['Automatischer_Stand', 'Aktueller_Stand', 'Stand'] },
      ],
      'Entwicklungsschritte',
      preIssues
    );

    const standAliases = [
      'Automatischer_Stand',
      'Automatischer Stand',
      'Aktueller_Stand',
      'Stand_Aktuell',
      'Stand',
      'Status',
    ];

    rows.forEach((row) => {
      const { get, isUncachedFormula } = buildRowAccessor(row);
      const id = get(['Schritt_ID', 'SchrittID', 'ID']);
      const spur = get(['Spur', 'Swimlane']);
      const rawPhase = get(['Phase', 'Phase_Key', 'Phasen_Name']);
      const rawPhaseNr = get(['Phase_Nr', 'PhaseNr', 'Sortier_Nr']);
      const stepType = get(['Schritt_Typ', 'SchrittTyp', 'Typ']);
      const title = get(['Kurz_Titel', 'Kurz-Titel', 'Kurztitel', 'Titel']);
      const implementation = get([
        'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)',
        'Konstruktive / Logische Ausführung',
        'Konstruktive Ausführung',
        'Logische Ausführung',
        'Ausführung',
      ]);
      const rawStand = get(standAliases);
      const standHasUncachedFormula = isUncachedFormula(standAliases);
      const detailBox = get(['Detail_Box', 'Detail-Box', 'DetailBox', 'Detail-Auslagerung']);
      const rawLearnings = get(['Learnings', 'Methodik_Learnings', 'Learning_IDs', 'Learning']);

      if (!id && !title && !spur && !rawPhase && !implementation) return;

      const matchedPhase = resolveStepPhase(rawPhase, rawPhaseNr, phases);
      const resolvedPhaseKey = matchedPhase ? matchedPhase.phaseKey : rawPhase || 'Unzugeordnet';
      const resolvedPhaseNr = rawPhaseNr || (matchedPhase ? String(matchedPhase.sortOrder) : '');
      const isMilestonePhase = phaseTypeByKey.get(resolvedPhaseKey) === 'Meilenstein';
      const isMilestoneStep = isMilestoneStepType(stepType);

      const hasExplicitStand = Boolean(rawStand && !rawStand.startsWith('#'));

      let standText = hasExplicitStand ? rawStand : '';
      let standCategory = classifyStand(standText, stepType, isMilestonePhase);

      if (isMilestoneStep && !hasExplicitStand) {
        standText = 'Meilenstein (Prüfpunkt)';
        standCategory = 'milestone';
      } else if ((!hasExplicitStand || standHasUncachedFormula) && !isMilestoneStep && !isMilestonePhase) {
        // Only derive Automatischer_Stand dynamically for regular working-phase non-milestone steps
        // when the Excel formula value wasn't cached. Milestones & milestone-phase nodes are NEVER auto-promoted to Final.
        if (id) stepNeedsAutoStand.add(id);
      }

      steps.push({
        id,
        spur: resolveCanonicalLane(spur),
        phase: resolvedPhaseKey,
        phaseNr: resolvedPhaseNr,
        stepType,
        title,
        implementation,
        stand: standText,
        standCategory,
        detailBox,
        learnings: parseIdList(rawLearnings),
        rowIndex: row.rowIndex,
      });
    });
  }

  const knownPhaseKeys = new Set(phases.map((p) => p.phaseKey));
  let extraPhaseOrder = phases.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
  for (const step of steps) {
    if (step.phase && !knownPhaseKeys.has(step.phase)) {
      const parsedNr = Number(step.phaseNr.replace(',', '.'));
      phases.push({
        phaseKey: step.phase,
        sortOrder: Number.isFinite(parsedNr) && step.phaseNr !== '' ? parsedNr : extraPhaseOrder++,
        name: step.phase.replace(/_/g, ' '),
        phaseType: 'Arbeitsphase',
        rawPhaseType: 'Arbeitsphase',
        rowIndex: 0,
      });
      knownPhaseKeys.add(step.phase);
    }
  }

  phases.sort((a, b) => a.sortOrder - b.sortOrder || a.phaseKey.localeCompare(b.phaseKey, 'de'));

  // 3. Parse Ursachen_Tests_Befunde
  const causes: CauseFinding[] = [];
  if (causesSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(causesSheetMatch.sheet, [
      'Ursache_ID',
      'UrsacheID',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Ursache_ID', aliases: ['Ursache_ID', 'UrsacheID', 'ID'] },
        { label: 'Kategorie', aliases: ['Kategorie'] },
        { label: 'Betroffener_Schritt', aliases: ['Betroffener_Schritt', 'BetroffenerSchritt'] },
        { label: 'Ausgeloester_Schritt', aliases: ['Ausgeloester_Schritt', 'Ausgelöster_Schritt', 'AusgeloesterSchritt'] },
        {
          label: 'Kurz_Titel (Befund / Test / Problem)',
          aliases: ['Kurz_Titel (Befund / Test / Problem)', 'Kurz_Titel', 'Titel'],
        },
        {
          label: 'Dokumentierte Beobachtung / Fakt',
          aliases: ['Dokumentierte Beobachtung / Fakt', 'Dokumentierte Beobachtung', 'Beobachtung'],
        },
        {
          label: 'Hypothese / Grenze der Nachweiskraft',
          aliases: ['Hypothese / Grenze der Nachweiskraft', 'Hypothese', 'Nachweisgrenze'],
        },
      ],
      'Ursachen_Tests_Befunde',
      preIssues
    );

    rows.forEach((row) => {
      const { get } = buildRowAccessor(row);
      const id = get(['Ursache_ID', 'UrsacheID', 'ID']);
      const category = get(['Kategorie', 'Typ']);
      const laneRef = get(['Spur_Bezug', 'SpurBezug', 'Spur']);
      const affectedStepId = get(['Betroffener_Schritt', 'BetroffenerSchritt']);
      const triggeredStepId = get([
        'Ausgeloester_Schritt',
        'Ausgelöster_Schritt',
        'AusgeloesterSchritt',
      ]);
      const title = get([
        'Kurz_Titel (Befund / Test / Problem)',
        'Kurz_Titel',
        'Kurz-Titel',
        'Titel',
      ]);
      const observation = get([
        'Dokumentierte Beobachtung / Fakt',
        'Dokumentierte Beobachtung',
        'Beobachtung / Fakt',
        'Beobachtung',
      ]);
      const hypothesis = get([
        'Hypothese / Grenze der Nachweiskraft',
        'Hypothese / Nachweisgrenze',
        'Hypothese',
      ]);
      const rawLearnings = get(['Learnings', 'Methodik_Learnings', 'Learning_IDs', 'Learning']);

      if (!id && !title && !observation && !hypothesis) return;

      causes.push({
        id,
        category,
        laneRef,
        affectedStepId,
        triggeredStepId,
        title,
        observation,
        hypothesis,
        learnings: parseIdList(rawLearnings),
        rowIndex: row.rowIndex,
      });
    });
  }

  // 4. Parse Verbindungen_Pfeile
  const arrows: ConnectionArrow[] = [];
  if (arrowsSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(arrowsSheetMatch.sheet, [
      'Pfeil_ID',
      'PfeilID',
      'Kanten-ID',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Pfeil_ID', aliases: ['Pfeil_ID', 'PfeilID', 'ID'] },
        { label: 'Von_Schritt_ID', aliases: ['Von_Schritt_ID', 'VonSchrittID', 'Von'] },
        { label: 'Nach_Schritt_ID', aliases: ['Nach_Schritt_ID', 'NachSchrittID', 'Nach'] },
        {
          label: 'Pfeil_Typ (Visuelle Darstellung)',
          aliases: ['Pfeil_Typ (Visuelle Darstellung)', 'Pfeil_Typ', 'PfeilTyp'],
        },
        {
          label: 'Begruendung_Ursache_ID',
          aliases: ['Begruendung_Ursache_ID', 'Begründung_Ursache_ID', 'Ursache_ID'],
        },
        {
          label: 'Begründung des Entwicklungsschritts (Anzeige am Pfeil)',
          aliases: [
            'Begründung des Entwicklungsschritts (Anzeige am Pfeil)',
            'Begründung des Entwicklungsschritts',
            'Begründung',
          ],
        },
      ],
      'Verbindungen_Pfeile',
      preIssues
    );

    rows.forEach((row, idx) => {
      const { get } = buildRowAccessor(row);
      const id = get(['Pfeil_ID', 'PfeilID', 'ID']) || `P${String(idx + 1).padStart(2, '0')}`;
      const from = get(['Von_Schritt_ID', 'VonSchrittID', 'Von Knoten', 'Von']);
      const to = get(['Nach_Schritt_ID', 'NachSchrittID', 'Nach Knoten', 'Nach']);
      const arrowType = get([
        'Pfeil_Typ (Visuelle Darstellung)',
        'Pfeil_Typ',
        'PfeilTyp',
        'Typ',
      ]);
      const causeIdRaw = get([
        'Begruendung_Ursache_ID',
        'Begründung_Ursache_ID',
        'Ursache_ID',
      ]);
      const laneRef = get(['Spur_Bezug', 'SpurBezug', 'Spur']);
      const rationale = get([
        'Begründung des Entwicklungsschritts (Anzeige am Pfeil)',
        'Begründung des Entwicklungsschritts',
        'Anzeige am Pfeil',
        'Begründung',
      ]);

      if (!from && !to && !rationale) return;

      arrows.push({
        id,
        from,
        to,
        arrowType: arrowType || 'Weiterentwicklung (Optimierung)',
        category: classifyArrowType(arrowType),
        causeIdRaw,
        causeIds: parseCauseIdList(causeIdRaw),
        laneRef,
        rationale,
        rowIndex: row.rowIndex,
      });
    });
  }

  // Derive Automatischer_Stand ONLY for regular working-phase steps whose Excel formula had no cached value
  // (Milestones & milestone-phase steps are strictly excluded above and NEVER auto-marked Final)
  if (stepNeedsAutoStand.size > 0) {
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const supersededStepIds = new Set<string>();
    for (const arrow of arrows) {
      const fromStep = stepById.get(arrow.from);
      const toStep = stepById.get(arrow.to);
      if (!fromStep || !toStep) continue;
      if (
        normalizeKey(fromStep.spur) === normalizeKey(toStep.spur) &&
        fromStep.id !== toStep.id
      ) {
        supersededStepIds.add(fromStep.id);
      }
    }

    for (const step of steps) {
      if (!stepNeedsAutoStand.has(step.id)) continue;
      if (supersededStepIds.has(step.id)) {
        step.stand = 'Überarbeitet / Abgelöst';
        step.standCategory = 'superseded';
      } else {
        step.stand = 'Aktueller Stand (Final)';
        step.standCategory = 'final';
      }
    }
  }

  // 5. Parse Mikro_Iterationen
  const microIterations: MicroIteration[] = [];
  if (microSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(microSheetMatch.sheet, [
      'Detail_Box',
      'Detail-Box',
      'DetailBox',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Detail_Box', aliases: ['Detail_Box', 'Detail-Box', 'DetailBox'] },
        { label: 'Gehört_zu_Schritt', aliases: ['Gehört_zu_Schritt', 'Gehoert_zu_Schritt', 'Schritt'] },
        { label: 'Spur', aliases: ['Spur'] },
        { label: 'Schritt_Nr', aliases: ['Schritt_Nr', 'Schritt-Nr.', 'SchrittNr'] },
        {
          label: 'Konstruktive / Fertigungstechnische Änderung',
          aliases: ['Konstruktive / Fertigungstechnische Änderung', 'Änderung'],
        },
        { label: 'Beobachtetes Ergebnis', aliases: ['Beobachtetes Ergebnis', 'Ergebnis'] },
        { label: 'Bewertung', aliases: ['Bewertung', 'Bewertung / Entscheidung'] },
      ],
      'Mikro_Iterationen',
      preIssues
    );

    rows.forEach((row) => {
      const { get } = buildRowAccessor(row);
      const detailBox = get(['Detail_Box', 'Detail-Box', 'DetailBox']);
      const parentStepId = get([
        'Gehört_zu_Schritt',
        'Gehoert_zu_Schritt',
        'Gehört zu Hauptknoten',
        'Schritt_ID',
      ]);
      const spur = get(['Spur']);
      const stepNumber = get(['Schritt_Nr', 'Schritt-Nr.', 'Schritt-Nr', 'SchrittNr']);
      const change = get([
        'Konstruktive / Fertigungstechnische Änderung',
        'Konstruktive Änderung',
        'Änderung',
      ]);
      const result = get(['Beobachtetes Ergebnis', 'Ergebnis']);
      const evaluation = get(['Bewertung', 'Bewertung / Entscheidung', 'Entscheidung']);

      if (!detailBox && !parentStepId && !stepNumber && !change && !result) return;

      microIterations.push({
        detailBox,
        parentStepId,
        spur,
        stepNumber,
        change,
        result,
        evaluation,
        rowIndex: row.rowIndex,
      });
    });
  }

  // 6. Parse Methodik_Learnings (v5)
  const learnings: MethodikLearning[] = [];
  if (learningsSheetMatch.sheet) {
    const { headers, rows } = readSheetWithMeta(learningsSheetMatch.sheet, [
      'Learning_ID',
      'LearningID',
      'Kurz_Titel_Learning',
    ]);
    checkMissingColumns(
      headers,
      [
        { label: 'Learning_ID', aliases: ['Learning_ID', 'LearningID', 'ID'] },
        { label: 'Themenfeld', aliases: ['Themenfeld'] },
        { label: 'Kurz_Titel_Learning', aliases: ['Kurz_Titel_Learning', 'Kurz_Titel', 'Titel'] },
        {
          label: 'Übertragbares Prinzip (losgelöst vom Duckomat)',
          aliases: ['Übertragbares Prinzip (losgelöst vom Duckomat)', 'Übertragbares Prinzip', 'Prinzip'],
        },
      ],
      'Methodik_Learnings',
      preIssues
    );

    rows.forEach((row) => {
      const { get } = buildRowAccessor(row);
      const id = get(['Learning_ID', 'LearningID', 'ID']);
      const topic = get(['Themenfeld', 'Kategorie']);
      const title = get(['Kurz_Titel_Learning', 'Kurz_Titel', 'Kurztitel', 'Titel']);
      const principle = get([
        'Übertragbares Prinzip (losgelöst vom Duckomat)',
        'Übertragbares Prinzip',
        'Prinzip',
      ]);
      const projectExample = get([
        'Konkretes Projektbeispiel (Anker in Datenbank)',
        'Konkretes Projektbeispiel',
        'Projektbeispiel',
        'Anker in Datenbank',
      ]);
      const linkedStepsRaw = get(['Verknuepfte_Schritte', 'Verknüpfte_Schritte', 'Schritte']);
      const linkedCausesRaw = get(['Verknuepfte_Ursachen', 'Verknüpfte_Ursachen', 'Ursachen']);
      const scientificContext = get([
        'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)',
        'Wissenschaftliche Einordnung',
        'DRM / Paper-Mehrwert',
        'Paper-Mehrwert',
      ]);

      if (!id && !title && !principle) return;

      learnings.push({
        id,
        topic,
        title,
        principle,
        projectExample,
        linkedStepIds: parseIdList(linkedStepsRaw),
        linkedCauseIds: parseIdList(linkedCausesRaw),
        scientificContext,
        rowIndex: row.rowIndex,
      });
    });

    learnings.sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));
  }

  const lanes = sortLanesV2(steps.map((s) => s.spur));

  const dataset: DuckomatDataset = {
    sourceName: file.name,
    isSample: false,
    phases,
    lanes,
    steps,
    causes,
    arrows,
    microIterations,
    learnings,
  };

  const report = validateDataset(dataset, preIssues);
  return { dataset, report };
}

export function exportDatasetToXlsx(dataset: DuckomatDataset): void {
  const wb = XLSX.utils.book_new();

  const phasesData = dataset.phases.map((p) => ({
    Phase_Key: p.phaseKey,
    Sortier_Nr: p.sortOrder,
    Phasen_Name: p.name,
    Phasen_Typ: p.phaseType,
  }));

  const stepsData = dataset.steps.map((s) => ({
    Schritt_ID: s.id,
    Spur: s.spur,
    Phase: s.phase,
    Phase_Nr: s.phaseNr,
    Schritt_Typ: s.stepType,
    Kurz_Titel: s.title,
    'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)': s.implementation,
    Automatischer_Stand: s.stand,
    Detail_Box: s.detailBox,
    Learnings: s.learnings.join(', '),
  }));

  const causesData = dataset.causes.map((c) => ({
    Ursache_ID: c.id,
    Kategorie: c.category,
    Spur_Bezug: c.laneRef,
    Betroffener_Schritt: c.affectedStepId,
    Ausgeloester_Schritt: c.triggeredStepId,
    'Kurz_Titel (Befund / Test / Problem)': c.title,
    'Dokumentierte Beobachtung / Fakt': c.observation,
    'Hypothese / Grenze der Nachweiskraft': c.hypothesis,
    Learnings: c.learnings.join(', '),
  }));

  const arrowsData = dataset.arrows.map((a) => ({
    Pfeil_ID: a.id,
    Von_Schritt_ID: a.from,
    Nach_Schritt_ID: a.to,
    'Pfeil_Typ (Visuelle Darstellung)': a.arrowType,
    Begruendung_Ursache_ID: a.causeIdRaw,
    Spur_Bezug: a.laneRef,
    'Begründung des Entwicklungsschritts (Anzeige am Pfeil)': a.rationale,
  }));

  const microData = dataset.microIterations.map((m) => ({
    Detail_Box: m.detailBox,
    Gehört_zu_Schritt: m.parentStepId,
    Spur: m.spur,
    Schritt_Nr: m.stepNumber,
    'Konstruktive / Fertigungstechnische Änderung': m.change,
    'Beobachtetes Ergebnis': m.result,
    Bewertung: m.evaluation,
  }));

  const learningsData = dataset.learnings.map((l) => ({
    Learning_ID: l.id,
    Themenfeld: l.topic,
    Kurz_Titel_Learning: l.title,
    'Übertragbares Prinzip (losgelöst vom Duckomat)': l.principle,
    'Konkretes Projektbeispiel (Anker in Datenbank)': l.projectExample,
    Verknuepfte_Schritte: l.linkedStepIds.join(', '),
    Verknuepfte_Ursachen: l.linkedCauseIds.join(', '),
    'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)': l.scientificContext,
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phasesData), 'Phasen_Konfiguration');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepsData), 'Entwicklungsschritte');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(causesData), 'Ursachen_Tests_Befunde');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(arrowsData), 'Verbindungen_Pfeile');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(microData), 'Mikro_Iterationen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(learningsData), 'Methodik_Learnings');

  const safeName = dataset.isSample
    ? 'Duckomat_Entwicklungsdatenbank_v5_Vorlage.xlsx'
    : dataset.sourceName.endsWith('.xlsx')
      ? dataset.sourceName
      : `${dataset.sourceName}.xlsx`;

  XLSX.writeFile(wb, safeName);
}
