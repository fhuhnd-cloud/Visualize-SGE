import * as XLSX from 'xlsx';
import {
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
} from './sgeVisualConfig';
import { StatusCode } from '../types/sge';

// ---------------------------------------------------------------------------
// Minimal zero-dependency ZIP patcher to inject standard OOXML <dataValidations>
// into SheetJS STORE-mode .xlsx output (compression: false).
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  method: number;
  dosTime: number;
  dosDate: number;
  data: Uint8Array;
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  let ptr = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) return null;
    const method = view.getUint16(ptr + 10, true);
    const dosTime = view.getUint16(ptr + 12, true);
    const dosDate = view.getUint16(ptr + 14, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.slice(dataStart, dataStart + compSize);

    entries.push({ name, method, dosTime, dosDate, data });
  }
  return entries;
}

function writeZipEntries(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = encoder.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, e.method, true);
    lv.setUint16(10, e.dosTime, true);
    lv.setUint16(12, e.dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    localParts.push(lh, e.data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, e.method, true);
    cv.setUint16(12, e.dosTime, true);
    cv.setUint16(14, e.dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    centralParts.push(ch);
    offset += lh.length + size;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
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

  const totalLen = offset + centralSize + 22;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

interface DropdownRule {
  sqref: string;
  formula1: string; // e.g. '"BASE,CV,NEW,EC-GV,EC-PV,UD-GV,UD-PV,REM"'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectDataValidations(
  xlsxBytes: Uint8Array,
  rulesBySheetNum: Record<number, DropdownRule[]>
): Uint8Array {
  const entries = readZipEntries(xlsxBytes);
  if (!entries) return xlsxBytes;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const match = entry.name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if (!match || entry.method !== 0) continue;
    const sheetNum = Number(match[1]);
    const rules = rulesBySheetNum[sheetNum];
    if (!rules || rules.length === 0) continue;

    let xml = decoder.decode(entry.data);
    if (xml.includes('<dataValidations')) continue;

    const dvXml =
      `<dataValidations count="${rules.length}">` +
      rules
        .map(
          (r) =>
            `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${escapeXml(r.sqref)}"><formula1>${escapeXml(r.formula1)}</formula1></dataValidation>`
        )
        .join('') +
      `</dataValidations>`;

    // Respect OOXML element order inside <worksheet>
    const anchorMatch = xml.match(/<(hyperlinks|pageMargins|pageSetup|headerFooter|drawing|extLst|\/worksheet)/);
    if (anchorMatch && anchorMatch.index !== undefined) {
      xml = xml.slice(0, anchorMatch.index) + dvXml + xml.slice(anchorMatch.index);
      entry.data = encoder.encode(xml);
    }
  }

  return writeZipEntries(entries);
}

// ---------------------------------------------------------------------------
// Cell / Formula Helpers
// ---------------------------------------------------------------------------

type CellInput = string | number | XLSX.CellObject;

function fStr(formula: string, cached = ''): XLSX.CellObject {
  return { t: 's', f: formula, v: cached };
}

function fNum(formula: string, cached = 0): XLSX.CellObject {
  return { t: 'n', f: formula, v: cached };
}

function colLetter(zeroBasedCol: number): string {
  let c = zeroBasedCol;
  let out = '';
  while (c >= 0) {
    out = String.fromCharCode((c % 26) + 65) + out;
    c = Math.floor(c / 26) - 1;
  }
  return out;
}

function sheetFromRows(rows: CellInput[][], colWidths?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (colWidths) {
    ws['!cols'] = colWidths.map((wch) => ({ wch }));
  }
  if (rows.length > 0 && rows[0].length > 0) {
    const lastCol = colLetter(rows[0].length - 1);
    ws['!autofilter'] = { ref: `A1:${lastCol}${Math.max(1, rows.length)}` };
  }
  return ws;
}

// ---------------------------------------------------------------------------
// Shared Input Schema for Generating Complete Formula-Driven SGE Workbooks
// ---------------------------------------------------------------------------

interface ProjectVersionDef {
  versionKey: string;
  sortOrder: number;
  phaseName: string;
  milestoneBadge: string;
  systemStateSummary: string;
}

interface ProjectLaneDef {
  spurId: string;
  name: string;
  role: string;
  maturitySummary: string;
}

interface ProjectRseDef {
  rseId: string;
  spur: string;
  name: string;
  origin: string;
  firstVersion: string;
  removalVersion: string;
  predecessorOrReplacement: string;
  currentKombiIdRaw: string;
  reviewStatus: string;
  functionSummary: string;
}

interface ProjectEventDef {
  eventId: string;
  rseId: string;
  version: string;
  statusCode: StatusCode;
  kombiPartIdRaw: string;
  stateDescription: string;
  rationale: string;
  causeIdRaw: string;
  stepIdRaw: string;
  reviewStatus: string;
  mediaRef: string;
}

interface ProjectKombiDef {
  kombiId: string;
  partName: string;
  integratedFromPhase: string;
  involvedRseRaw: string;
  involvedLanes: string;
  variationType: string;
  rationale: string;
  mediaRef: string;
}

interface ProjectStepDef {
  id: string;
  spur: string;
  rseIdRaw: string;
  version: string;
  stepType: string;
  title: string;
  implementation: string;
  detailBox: string;
  learnings: string;
}

interface ProjectCauseDef {
  id: string;
  category: string;
  laneRef: string;
  affectedStepId: string;
  triggeredStepId: string;
  title: string;
  observation: string;
  hypothesis: string;
  learnings: string;
}

interface ProjectArrowDef {
  id: string;
  from: string;
  to: string;
  arrowType: string;
  causeIdRaw: string;
  laneRef: string;
  rationale: string;
  layoutDirection: string;
}

interface ProjectMicroDef {
  detailBox: string;
  rseId: string;
  spur: string;
  version: string;
  parentStepId: string;
  subVersionId: string;
  change: string;
  result: string;
  evaluation: string;
  mediaRef: string;
}

interface ProjectLearningDef {
  id: string;
  topic: string;
  title: string;
  principle: string;
  projectExample: string;
  linkedSteps: string;
  linkedCauses: string;
  scientificContext: string;
}

interface ProjectPreDimDef {
  id: string;
  subDomain: string;
  parameter: string;
  value: string;
  unit: string;
  formulaOrSource: string;
  evidenceType: string;
  methodicalNotes: string;
}

interface SgeWorkbookBlueprint {
  guideTitle: string;
  guideSubtitle: string;
  extraEmptyFormulaRows: number;
  versions: ProjectVersionDef[];
  lanes: ProjectLaneDef[];
  rses: ProjectRseDef[];
  events: ProjectEventDef[];
  kombis: ProjectKombiDef[];
  steps: ProjectStepDef[];
  causes: ProjectCauseDef[];
  arrows: ProjectArrowDef[];
  micros: ProjectMicroDef[];
  learnings: ProjectLearningDef[];
  preDims: ProjectPreDimDef[];
}

function buildGuideSheet(title: string, subtitle: string): XLSX.WorkSheet {
  const rows: CellInput[][] = [
    [title, '', '', ''],
    [subtitle, '', '', ''],
    ['', '', '', ''],
    ['1. SINN & AUFBAU DER SGE-METHODIK (SYSTEMGENERATIONEN-ENGINEERING)', '', '', ''],
    ['Begriff', 'ID-Format', 'Zweck in der Datenbank', 'Beispiel'],
    [
      'Systemspur (Swimlane)',
      'S1_Name, S2_Name, ...',
      'Funktionale oder räumliche Haupt-Baugruppe des Produkts (horizontale Spur in der 2D-Ansicht).',
      'S1_Gehaeuse_Ergonomie',
    ],
    [
      'Referenzsystemelement (RSE)',
      'R<Spur>.<Nr>',
      'Kleinste nachverfolgte Komponente / Funktionseinheit über alle Produktgenerationen hinweg.',
      'R2.1 (Thermoblock)',
    ],
    [
      'System-Version / Generation',
      'v0.0, v1.0, v1.1, v2.0',
      'Diskreter Entwicklungsstand auf der Zeitachse. Optional mit Meilenstein-Badge (M1:, M2:, M3:).',
      'v1.0 Thermoblock-Prototyp',
    ],
    [
      'Versions-Event (Phasenwechsel)',
      'EV001, EV002, ...',
      'Dokumentiert jede Einführung, Änderung oder Entfernung eines RSE in einer Version. Unveränderte Stände werden automatisch als CV fortgeschrieben.',
      'EV004 (R2.1 in v1.0 -> EC-PV)',
    ],
    [
      'Funktionsintegration (KOMBI)',
      'KOMBI-01, KOMBI-02, ...',
      'Verschmelzung mehrerer RSE in ein einziges integriertes Bauteil (z. B. 3D-Druck oder Gussblock).',
      'KOMBI-01 (R2.2, R2.3, R2.4)',
    ],
    [
      'Entwicklungsschritt & Kausalpfeil',
      'E01..E99 / P01..P99',
      'E-Schritte sind Ankerpunkte für kausale Wirkpfeile (Pxx) zwischen Versionen oder quer über Spuren.',
      'P02: E04 -> E08 (Problembehebung)',
    ],
    [
      'Ursachen, Tests & Befunde',
      'U01, U02, ...',
      'Trennt streng zwischen beobachtetem Fakt/Messwert und Hypothese als Begründung für Änderungen.',
      'U02 (Druckabfall im Dauertest)',
    ],
    [
      'Mikro-Iterationen',
      'v1.0_IT1, v1.1_M1, ...',
      'Feingranulare CAD-/Fertigungs-Schleifen innerhalb einer Version für ein einzelnes RSE.',
      'Box A1 · R2.3 · v1.0_D1',
    ],
    [
      'Methodik-Learnings',
      'M01, M02, ...',
      'Übertragbare Konstruktions- und Entwicklungsprinzipien, verknüpft mit Schritten (Exx) und Ursachen (Uxx).',
      'M01 (Modulare Schnittstellen)',
    ],
    ['', '', '', ''],
    ['2. DIE 8 ISEM-STATUS-CODES (SPALTE "Status_Code" IN RSE_Phasenwechsel)', '', '', ''],
    ['Status_Code', 'Planungs-Kategorie (Fig. 2)', 'SGE-Variationstyp', 'Wann verwenden?'],
    ['BASE', 'Ausgangsstand (Grau)', 'Referenz (Gen. n-1)', 'Vorhandenes Element im Ausgangs-/Vorgängersystem (v0.0).'],
    ['CV', 'Carry over (Blau)', 'ÜV (Übernahmevariation)', 'Unverändert übernommen – wird in RSE_Phasenmatrix auch automatisch berechnet!'],
    ['NEW', 'Newly added (Violett)', 'PV (Neu / Extern)', 'Komplett neu eingeführtes RSE oder Zukaufteil ab dieser Version.'],
    ['EC-GV', 'Engineering change (Orange)', 'GV (Gestaltvariation)', 'Geplante geometrische/konstruktive Anpassung bei gleichem Wirkprinzip.'],
    ['EC-PV', 'Engineering change (Orange)', 'PV (Prinzipvariation)', 'Geplanter Wirkprinzip-Wechsel oder bewusste Funktionsintegration.'],
    ['UD-GV', 'Unplanned deviation (Gelb)', 'GV (Gestaltvariation)', 'Ungeplante Gestalt-Nachbesserung aufgrund eines Tests, Fehlers oder Befunds (Uxx).'],
    ['UD-PV', 'Unplanned deviation (Gelb)', 'PV (Prinzipvariation)', 'Ungeplanter Prinzipwechsel als Reaktion auf kritisches Versagen im Test.'],
    ['REM', 'Removed (Rot gestrichelt)', 'PV- (Entfall / Entfernt)', 'RSE wird ab dieser Version dauerhaft entfernt oder durch ein anderes RSE ersetzt.'],
    ['', '', '', ''],
    ['3. SCHRITT-FÜR-SCHRITT-ANLEITUNG FÜR EIN NEUES PROJEKT', '', '', ''],
    ['Schritt', 'Tabellenblatt', 'Was Sie eintragen', 'Hinweis'],
    ['Schritt 1', 'Phasen_Konfiguration', 'Version_Key (v0.0, v1.0, ...), Sortier_Nr (1, 2, ...), Phasen_Name & Meilenstein_Badge.', 'Spaltenköpfe in RSE_Phasenmatrix & SGE_Auswertung an Phasen_Name anpassen.'],
    ['Schritt 2', 'Überblick_Dashboard', 'Eigene Systemspuren (S1_..., S2_...) mit Bezeichnung und Rolle anlegen.', 'Zählspalten D–J berechnen sich automatisch per Excel-Formel!'],
    ['Schritt 3', 'RSE_Stammdaten', 'Alle RSE (R1.1, R1.2, ...) mit Spur, Bezeichnung, Herkunft und Erste_Version eintragen.', 'Spalten F, H, I, L, M, N sind Formel-Spalten – nicht überschreiben.'],
    ['Schritt 4', 'RSE_Phasenwechsel', 'Pro Änderung/Einführung/Entfall eine Zeile mit Event_ID, RSE_ID, Version & Status_Code.', 'Spalten C, E, F, H, I berechnen sich automatisch. Fotos optional in Medien_Ref (media/datei.webp).'],
    ['Schritt 5', 'Entwicklungsschritte, Ursachen, Pfeile', 'Schritte (E01..), Befunde (U01..) und Kausalpfeile (P01..) verknüpfen.', 'Alle IDs müssen im Zielblatt existieren (die Web-App prüft 100 % der Fremdschlüssel).'],
    ['Schritt 6', 'Import in die Web-App', 'Excel speichern und per Drag & Drop oder "Excel laden" in Visualize-SGE öffnen.', 'Änderungen und Fotos können direkt in der App bearbeitet und wieder als .xlsx/.zip exportiert werden.'],
    ['', '', '', ''],
    ['4. ÜBERSICHT DER 13 DATENBLÄTTER & AUTOMATISCHEN FORMEL-SPALTEN', '', '', ''],
    ['Nr.', 'Tabellenblatt', 'Manuell pflegen', 'Automatisch per Excel-Formel (nicht überschreiben)'],
    ['1', 'Überblick_Dashboard', 'A–C (Spur_ID, Name, Rolle), K (Reifegrad)', 'D–J (RSE-Zähler, Aktiv, Entfernt, Kombi, Events, Mikro-It., Geprüft)'],
    ['2', 'SGE_Auswertung', 'Spaltenköpfe (Phasen_Name)', 'Alle Zahlen- & Quotenzeilen (COUNTIF / SUM / IFERROR aus RSE_Phasenmatrix)'],
    ['3', 'RSE_Phasenmatrix', 'Spaltenköpfe ab E (Phasen_Name)', 'Komplettes Blatt A–K (Spiegelt RSE_Stammdaten & RSE_Phasenwechsel inkl. CV-Logik)'],
    ['4', 'RSE_Stammdaten', 'A–E, G, J, K, O, P', 'F (Erste_Ver_Nr), H (Entfall_Ver_Nr), I (Lebenszyklus), L–N (Zähler)'],
    ['5', 'RSE_Phasenwechsel', 'A, B, D, G, J–P (Dropdown bei G & O)', 'C (Spur), E (Version_Nr), F (Lookup_Key), H (Planungs-Kat.), I (Variationstyp)'],
    ['6', 'Bauteil_Integrationen', 'A–C, E–I', 'D (Anzahl_RSE_im_Bauteil per COUNTIF)'],
    ['7', 'Phasen_Konfiguration', 'Alle Spalten A–E', 'Keine Formeln (Master-Tabelle für Versionen & Reihenfolge)'],
    ['8', 'Entwicklungsschritte', 'A–D, F–H, J, K', 'E (Version_Nr), I (Automatischer_Stand)'],
    ['9', 'Ursachen_Tests_Befunde', 'Alle Spalten A–I', 'Keine Formeln (Fremdschlüssel auf Schritt_ID & Learning_ID)'],
    ['10', 'Verbindungen_Pfeile', 'Alle Spalten A–H (Dropdown bei D)', 'Keine Formeln (Fremdschlüssel auf Schritt_ID & Ursache_ID)'],
    ['11', 'Mikro_Iterationen', 'Alle Spalten A–J', 'Keine Formeln (zählt automatisch in RSE_Stammdaten & Dashboard hoch)'],
    ['12', 'Methodik_Learnings', 'Alle Spalten A–H', 'Keine Formeln (verknüpft mit Schritt_ID & Ursache_ID)'],
    ['13', 'Vorab_Dimensionierung', 'Alle Spalten A–H', 'Optional eigene Rechenformeln in Spalte D (Wert)'],
    ['', '', '', ''],
    ['5. WICHTIGE ID- & FREMDSCHLÜSSEL-REGELN', '', '', ''],
    ['Regel', 'Details', '', ''],
    ['Eindeutige Primärschlüssel', 'Jede RSE_ID, Event_ID, Kombi_ID, Schritt_ID, Ursache_ID, Pfeil_ID, Learning_ID darf nur 1× vorkommen.', '', ''],
    ['Kommagetrennte Mehrfach-IDs', 'Mehrere IDs in einer Zelle immer mit Komma trennen, z. B. "U01, U02" oder "R2.2, R2.3, R2.4".', '', ''],
    ['Exakte Schreibweise Version', 'In RSE_Phasenwechsel, RSE_Stammdaten & Entwicklungsschritte exakt den Phasen_Name aus Phasen_Konfiguration verwenden.', '', ''],
    ['Medien_Ref für Fotos', 'Relative Pfade wie "media/v1_0_R2_1.webp" eintragen oder Fotos bequem direkt in der Web-App zuschneiden & hochladen.', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 62 }, { wch: 48 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
    { s: { r: 26, c: 0 }, e: { r: 26, c: 3 } },
    { s: { r: 35, c: 0 }, e: { r: 35, c: 3 } },
    { s: { r: 51, c: 0 }, e: { r: 51, c: 3 } },
  ];
  return ws;
}

function buildSgeWorkbookFromBlueprint(bp: SgeWorkbookBlueprint): Uint8Array {
  const wb = XLSX.utils.book_new();

  const verByPhase = new Map(bp.versions.map((v) => [v.phaseName, v]));
  const rseById = new Map(bp.rses.map((r) => [r.rseId, r]));
  const versionCount = bp.versions.length;
  const phaseEndRow = Math.max(15, bp.versions.length + 5);
  const rseMaxRow = Math.max(bp.rses.length + bp.extraEmptyFormulaRows + 1, 25);
  const evMaxRow = Math.max(bp.events.length + bp.extraEmptyFormulaRows * 2 + 1, 60);
  const microMaxRow = Math.max(bp.micros.length + 30, 50);
  const kombiMaxRow = Math.max(bp.kombis.length + 10, 15);
  const stepMaxRow = Math.max(bp.steps.length + 25, 40);

  // Precompute exact matrix states for cached formula values
  const eventsByRse = new Map<string, ProjectEventDef[]>();
  for (const ev of bp.events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }

  const cachedMatrix = new Map<string, (StatusCode | '')[]>();
  for (const rse of bp.rses) {
    const rEvs = eventsByRse.get(rse.rseId) ?? [];
    const byVerNr = new Map<number, ProjectEventDef>();
    for (const ev of rEvs) {
      const v = verByPhase.get(ev.version);
      if (v) byVerNr.set(v.sortOrder, ev);
    }
    const rowStatuses: (StatusCode | '')[] = [];
    let active = false;
    for (const v of bp.versions) {
      const ev = byVerNr.get(v.sortOrder);
      if (ev) {
        rowStatuses.push(ev.statusCode);
        active = ev.statusCode !== 'REM';
      } else if (active) {
        rowStatuses.push('CV');
      } else {
        rowStatuses.push('');
      }
    }
    cachedMatrix.set(rse.rseId, rowStatuses);
  }

  const lastVerColIdx = 4 + versionCount - 1; // E=4 for 1st version
  const lastVerCol = colLetter(lastVerColIdx);

  // Helper: cached lifecycle string for an RSE
  const getCachedLifecycle = (rse: ProjectRseDef): string => {
    const statuses = cachedMatrix.get(rse.rseId) ?? [];
    const lastSt = statuses[statuses.length - 1] ?? '';
    if (!lastSt || lastSt === 'REM') {
      return rse.predecessorOrReplacement.toLowerCase().includes('ersetzt durch')
        ? 'Ersetzt'
        : 'Entfernt';
    }
    return rse.currentKombiIdRaw ? 'Aktiv (Integriert)' : 'Aktiv';
  };

  // --- Sheet 1: Anleitung_&_Struktur ---
  XLSX.utils.book_append_sheet(
    wb,
    buildGuideSheet(bp.guideTitle, bp.guideSubtitle),
    'Anleitung_&_Struktur'
  );

  // --- Sheet 2 (Data 1): Überblick_Dashboard ---
  const lastVerKey = bp.versions[bp.versions.length - 1]?.versionKey ?? 'Aktuell';
  const dashRows: CellInput[][] = [
    [
      'Spur_ID',
      'Systemspur / Baugruppe',
      'Rolle im Gesamtsystem',
      'RSE gesamt',
      `Aktive RSE (${lastVerKey})`,
      'Entfernt / Ersetzt',
      'Integrierte RSE (Kombi)',
      'Versions-Events',
      'Mikro-Iterationen',
      'Events geprüft',
      'Aktueller Reifegrad (SGE-Überblick)',
    ],
  ];

  bp.lanes.forEach((lane, idx) => {
    const r = idx + 2;
    const laneRses = bp.rses.filter((x) => x.spur === lane.spurId);
    const activeCount = laneRses.filter((x) => getCachedLifecycle(x).startsWith('Aktiv')).length;
    const remCount = laneRses.length - activeCount;
    const kombiCount = laneRses.filter((x) => Boolean(x.currentKombiIdRaw)).length;
    const evCount = bp.events.filter((e) => rseById.get(e.rseId)?.spur === lane.spurId).length;
    const checkedEvCount = bp.events.filter(
      (e) => rseById.get(e.rseId)?.spur === lane.spurId && e.reviewStatus === 'Geprüft & final'
    ).length;
    const microCount = bp.micros.filter((m) => m.spur === lane.spurId).length;

    dashRows.push([
      lane.spurId,
      lane.name,
      lane.role,
      fNum(`COUNTIF(RSE_Stammdaten!$B$2:$B$${rseMaxRow},A${r})`, laneRses.length),
      fNum(
        `COUNTIFS(RSE_Stammdaten!$B$2:$B$${rseMaxRow},A${r},RSE_Stammdaten!$I$2:$I$${rseMaxRow},"Aktiv*")`,
        activeCount
      ),
      fNum(
        `COUNTIFS(RSE_Stammdaten!$B$2:$B$${rseMaxRow},A${r},RSE_Stammdaten!$I$2:$I$${rseMaxRow},"Entfernt")+COUNTIFS(RSE_Stammdaten!$B$2:$B$${rseMaxRow},A${r},RSE_Stammdaten!$I$2:$I$${rseMaxRow},"Ersetzt")`,
        remCount
      ),
      fNum(
        `COUNTIFS(RSE_Stammdaten!$B$2:$B$${rseMaxRow},A${r},RSE_Stammdaten!$K$2:$K$${rseMaxRow},"<>")`,
        kombiCount
      ),
      fNum(`COUNTIF(RSE_Phasenwechsel!$C$2:$C$${evMaxRow},A${r})`, evCount),
      fNum(`COUNTIF(Mikro_Iterationen!$C$2:$C$${microMaxRow},A${r})`, microCount),
      fStr(
        `COUNTIFS(RSE_Phasenwechsel!$C$2:$C$${evMaxRow},A${r},RSE_Phasenwechsel!$O$2:$O$${evMaxRow},"Geprüft & final")&" / "&H${r}`,
        `${checkedEvCount} / ${evCount}`
      ),
      lane.maturitySummary,
    ]);
  });

  const sumRowStart = 2;
  const sumRowEnd = bp.lanes.length + 1;
  const totalActive = bp.rses.filter((x) => getCachedLifecycle(x).startsWith('Aktiv')).length;
  const totalKombi = bp.rses.filter((x) => Boolean(x.currentKombiIdRaw)).length;
  const totalChecked = bp.events.filter((e) => e.reviewStatus === 'Geprüft & final').length;

  dashRows.push([
    'SUMME',
    'Gesamtsystem',
    `${bp.lanes.length} Systemspuren · ${bp.versions.length} Generationen`,
    fNum(`SUM(D${sumRowStart}:D${sumRowEnd})`, bp.rses.length),
    fNum(`SUM(E${sumRowStart}:E${sumRowEnd})`, totalActive),
    fNum(`SUM(F${sumRowStart}:F${sumRowEnd})`, bp.rses.length - totalActive),
    fNum(`SUM(G${sumRowStart}:G${sumRowEnd})`, totalKombi),
    fNum(`SUM(H${sumRowStart}:H${sumRowEnd})`, bp.events.length),
    fNum(`SUM(I${sumRowStart}:I${sumRowEnd})`, bp.micros.length),
    fStr(
      `COUNTIF(RSE_Phasenwechsel!$O$2:$O$${evMaxRow},"Geprüft & final")&" / "&H${sumRowEnd + 1}`,
      `${totalChecked} / ${bp.events.length}`
    ),
    `Stand ${lastVerKey}`,
  ]);

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(dashRows, [24, 24, 42, 12, 16, 16, 20, 15, 16, 15, 42]),
    'Überblick_Dashboard'
  );

  // --- Sheet 3 (Data 2): SGE_Auswertung ---
  const summaryLastVerCol = colLetter(versionCount); // B=1 ..
  const sgeRows: CellInput[][] = [
    [
      'SGE_Kennzahl / Status_Code',
      ...bp.versions.map((v) => v.phaseName),
      'Gesamt_Events_oder_Stand',
    ],
  ];

  const countStatusInCol = (vIdx: number, code: StatusCode): number => {
    let c = 0;
    for (const stList of cachedMatrix.values()) {
      if (stList[vIdx] === code) c++;
    }
    return c;
  };
  const countActiveInCol = (vIdx: number): number => {
    let c = 0;
    for (const stList of cachedMatrix.values()) {
      const s = stList[vIdx];
      if (s && s !== 'REM') c++;
    }
    return c;
  };

  // Row 2: Active RSE
  const activePerVer = bp.versions.map((_, i) => countActiveInCol(i));
  sgeRows.push([
    'Aktive RSE in Version (ohne REM)',
    ...bp.versions.map((_, i) => {
      const mc = colLetter(4 + i);
      return fNum(
        `COUNTIF(RSE_Phasenmatrix!${mc}$2:${mc}$${rseMaxRow},"<>")-COUNTIF(RSE_Phasenmatrix!${mc}$2:${mc}$${rseMaxRow},"REM")`,
        activePerVer[i]
      );
    }),
    fNum(`${summaryLastVerCol}2`, activePerVer[activePerVer.length - 1] ?? 0),
  ]);

  const statusRowsDef: { label: string; code: StatusCode }[] = [
    { label: 'BASE – Ausgangsstand (Grau)', code: 'BASE' },
    { label: 'CV – Carry over / unverändert (Blau)', code: 'CV' },
    { label: 'NEW – Neu / extern hinzugefügt (Violett)', code: 'NEW' },
    { label: 'EC-GV – Geplante Gestaltvariation (Orange)', code: 'EC-GV' },
    { label: 'EC-PV – Geplante Prinzipvariation (Orange)', code: 'EC-PV' },
    { label: 'UD-GV – Ungeplante Gestaltabweichung (Gelb)', code: 'UD-GV' },
    { label: 'UD-PV – Ungeplante Prinzipabweichung (Gelb)', code: 'UD-PV' },
    { label: 'REM – Entfernt / ersetzt in Version (Rot)', code: 'REM' },
  ];

  statusRowsDef.forEach((def, idx) => {
    const excelRow = idx + 3;
    const vals = bp.versions.map((_, vi) => countStatusInCol(vi, def.code));
    const sum = vals.reduce((a, b) => a + b, 0);
    sgeRows.push([
      def.label,
      ...bp.versions.map((_, vi) => {
        const mc = colLetter(4 + vi);
        return fNum(
          `COUNTIF(RSE_Phasenmatrix!${mc}$2:${mc}$${rseMaxRow},"${def.code}")`,
          vals[vi]
        );
      }),
      fNum(`SUM(B${excelRow}:${summaryLastVerCol}${excelRow})`, sum),
    ]);
  });

  // Row 11: EC total (rows 6 + 7)
  const ecPerVer = bp.versions.map(
    (_, vi) => countStatusInCol(vi, 'EC-GV') + countStatusInCol(vi, 'EC-PV')
  );
  sgeRows.push([
    'Geplante Änderungen gesamt (EC-GV + EC-PV)',
    ...bp.versions.map((_, vi) => {
      const sc = colLetter(1 + vi);
      return fNum(`${sc}6+${sc}7`, ecPerVer[vi]);
    }),
    fNum(`SUM(B11:${summaryLastVerCol}11)`, ecPerVer.reduce((a, b) => a + b, 0)),
  ]);

  // Row 12: UD total (rows 8 + 9)
  const udPerVer = bp.versions.map(
    (_, vi) => countStatusInCol(vi, 'UD-GV') + countStatusInCol(vi, 'UD-PV')
  );
  sgeRows.push([
    'Ungeplante Abweichungen gesamt (UD-GV + UD-PV)',
    ...bp.versions.map((_, vi) => {
      const sc = colLetter(1 + vi);
      return fNum(`${sc}8+${sc}9`, udPerVer[vi]);
    }),
    fNum(`SUM(B12:${summaryLastVerCol}12)`, udPerVer.reduce((a, b) => a + b, 0)),
  ]);

  // Row 13: Unplanned ratio
  const udRatioPerVer = bp.versions.map((_, vi) => {
    const denom =
      countStatusInCol(vi, 'NEW') + ecPerVer[vi] + udPerVer[vi] + countStatusInCol(vi, 'REM');
    return denom > 0 ? udPerVer[vi] / denom : 0;
  });
  const totalNew = bp.versions.reduce((s, _, vi) => s + countStatusInCol(vi, 'NEW'), 0);
  const totalRem = bp.versions.reduce((s, _, vi) => s + countStatusInCol(vi, 'REM'), 0);
  const totalEc = ecPerVer.reduce((a, b) => a + b, 0);
  const totalUd = udPerVer.reduce((a, b) => a + b, 0);
  const totalDenom = totalNew + totalEc + totalUd + totalRem;

  sgeRows.push([
    'Ungeplant-Quote an Änderungen [UD / (EC + UD + NEW + REM)]',
    ...bp.versions.map((_, vi) => {
      const sc = colLetter(1 + vi);
      return fNum(`IFERROR(${sc}12/(${sc}5+${sc}11+${sc}12+${sc}10),0)`, udRatioPerVer[vi]);
    }),
    fNum(
      `IFERROR(${colLetter(versionCount + 1)}12/(${colLetter(versionCount + 1)}5+${colLetter(versionCount + 1)}11+${colLetter(versionCount + 1)}12+${colLetter(versionCount + 1)}10),0)`,
      totalDenom > 0 ? totalUd / totalDenom : 0
    ),
  ]);

  // Row 14: Carryover ratio
  const cvRatioPerVer = bp.versions.map((_, vi) =>
    activePerVer[vi] > 0 ? countStatusInCol(vi, 'CV') / activePerVer[vi] : 0
  );
  sgeRows.push([
    'Carryover-Quote an aktiven RSE [CV / Aktive RSE]',
    ...bp.versions.map((_, vi) => {
      const sc = colLetter(1 + vi);
      return fNum(`IFERROR(${sc}4/${sc}2,0)`, cvRatioPerVer[vi]);
    }),
    fNum(
      `IFERROR(${summaryLastVerCol}4/${summaryLastVerCol}2,0)`,
      cvRatioPerVer[cvRatioPerVer.length - 1] ?? 0
    ),
  ]);

  // Row 15: Kombi summary
  const activeKombiParts = bp.kombis.length;
  const kombiFormulaCol = colLetter(versionCount);
  const savedParts = Math.max(0, totalKombi - activeKombiParts);
  const row15: CellInput[] = [
    `Funktionsintegration (Stand ${lastVerKey}): Verschmolzene RSE / Aktive Kombi-Teile`,
  ];
  for (let i = 0; i < versionCount - 1; i++) row15.push('');
  row15.push(
    fStr(
      `COUNTIF(RSE_Stammdaten!$K$2:$K$${rseMaxRow},"<>")&" RSE -> "&COUNTIF(Bauteil_Integrationen!$D$2:$D$${kombiMaxRow},">0")&" Teile"`,
      `${totalKombi} RSE -> ${activeKombiParts} Teile`
    )
  );
  row15.push(
    fStr(
      `MAX(0,COUNTIF(RSE_Stammdaten!$K$2:$K$${rseMaxRow},"<>")-COUNTIF(Bauteil_Integrationen!$D$2:$D$${kombiMaxRow},">0"))&" gespart"`,
      `${savedParts} gespart`
    )
  );
  void kombiFormulaCol;
  sgeRows.push(row15);

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(sgeRows, [50, ...bp.versions.map(() => 24), 24]),
    'SGE_Auswertung'
  );

  // --- Sheet 4 (Data 3): RSE_Phasenmatrix ---
  const matRows: CellInput[][] = [
    ['RSE_ID', 'Spur', 'RSE_Bezeichnung', 'Kombi_ID', ...bp.versions.map((v) => v.phaseName)],
  ];
  const totalMatRows = bp.rses.length + bp.extraEmptyFormulaRows;
  for (let i = 0; i < totalMatRows; i++) {
    const r = i + 2;
    const rse = bp.rses[i];
    const cachedStatuses = rse ? cachedMatrix.get(rse.rseId) ?? [] : [];
    const rowCells: CellInput[] = [
      fStr(`IF(RSE_Stammdaten!A${r}="","",RSE_Stammdaten!A${r})`, rse?.rseId ?? ''),
      fStr(`IF(RSE_Stammdaten!A${r}="","",RSE_Stammdaten!B${r})`, rse?.spur ?? ''),
      fStr(`IF(RSE_Stammdaten!A${r}="","",RSE_Stammdaten!C${r})`, rse?.name ?? ''),
      fStr(`IF(RSE_Stammdaten!K${r}="","",RSE_Stammdaten!K${r})`, rse?.currentKombiIdRaw ?? ''),
    ];
    bp.versions.forEach((v, vi) => {
      const cached = cachedStatuses[vi] ?? '';
      if (vi === 0) {
        rowCells.push(
          fStr(
            `IF($A${r}="","",IFERROR(INDEX(RSE_Phasenwechsel!$G$2:$G$${evMaxRow},MATCH($A${r}&"|${v.sortOrder}",RSE_Phasenwechsel!$F$2:$F$${evMaxRow},0)),""))`,
            cached
          )
        );
      } else {
        const prevCol = colLetter(4 + vi - 1);
        rowCells.push(
          fStr(
            `IF($A${r}="","",IFERROR(INDEX(RSE_Phasenwechsel!$G$2:$G$${evMaxRow},MATCH($A${r}&"|${v.sortOrder}",RSE_Phasenwechsel!$F$2:$F$${evMaxRow},0)),IF(OR(${prevCol}${r}="",${prevCol}${r}="REM"),"","CV")))`,
            cached
          )
        );
      }
    });
    matRows.push(rowCells);
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(matRows, [10, 24, 34, 14, ...bp.versions.map(() => 22)]),
    'RSE_Phasenmatrix'
  );

  // --- Sheet 5 (Data 4): RSE_Stammdaten ---
  const rseRows: CellInput[][] = [
    [
      'RSE_ID',
      'Spur',
      'RSE_Bezeichnung',
      'Herkunft',
      'Erste_Version',
      'Erste_Ver_Nr',
      'Entfall_Version',
      'Entfall_Ver_Nr',
      'Aktueller_Lebenszyklus',
      'Vorgaenger_oder_Ersatz_RSE',
      'Aktuelle_Kombi_ID',
      'RSE_Anzahl_im_Bauteil',
      'Anzahl_Versions_Events',
      'Anzahl_Mikro_Iterationen',
      'Pruefstatus_Inhalt',
      'Kurzbeschreibung_Funktion',
    ],
  ];

  const totalRseSheetRows = bp.rses.length + bp.extraEmptyFormulaRows;
  for (let i = 0; i < totalRseSheetRows; i++) {
    const r = i + 2;
    const rse = bp.rses[i];
    if (rse) {
      const firstNr = verByPhase.get(rse.firstVersion)?.sortOrder ?? 1;
      const remNr = rse.removalVersion ? verByPhase.get(rse.removalVersion)?.sortOrder ?? 999 : 999;
      const lc = getCachedLifecycle(rse);
      const rseInPart = rse.currentKombiIdRaw
        ? bp.rses.filter((x) => x.currentKombiIdRaw.includes(rse.currentKombiIdRaw.split(',')[0].trim()))
            .length
        : 1;
      const evCnt = bp.events.filter((e) => e.rseId === rse.rseId).length;
      const miCnt = bp.micros.filter((m) => m.rseId === rse.rseId).length;

      rseRows.push([
        rse.rseId,
        rse.spur,
        rse.name,
        rse.origin,
        rse.firstVersion,
        fNum(
          `IF(E${r}="","",IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(E${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),99))`,
          firstNr
        ),
        rse.removalVersion,
        fNum(
          `IF(G${r}="",999,IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(G${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),999))`,
          remNr
        ),
        fStr(
          `IF(A${r}="","",IF(OR(RSE_Phasenmatrix!${lastVerCol}${r}="",RSE_Phasenmatrix!${lastVerCol}${r}="REM"),IF(ISNUMBER(SEARCH("Ersetzt durch",J${r})),"Ersetzt","Entfernt"),IF(K${r}<>"","Aktiv (Integriert)","Aktiv")))`,
          lc
        ),
        rse.predecessorOrReplacement,
        rse.currentKombiIdRaw,
        fNum(
          `IF(A${r}="","",IF(K${r}="",1,IF(ISNUMBER(SEARCH(",",K${r})),COUNTIF($K$2:$K$${rseMaxRow},"*"&TRIM(LEFT(K${r},SEARCH(",",K${r})-1))&"*"),COUNTIF($K$2:$K$${rseMaxRow},"*"&K${r}&"*"))))`,
          rseInPart
        ),
        fNum(`IF(A${r}="","",COUNTIF(RSE_Phasenwechsel!$B$2:$B$${evMaxRow},A${r}))`, evCnt),
        fNum(`IF(A${r}="","",COUNTIF(Mikro_Iterationen!$B$2:$B$${microMaxRow},A${r}))`, miCnt),
        rse.reviewStatus,
        rse.functionSummary,
      ]);
    } else {
      rseRows.push([
        '',
        '',
        '',
        '',
        '',
        fStr(
          `IF(E${r}="","",IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(E${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),99))`,
          ''
        ),
        '',
        fStr(
          `IF(A${r}="","",IF(G${r}="",999,IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(G${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),999)))`,
          ''
        ),
        fStr(
          `IF(A${r}="","",IF(OR(RSE_Phasenmatrix!${lastVerCol}${r}="",RSE_Phasenmatrix!${lastVerCol}${r}="REM"),IF(ISNUMBER(SEARCH("Ersetzt durch",J${r})),"Ersetzt","Entfernt"),IF(K${r}<>"","Aktiv (Integriert)","Aktiv")))`,
          ''
        ),
        '',
        '',
        fStr(
          `IF(A${r}="","",IF(K${r}="",1,COUNTIF($K$2:$K$${rseMaxRow},"*"&K${r}&"*")))`,
          ''
        ),
        fStr(`IF(A${r}="","",COUNTIF(RSE_Phasenwechsel!$B$2:$B$${evMaxRow},A${r}))`, ''),
        fStr(`IF(A${r}="","",COUNTIF(Mikro_Iterationen!$B$2:$B$${microMaxRow},A${r}))`, ''),
        '',
        '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(rseRows, [10, 24, 34, 24, 24, 12, 22, 13, 18, 26, 16, 14, 14, 14, 18, 52]),
    'RSE_Stammdaten'
  );

  // --- Sheet 6 (Data 5): RSE_Phasenwechsel ---
  const evRows: CellInput[][] = [
    [
      'Event_ID',
      'RSE_ID',
      'Spur',
      'Version',
      'Version_Nr',
      'Lookup_Key',
      'Status_Code',
      'Planungs_Kategorie_Fig2',
      'SGE_Variationstyp',
      'Kombi_Bauteil_ID',
      'Kurzbeschreibung_Zustand',
      'Begruendung',
      'Ursache_ID',
      'Schritt_ID',
      'Pruefstatus_Inhalt',
      'Medien_Ref',
    ],
  ];

  const totalEvSheetRows = bp.events.length + bp.extraEmptyFormulaRows;
  for (let i = 0; i < totalEvSheetRows; i++) {
    const r = i + 2;
    const ev = bp.events[i];
    const fSpur = `IF(B${r}="","",IFERROR(INDEX(RSE_Stammdaten!$B$2:$B$${rseMaxRow},MATCH(B${r},RSE_Stammdaten!$A$2:$A$${rseMaxRow},0)),""))`;
    const fVerNr = `IF(D${r}="","",IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(D${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),99))`;
    const fLookup = `IF(OR(B${r}="",E${r}=""),"",B${r}&"|"&E${r})`;
    const fPlan = `IF(G${r}="BASE","Ausgangsstand (Grau)",IF(G${r}="CV","Carry over (Blau)",IF(G${r}="NEW","Newly added (Violett)",IF(OR(G${r}="EC-GV",G${r}="EC-PV"),"Engineering change (Orange)",IF(OR(G${r}="UD-GV",G${r}="UD-PV"),"Unplanned deviation (Gelb)",IF(G${r}="REM","Removed (Rot gestrichelt)",""))))))`;
    const fVar = `IF(G${r}="BASE","Referenz (Gen. n-1)",IF(G${r}="CV","ÜV (Übernahmevariation)",IF(G${r}="NEW","PV (Neu / Extern)",IF(OR(G${r}="EC-GV",G${r}="UD-GV"),"GV (Gestaltvariation)",IF(OR(G${r}="EC-PV",G${r}="UD-PV"),"PV (Prinzipvariation)",IF(G${r}="REM","PV- (Entfall / Entfernt)",""))))))`;

    if (ev) {
      const spur = rseById.get(ev.rseId)?.spur ?? '';
      const verNr = verByPhase.get(ev.version)?.sortOrder ?? 1;
      evRows.push([
        ev.eventId,
        ev.rseId,
        fStr(fSpur, spur),
        ev.version,
        fNum(fVerNr, verNr),
        fStr(fLookup, `${ev.rseId}|${verNr}`),
        ev.statusCode,
        fStr(fPlan, derivePlanningCategoryFromStatus(ev.statusCode)),
        fStr(fVar, deriveVariationTypeFromStatus(ev.statusCode)),
        ev.kombiPartIdRaw,
        ev.stateDescription,
        ev.rationale,
        ev.causeIdRaw,
        ev.stepIdRaw,
        ev.reviewStatus,
        ev.mediaRef,
      ]);
    } else {
      evRows.push([
        '',
        '',
        fStr(fSpur, ''),
        '',
        fStr(fVerNr, ''),
        fStr(fLookup, ''),
        '',
        fStr(fPlan, ''),
        fStr(fVar, ''),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(evRows, [10, 10, 24, 24, 11, 12, 12, 26, 24, 16, 44, 44, 12, 12, 18, 28]),
    'RSE_Phasenwechsel'
  );

  // --- Sheet 7 (Data 6): Bauteil_Integrationen ---
  const kombiRows: CellInput[][] = [
    [
      'Kombi_ID',
      'Bauteil_Bezeichnung',
      'Integration_ab_Phase',
      'Anzahl_RSE_im_Bauteil',
      'Beteiligte_RSE_IDs',
      'Beteiligte_Spuren',
      'SGE_Variationsart',
      'Begruendung_Funktionsintegration',
      'Medien_Ref',
    ],
  ];
  const totalKombiRows = Math.max(bp.kombis.length + 5, 6);
  for (let i = 0; i < totalKombiRows; i++) {
    const r = i + 2;
    const k = bp.kombis[i];
    if (k) {
      const cnt = k.involvedRseRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean).length;
      kombiRows.push([
        k.kombiId,
        k.partName,
        k.integratedFromPhase,
        fNum(`IF(A${r}="","",COUNTIF(RSE_Stammdaten!$K$2:$K$${rseMaxRow},"*"&A${r}&"*"))`, cnt),
        k.involvedRseRaw,
        k.involvedLanes,
        k.variationType,
        k.rationale,
        k.mediaRef,
      ]);
    } else {
      kombiRows.push([
        '',
        '',
        '',
        fStr(`IF(A${r}="","",COUNTIF(RSE_Stammdaten!$K$2:$K$${rseMaxRow},"*"&A${r}&"*"))`, ''),
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(kombiRows, [12, 40, 24, 18, 22, 22, 28, 52, 26]),
    'Bauteil_Integrationen'
  );

  // --- Sheet 8 (Data 7): Phasen_Konfiguration ---
  const phaseRows: CellInput[][] = [
    [
      'Version_Key',
      'Sortier_Nr',
      'Phasen_Name',
      'Meilenstein_Badge',
      'Technischer Systemstand & Einordnung',
    ],
    ...bp.versions.map((v) => [
      v.versionKey,
      v.sortOrder,
      v.phaseName,
      v.milestoneBadge || '-',
      v.systemStateSummary,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(phaseRows, [14, 12, 30, 24, 60]),
    'Phasen_Konfiguration'
  );

  // --- Sheet 9 (Data 8): Entwicklungsschritte ---
  const stepRows: CellInput[][] = [
    [
      'Schritt_ID',
      'Spur',
      'RSE_ID',
      'Version',
      'Version_Nr',
      'Schritt_Typ',
      'Kurz_Titel',
      'Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)',
      'Automatischer_Stand',
      'Detail_Box',
      'Learnings',
    ],
  ];
  bp.steps.forEach((s, i) => {
    const r = i + 2;
    const vNr = verByPhase.get(s.version)?.sortOrder ?? 1;
    const isFinal = !bp.steps.some(
      (other) =>
        other.spur === s.spur &&
        ((verByPhase.get(other.version)?.sortOrder ?? 0) > vNr ||
          ((verByPhase.get(other.version)?.sortOrder ?? 0) === vNr && other.id > s.id))
    );
    stepRows.push([
      s.id,
      s.spur,
      s.rseIdRaw,
      s.version,
      fNum(
        `IF(D${r}="","",IFERROR(INDEX(Phasen_Konfiguration!$B$2:$B$${phaseEndRow},MATCH(D${r},Phasen_Konfiguration!$C$2:$C$${phaseEndRow},0)),99))`,
        vNr
      ),
      s.stepType,
      s.title,
      s.implementation,
      fStr(
        `IF(A${r}="","",IF(F${r}="Meilenstein","Meilenstein (Prüfpunkt)",IF(F${r}="Integrationsstand","Aktueller Stand (Final)",IF((COUNTIFS($B$2:$B$${stepMaxRow},B${r},$E$2:$E$${stepMaxRow},">"&E${r},$F$2:$F$${stepMaxRow},"<>Meilenstein")+COUNTIFS($B$2:$B$${stepMaxRow},B${r},$E$2:$E$${stepMaxRow},E${r},$F$2:$F$${stepMaxRow},"<>Meilenstein",$A$2:$A$${stepMaxRow},">"&A${r}))=0,"Aktueller Stand (Final)","Überarbeitet / Abgelöst"))))`,
        s.stepType === 'Meilenstein'
          ? 'Meilenstein (Prüfpunkt)'
          : isFinal
            ? 'Aktueller Stand (Final)'
            : 'Überarbeitet / Abgelöst'
      ),
      s.detailBox,
      s.learnings,
    ]);
  });
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(stepRows, [12, 24, 16, 24, 11, 20, 32, 54, 24, 14, 14]),
    'Entwicklungsschritte'
  );

  // --- Sheet 10 (Data 9): Ursachen_Tests_Befunde ---
  const causeRows: CellInput[][] = [
    [
      'Ursache_ID',
      'Kategorie',
      'Spur_Bezug',
      'Betroffener_Schritt',
      'Ausgeloester_Schritt',
      'Kurz_Titel (Befund / Test / Problem)',
      'Dokumentierte Beobachtung / Fakt',
      'Hypothese / Grenze der Nachweiskraft',
      'Learnings',
    ],
    ...bp.causes.map((c) => [
      c.id,
      c.category,
      c.laneRef,
      c.affectedStepId,
      c.triggeredStepId,
      c.title,
      c.observation,
      c.hypothesis,
      c.learnings,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(causeRows, [12, 22, 16, 18, 18, 34, 48, 44, 14]),
    'Ursachen_Tests_Befunde'
  );

  // --- Sheet 11 (Data 10): Verbindungen_Pfeile ---
  const arrowRows: CellInput[][] = [
    [
      'Pfeil_ID',
      'Von_Schritt_ID',
      'Nach_Schritt_ID',
      'Pfeil_Typ (Visuelle Darstellung)',
      'Begruendung_Ursache_ID',
      'Spur_Bezug',
      'Begründung des Entwicklungsschritts (Anzeige am Pfeil)',
      'Wirkrichtung_Layout',
    ],
    ...bp.arrows.map((a) => [
      a.id,
      a.from,
      a.to,
      a.arrowType,
      a.causeIdRaw,
      a.laneRef,
      a.rationale,
      a.layoutDirection,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(arrowRows, [10, 14, 15, 38, 22, 14, 52, 32]),
    'Verbindungen_Pfeile'
  );

  // --- Sheet 12 (Data 11): Mikro_Iterationen ---
  const microRows: CellInput[][] = [
    [
      'Detail_Box',
      'RSE_ID',
      'Spur',
      'Version',
      'Gehört_zu_Schritt',
      'Sub_Version_ID',
      'Konstruktive / Fertigungstechnische Änderung',
      'Beobachtetes Ergebnis',
      'Bewertung',
      'Medien_Ref',
    ],
    ...bp.micros.map((m) => [
      m.detailBox,
      m.rseId,
      m.spur,
      m.version,
      m.parentStepId,
      m.subVersionId,
      m.change,
      m.result,
      m.evaluation,
      m.mediaRef,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(microRows, [14, 10, 24, 24, 16, 16, 48, 44, 22, 24]),
    'Mikro_Iterationen'
  );

  // --- Sheet 13 (Data 12): Methodik_Learnings ---
  const learningRows: CellInput[][] = [
    [
      'Learning_ID',
      'Themenfeld',
      'Kurz_Titel_Learning',
      'Übertragbares Prinzip',
      'Konkretes Projektbeispiel (Anker in Datenbank)',
      'Verknuepfte_Schritte',
      'Verknuepfte_Ursachen',
      'Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)',
    ],
    ...bp.learnings.map((l) => [
      l.id,
      l.topic,
      l.title,
      l.principle,
      l.projectExample,
      l.linkedSteps,
      l.linkedCauses,
      l.scientificContext,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(learningRows, [12, 22, 32, 48, 44, 20, 18, 42]),
    'Methodik_Learnings'
  );

  // --- Sheet 14 (Data 13): Vorab_Dimensionierung ---
  const preDimRows: CellInput[][] = [
    [
      'Parameter-ID',
      'Teilbereich',
      'Größe / Parameter',
      'Wert',
      'Einheit',
      'Excel-Formel / Herkunft',
      'Evidenz-Typ',
      'Methodische Einordnung / Kritische Prüfung',
    ],
    ...bp.preDims.map((d) => [
      d.id,
      d.subDomain,
      d.parameter,
      d.value,
      d.unit,
      d.formulaOrSource,
      d.evidenceType,
      d.methodicalNotes,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(preDimRows, [14, 22, 32, 12, 12, 32, 22, 44]),
    'Vorab_Dimensionierung'
  );

  // Write uncompressed STORE-mode xlsx and inject standard Excel Dropdown Data Validations
  const rawBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: false });
  const rawBytes = new Uint8Array(rawBuf as ArrayBuffer);

  // Sheet indices (1-based):
  // 1: Anleitung_&_Struktur, 2: Überblick_Dashboard, 3: SGE_Auswertung, 4: RSE_Phasenmatrix,
  // 5: RSE_Stammdaten, 6: RSE_Phasenwechsel, 7: Bauteil_Integrationen, 8: Phasen_Konfiguration,
  // 9: Entwicklungsschritte, 10: Ursachen_Tests_Befunde, 11: Verbindungen_Pfeile, ...
  return injectDataValidations(rawBytes, {
    5: [
      {
        sqref: `D2:D${rseMaxRow}`,
        formula1: '"Vorgängermodell (Gen. n-1),Neu / Extern"',
      },
      {
        sqref: `O2:O${rseMaxRow}`,
        formula1: '"Entwurf (zu prüfen),In Überarbeitung,Geprüft & final"',
      },
    ],
    6: [
      {
        sqref: `G2:G${evMaxRow}`,
        formula1: '"BASE,CV,NEW,EC-GV,EC-PV,UD-GV,UD-PV,REM"',
      },
      {
        sqref: `O2:O${evMaxRow}`,
        formula1: '"Entwurf (zu prüfen),In Überarbeitung,Geprüft & final"',
      },
    ],
    9: [
      {
        sqref: `F2:F${stepMaxRow}`,
        formula1: '"Ausgangsstand,Weiterentwicklung,Problembehebung,Konzeptwechsel,Meilenstein,Integrationsstand"',
      },
    ],
    11: [
      {
        sqref: 'D2:D120',
        formula1:
          '"Weiterentwicklung (Optimierung),Problembehebung (Fehler-Reaktion),Konzeptwechsel (Paradigmenbruch),Konzept-Transfer (Bewährte Lösung übernehmen),Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur),Meilenstein-Erprobung (Praxistest)"',
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. Empty Project-Independent SGE Template (Anleitung + 13 Sheets)
// ---------------------------------------------------------------------------

export function buildEmptySgeTemplateBytes(): Uint8Array {
  return buildSgeWorkbookFromBlueprint({
    guideTitle: 'SGE-Entwicklungsdatenbank – Leere Projektvorlage (Template)',
    guideSubtitle:
      'Projektunabhängige Vorlage für Systemgenerationen-Engineering (SGE). Überschreiben Sie einfach die 2 markierten Musterzeilen mit Ihren eigenen Produktdaten – alle Excel-Formeln und Dropdowns sind bereits aktiv.',
    extraEmptyFormulaRows: 20,
    versions: [
      {
        versionKey: 'v0.0',
        sortOrder: 1,
        phaseName: 'v0.0 Referenzsystem',
        milestoneBadge: 'Referenz (Gen. n-1)',
        systemStateSummary: '[Muster] Ausgangsstand / Vorgängergeneration oder Wettbewerbsreferenz beschreiben.',
      },
      {
        versionKey: 'v1.0',
        sortOrder: 2,
        phaseName: 'v1.0 Erster Prototyp',
        milestoneBadge: 'M1: Funktionsmuster',
        systemStateSummary: '[Muster] Erster eigenständiger Funktionsaufbau der neuen Produktgeneration.',
      },
      {
        versionKey: 'v2.0',
        sortOrder: 3,
        phaseName: 'v2.0 Zielgeneration',
        milestoneBadge: 'M2: Freigabe',
        systemStateSummary: '[Muster] Überarbeiteter, getesteter Zielstand nach Validierung.',
      },
    ],
    lanes: [
      {
        spurId: 'S1_Mechanik_Struktur',
        name: 'Mechanik & Struktur',
        role: '[Muster] Tragende Struktur, Gehäuse und mechanische Baugruppen',
        maturitySummary: '[Muster] Basisstruktur definiert',
      },
      {
        spurId: 'S2_Elektrik_Steuerung',
        name: 'Elektrik & Steuerung',
        role: '[Muster] Sensorik, Aktorik, Energieversorgung und Regelung',
        maturitySummary: '[Muster] Steuerungskonzept in Arbeit',
      },
    ],
    rses: [
      {
        rseId: 'R1.1',
        spur: 'S1_Mechanik_Struktur',
        name: '[Muster] Hauptrahmen / Grundgehäuse',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Referenzsystem',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Entwurf (zu prüfen)',
        functionSummary: '[Musterzeile] Trägt alle Baugruppen. Bitte durch Ihr eigenes Referenzsystemelement ersetzen.',
      },
      {
        rseId: 'R2.1',
        spur: 'S2_Elektrik_Steuerung',
        name: '[Muster] Hauptsteuerung / Controller',
        origin: 'Neu / Extern',
        firstVersion: 'v1.0 Erster Prototyp',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Entwurf (zu prüfen)',
        functionSummary: '[Musterzeile] Neu eingeführte Baugruppe in v1.0. Bitte durch Ihr eigenes RSE ersetzen.',
      },
    ],
    events: [
      {
        eventId: 'EV001',
        rseId: 'R1.1',
        version: 'v0.0 Referenzsystem',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: '[Muster] Bestehende Grundstruktur aus Vorgängergeneration.',
        rationale: 'Ausgangsbasis für die Weiterentwicklung.',
        causeIdRaw: '',
        stepIdRaw: 'E01',
        reviewStatus: 'Entwurf (zu prüfen)',
        mediaRef: '',
      },
      {
        eventId: 'EV002',
        rseId: 'R1.1',
        version: 'v1.0 Erster Prototyp',
        statusCode: 'EC-GV',
        kombiPartIdRaw: '',
        stateDescription: '[Muster] Geometrie angepasst für einfachere Montage.',
        rationale: 'Geplante Gestaltvariation auf Basis der Anforderungen.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E02',
        reviewStatus: 'Entwurf (zu prüfen)',
        mediaRef: '',
      },
      {
        eventId: 'EV003',
        rseId: 'R2.1',
        version: 'v1.0 Erster Prototyp',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: '[Muster] Neue Steuerungseinheit erstmals integriert.',
        rationale: 'Ermöglicht automatisierten Betrieb.',
        causeIdRaw: '',
        stepIdRaw: 'E02',
        reviewStatus: 'Entwurf (zu prüfen)',
        mediaRef: '',
      },
    ],
    kombis: [],
    steps: [
      {
        id: 'E01',
        spur: 'S1_Mechanik_Struktur',
        rseIdRaw: 'R1.1',
        version: 'v0.0 Referenzsystem',
        stepType: 'Ausgangsstand',
        title: '[Muster] Ausgangsstand Grundstruktur',
        implementation: 'Referenzsystem analysiert und dokumentiert.',
        detailBox: '',
        learnings: '',
      },
      {
        id: 'E02',
        spur: 'S1_Mechanik_Struktur',
        rseIdRaw: 'R1.1, R2.1',
        version: 'v1.0 Erster Prototyp',
        stepType: 'Weiterentwicklung',
        title: '[Muster] Überarbeitete Struktur & neue Steuerung',
        implementation: 'Montagepunkte ergänzt und Steuerung integriert.',
        detailBox: 'Box A1',
        learnings: 'M01',
      },
    ],
    causes: [
      {
        id: 'U01',
        category: 'Anforderung / Analyse',
        laneRef: 'S1',
        affectedStepId: 'E01',
        triggeredStepId: 'E02',
        title: '[Muster] Hoher Montageaufwand im Ausgangsstand',
        observation: 'Fakt: Montage dauerte im Referenzsystem über 15 Minuten.',
        hypothesis: 'Reduktion der Schnittstellen halbiert die Montagezeit.',
        learnings: 'M01',
      },
    ],
    arrows: [
      {
        id: 'P01',
        from: 'E01',
        to: 'E02',
        arrowType: 'Weiterentwicklung (Optimierung)',
        causeIdRaw: 'U01',
        laneRef: 'S1 -> S1',
        rationale: '[Muster] Geplante konstruktive Anpassung zur Montagevereinfachung.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
    ],
    micros: [
      {
        detailBox: 'Box A1',
        rseId: 'R1.1',
        spur: 'S1_Mechanik_Struktur',
        version: 'v1.0 Erster Prototyp',
        parentStepId: 'E02',
        subVersionId: 'v1.0_IT1',
        change: '[Muster] Wandstärke von 2,0 mm auf 2,5 mm erhöht.',
        result: 'Deutlich geringere Durchbiegung im Belastungstest.',
        evaluation: 'Übernommen',
        mediaRef: '',
      },
    ],
    learnings: [
      {
        id: 'M01',
        topic: 'Konstruktionsmethodik',
        title: '[Muster] Frühzeitige Schnittstellen-Standardisierung',
        principle: 'Wiederkehrende Befestigungs- und Steckerschnittstellen früh vereinheitlichen.',
        projectExample: 'Einheitliches Bohrbild zwischen R1.1 und R2.1 (E02).',
        linkedSteps: 'E02',
        linkedCauses: 'U01',
        scientificContext: 'Übertragbares Gestaltungsprinzip für modulare Produktgenerationen.',
      },
    ],
    preDims: [
      {
        id: 'D01',
        subDomain: 'Grundauslegung',
        parameter: '[Muster] Maximales Gesamtgewicht',
        value: '5.0',
        unit: 'kg',
        formulaOrSource: 'Lastenheft Anforderung A01',
        evidenceType: 'Zielvorgabe',
        methodicalNotes: 'Dient als Auslegungsgrenze für v1.0 und v2.0.',
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 2. Universal Example Project: Modular Espresso / Filter Coffee Machine
//    (4 Generations v0.0..v2.0, 3 Lanes, 10 RSE, all 8 Status Codes,
//     KOMBI-01, P01..P06, U01..U04, 4 Micro-Iterations, M01..M03, D01..D05)
// ---------------------------------------------------------------------------

export function buildExampleCoffeeMachineBytes(): Uint8Array {
  return buildSgeWorkbookFromBlueprint({
    guideTitle: 'SGE-Beispielprojekt – Modulare Siebträger-/Filterkaffeemaschine',
    guideSubtitle:
      'Kompaktes, allgemeingültiges Beispielprojekt (4 Generationen v0.0–v2.0 · 3 Systemspuren · 10 RSE · alle 8 ISEM-Status-Codes · KOMBI-01 · 6 Kausalpfeile). Direkt in Visualize-SGE importierbar!',
    extraEmptyFormulaRows: 6,
    versions: [
      {
        versionKey: 'v0.0',
        sortOrder: 1,
        phaseName: 'v0.0 Basis-Filtermaschine',
        milestoneBadge: 'Referenz (Gen. n-1)',
        systemStateSummary:
          'Klassische Haushalts-Filterkaffeemaschine als Referenzgeneration (Gen. n-1) mit Glaskanne, Bimetall-Thermostat und einfachem Durchlauferhitzer.',
      },
      {
        versionKey: 'v1.0',
        sortOrder: 2,
        phaseName: 'v1.0 Thermoblock-Prototyp',
        milestoneBadge: 'M1: Funktionsmuster',
        systemStateSummary:
          'Erster Siebträger-Funktionsaufbau mit Aluminium-Thermoblock, 9-bar-Vibrationspumpe und digitalem PID-Regler; Glaskanne entfällt zugunsten Direktbezug.',
      },
      {
        versionKey: 'v1.1',
        sortOrder: 3,
        phaseName: 'v1.1 Druck- & Temperaturstabilisierung',
        milestoneBadge: 'M2: Dauertest',
        systemStateSummary:
          'Behebung von Temperaturschwankungen und Dichtigkeitsproblemen aus dem 500-Zyklen-Dauertest; Ergänzung von Dampflanze und OLED-Drehgeber.',
      },
      {
        versionKey: 'v2.0',
        sortOrder: 4,
        phaseName: 'v2.0 Modulare Serienreife',
        milestoneBadge: 'M3: Serienfreigabe',
        systemStateSummary:
          'Hohe Funktionsintegration durch Aluminium-Kombi-Brühblock (KOMBI-01), kompaktes Edelstahl-Gehäuse und wartungsfreundliche Modulbauweise.',
      },
    ],
    lanes: [
      {
        spurId: 'S1_Gehaeuse_Ergonomie',
        name: 'Gehäuse & Ergonomie',
        role: 'Tragrahmen, Tropfschale, Wassertank und äußere Nutzer-Schnittstellen',
        maturitySummary: 'Kompaktes Edelstahlgehäuse & auslaufsicherer 1,8-L-Tank serienreif',
      },
      {
        spurId: 'S2_Bruehgruppe_Hydraulik',
        name: 'Brühgruppe & Hydraulik',
        role: 'Wärmeerzeugung, Druckaufbau (9 bar), Siebträger-Brühkopf & Dampfauslass',
        maturitySummary: 'KOMBI-01 integriert Pumpenanschluss, Brühkopf & Dampfventil in einem Block',
      },
      {
        spurId: 'S3_Elektronik_Steuerung',
        name: 'Elektronik & Steuerung',
        role: 'Temperaturregelung (PID), Sensorik und interaktives Bedienfeld',
        maturitySummary: 'PID-Regelung (±0,5 °C) und Drehgeber-UI stabil im Dauertest validiert',
      },
    ],
    rses: [
      {
        rseId: 'R1.1',
        spur: 'S1_Gehaeuse_Ergonomie',
        name: 'Grundgehäuse & Tropfschalen-Rahmen',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Basis-Filtermaschine',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Trägt Hydraulik und Steuerung; schrittweise vom Kunststoffgehäuse zum kompakten Edelstahl-Modulrahmen weiterentwickelt.',
      },
      {
        rseId: 'R1.2',
        spur: 'S1_Gehaeuse_Ergonomie',
        name: 'Abnehmbarer Wassertank (1,8 L)',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Basis-Filtermaschine',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Frischwasser-Reservoir mit Bodenventil; in v1.1 wegen Mikroleckage ungeplant nachgedichtet.',
      },
      {
        rseId: 'R1.3',
        spur: 'S1_Gehaeuse_Ergonomie',
        name: 'Glaskanne & Warmhalteplatte',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Basis-Filtermaschine',
        removalVersion: 'v1.0 Thermoblock-Prototyp',
        predecessorOrReplacement: 'Ersetzt durch: R2.3 (Direktbezug in Tasse)',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Kannen-Warmhaltesystem der Filtermaschine; entfällt ab v1.0 durch Direktbezug über Siebträger.',
      },
      {
        rseId: 'R2.1',
        spur: 'S2_Bruehgruppe_Hydraulik',
        name: 'Heizmodul / Thermoblock',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Basis-Filtermaschine',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Vom offenen Rohr-Durchlauferhitzer (v0.0) auf 1350-W-Alu-Thermoblock (v1.0) und Dual-Kanal-Geometrie (v1.1) umgestellt.',
      },
      {
        rseId: 'R2.2',
        spur: 'S2_Bruehgruppe_Hydraulik',
        name: 'Vibrationspumpe & 9-bar-Überdruckventil',
        origin: 'Neu / Extern',
        firstVersion: 'v1.0 Thermoblock-Prototyp',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: 'KOMBI-01',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Erzeugt konstanten 9-bar-Brühdruck; ab v2.0 direkt an den Kombi-Brühblock (KOMBI-01) angeflanscht.',
      },
      {
        rseId: 'R2.3',
        spur: 'S2_Bruehgruppe_Hydraulik',
        name: 'Brühkopf & 58-mm-Siebträger-Aufnahme',
        origin: 'Neu / Extern',
        firstVersion: 'v1.0 Thermoblock-Prototyp',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: 'KOMBI-01',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Bajonett-Aufnahme für Siebträger & Filteradapter; ab v2.0 zentraler Kern von KOMBI-01.',
      },
      {
        rseId: 'R2.4',
        spur: 'S2_Bruehgruppe_Hydraulik',
        name: 'Dampflanze & Heißwasser-Ventil',
        origin: 'Neu / Extern',
        firstVersion: 'v1.1 Druck- & Temperaturstabilisierung',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: 'KOMBI-01',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Schwenkbare Milchschaum-Dampflanze; ab v2.0 als integrierter Ventilkanal Teil von KOMBI-01.',
      },
      {
        rseId: 'R3.1',
        spur: 'S3_Elektronik_Steuerung',
        name: 'Mechanischer Bimetall-Thermostat',
        origin: 'Vorgängermodell (Gen. n-1)',
        firstVersion: 'v0.0 Basis-Filtermaschine',
        removalVersion: 'v1.0 Thermoblock-Prototyp',
        predecessorOrReplacement: 'Ersetzt durch: R3.2 (PID-Regler & NTC)',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Einfacher Zweipunkt-Schalter (±6 °C Hysterese); in v1.0 durch PID-Regler ersetzt.',
      },
      {
        rseId: 'R3.2',
        spur: 'S3_Elektronik_Steuerung',
        name: 'PID-Temperaturregler & NTC-Sensor',
        origin: 'Neu / Extern',
        firstVersion: 'v1.0 Thermoblock-Prototyp',
        removalVersion: '',
        predecessorOrReplacement: 'Ersetzt: R3.1 (Bimetall-Thermostat)',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Regelt die Brühtemperatur präzise auf 93,0 °C ± 0,5 °C mittels SSR-Leistungsstufe.',
      },
      {
        rseId: 'R3.3',
        spur: 'S3_Elektronik_Steuerung',
        name: 'Drehgeber-UI & OLED-Statusanzeige',
        origin: 'Neu / Extern',
        firstVersion: 'v1.1 Druck- & Temperaturstabilisierung',
        removalVersion: '',
        predecessorOrReplacement: '',
        currentKombiIdRaw: '',
        reviewStatus: 'Geprüft & final',
        functionSummary: 'Kompaktes Bedienmodul für Bezugszeit, Temperatur-Vorwahl (Espresso/Filter) und Entkalkungs-Hinweis.',
      },
    ],
    events: [
      // v0.0 BASE
      {
        eventId: 'EV001',
        rseId: 'R1.1',
        version: 'v0.0 Basis-Filtermaschine',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: 'Spritzguss-Kunststoffgehäuse ohne Tropfschalen-Aufnahme.',
        rationale: 'Ausgangsstand der Basis-Filterkaffeemaschine (Gen. n-1).',
        causeIdRaw: '',
        stepIdRaw: 'E01',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV002',
        rseId: 'R1.2',
        version: 'v0.0 Basis-Filtermaschine',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: 'Fest verbauter 1,8-L-Wassertank mit einfachem Silikonschlauch-Abgang.',
        rationale: 'Referenzkomponente aus Vorgängermodell.',
        causeIdRaw: '',
        stepIdRaw: 'E01',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV003',
        rseId: 'R1.3',
        version: 'v0.0 Basis-Filtermaschine',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: '1,25-L-Glaskanne auf elektrisch beheizter Warmhalteplatte.',
        rationale: 'Standard-Filtermaschinen-Architektur.',
        causeIdRaw: '',
        stepIdRaw: 'E01',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV004',
        rseId: 'R2.1',
        version: 'v0.0 Basis-Filtermaschine',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: 'Druckloser U-Rohr-Durchlauferhitzer (950 W) nach Schwerkraftprinzip.',
        rationale: 'Erhitzt Wasser nur für drucklosen Filteraufguss.',
        causeIdRaw: '',
        stepIdRaw: 'E02',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV005',
        rseId: 'R3.1',
        version: 'v0.0 Basis-Filtermaschine',
        statusCode: 'BASE',
        kombiPartIdRaw: '',
        stateDescription: 'Bimetall-Schnappschalter (90–98 °C) ohne aktive Regelung.',
        rationale: 'Kostengünstige Temperaturbegrenzung im Referenzsystem.',
        causeIdRaw: '',
        stepIdRaw: 'E03',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },

      // v1.0 Thermoblock-Prototyp
      {
        eventId: 'EV006',
        rseId: 'R1.1',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'EC-GV',
        kombiPartIdRaw: '',
        stateDescription: 'Verstärkter Aluminium-Profilrahmen mit herausnehmbarer Edelstahl-Tropfschale.',
        rationale: 'Nimmt höhere Masse und Pumpenschwingungen des Siebträger-Prototyps auf.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E04',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV007',
        rseId: 'R1.3',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'REM',
        kombiPartIdRaw: '',
        stateDescription: 'Glaskanne & Warmhalteplatte vollständig entfernt.',
        rationale: 'Konzeptwechsel auf Direktbezug in Tasse über modularen Siebträger.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E04',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV008',
        rseId: 'R2.1',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'EC-PV',
        kombiPartIdRaw: '',
        stateDescription: '1350-W-Aluminium-Thermoblock mit Edelstahl-Heizspirale für 9-bar-Betrieb.',
        rationale: 'Prinzipvariation für kurze Aufheizzeit (< 45 s) und druckfesten Espressobezug.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E05',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV009',
        rseId: 'R2.2',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: 'Ulka-Vibrationspumpe (15 bar max) + externes Expansionsventil (9 bar).',
        rationale: 'Neu eingeführt zur Erzeugung des erforderlichen Extraktionsdrucks.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E05',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV010',
        rseId: 'R2.3',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: 'Gefräster Messing-Brühkopf (58 mm) mit Silikon-Dichtring und Duschsieb.',
        rationale: 'Neue Kernbaugruppe für Espresso-Siebträger und steckbaren Filter-Adapter.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E05',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV011',
        rseId: 'R3.1',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'REM',
        kombiPartIdRaw: '',
        stateDescription: 'Bimetall-Thermostat ausgebaut und durch elektronische Regelung ersetzt.',
        rationale: 'Temperaturhysterese von ±6 °C ist für konstante Espresso-Extraktion ungeeignet.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E06',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV012',
        rseId: 'R3.2',
        version: 'v1.0 Thermoblock-Prototyp',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: 'Mikrocontroller-PID-Regler mit Anlege-NTC-Fühler und Halbleiterrelais.',
        rationale: 'Aktive Temperaturregelung ersetzt mechanischen Thermostat.',
        causeIdRaw: 'U01',
        stepIdRaw: 'E06',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },

      // v1.1 Druck- & Temperaturstabilisierung
      {
        eventId: 'EV013',
        rseId: 'R1.2',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'UD-GV',
        kombiPartIdRaw: '',
        stateDescription: 'Bodenventil mit doppeltem EPDM-O-Ring und verstärkter Feder nachgerüstet.',
        rationale: 'Ungeplante Gestaltabweichung nach Tropfenbildung im 500-Zyklen-Dauertest.',
        causeIdRaw: 'U03',
        stepIdRaw: 'E07',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV014',
        rseId: 'R2.1',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'UD-PV',
        kombiPartIdRaw: '',
        stateDescription: 'Dual-Kanal-Thermoblock mit Vorheiz-Wendel und thermischer Masse-Entkopplung.',
        rationale: 'Ungeplanter Prinzipwechsel nach 7-°C-Temperaturabfall bei Serienbezug (U02).',
        causeIdRaw: 'U02',
        stepIdRaw: 'E08',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV015',
        rseId: 'R2.2',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'UD-GV',
        kombiPartIdRaw: '',
        stateDescription: 'Elastomer-Schwingungsdämpfer an Pumpenhalterung + gekürzter PTFE-Druckschlauch.',
        rationale: 'Reduziert Betriebsgeräusch um 8 dB(A) und eliminiert Resonanz am Rahmen.',
        causeIdRaw: 'U03',
        stepIdRaw: 'E08',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV016',
        rseId: 'R2.3',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'EC-GV',
        kombiPartIdRaw: '',
        stateDescription: 'Optimierter Wasserverteiler (6-Loch-Präzisionsdusche) für gleichmäßige Extraktion.',
        rationale: 'Geplante Feingeometrie-Optimierung auf Basis von Extraktionsmessungen.',
        causeIdRaw: 'U02',
        stepIdRaw: 'E08',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV017',
        rseId: 'R2.4',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: 'Kugelgelagerte Edelstahl-Dampflanze mit separatem 3-Wege-Magnetventil.',
        rationale: 'Erweitert Funktionsumfang um Milchschaum- und Heißwasserausgabe.',
        causeIdRaw: '',
        stepIdRaw: 'E08',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV018',
        rseId: 'R3.2',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'EC-GV',
        kombiPartIdRaw: '',
        stateDescription: 'NTC-Fühler direkt in Tauchhülse am Brühwasserauslass + Feedforward-Regelparameter.',
        rationale: 'Spurübergreifende Reaktion auf Temperaturabfall im Thermoblock (U02).',
        causeIdRaw: 'U02',
        stepIdRaw: 'E09',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV019',
        rseId: 'R3.3',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        statusCode: 'NEW',
        kombiPartIdRaw: '',
        stateDescription: 'Gerasteter Aluminium-Drehgeber mit 1,3"-OLED-Display (Shot-Timer & Profilwahl).',
        rationale: 'Macht Brühtemperatur, Profil (Espresso/Filter) und Entkalkungsstatus transparent.',
        causeIdRaw: '',
        stepIdRaw: 'E09',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },

      // v2.0 Modulare Serienreife
      {
        eventId: 'EV020',
        rseId: 'R1.1',
        version: 'v2.0 Modulare Serienreife',
        statusCode: 'EC-GV',
        kombiPartIdRaw: '',
        stateDescription: 'Gebürstetes Edelstahl-Biegegehäuse mit werkzeuglos abnehmbarer Service-Rückwand.',
        rationale: 'Reduziert Teilezahl und Montagezeit im Hinblick auf Serienfertigung (U04).',
        causeIdRaw: 'U04',
        stepIdRaw: 'E10',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV021',
        rseId: 'R2.2',
        version: 'v2.0 Modulare Serienreife',
        statusCode: 'EC-GV',
        kombiPartIdRaw: 'KOMBI-01',
        stateDescription: 'Pumpen-Druckanschluss & OPV direkt in KOMBI-01-Brühblock eingeschraubt.',
        rationale: 'Eliminiert 2 Hochdruck-Schlauchverbindungen und potenzielle Leckstellen (U04).',
        causeIdRaw: 'U04',
        stepIdRaw: 'E11',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV022',
        rseId: 'R2.3',
        version: 'v2.0 Modulare Serienreife',
        statusCode: 'EC-PV',
        kombiPartIdRaw: 'KOMBI-01',
        stateDescription: 'Brühkopf als zentraler CNC-Aluminium-Funktionsblock (KOMBI-01) verschmolzen.',
        rationale: '3-fach-Funktionsintegration senkt Montagezeit um 40 % und verkürzt Wasserwege.',
        causeIdRaw: 'U04',
        stepIdRaw: 'E11',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV023',
        rseId: 'R2.4',
        version: 'v2.0 Modulare Serienreife',
        statusCode: 'EC-GV',
        kombiPartIdRaw: 'KOMBI-01',
        stateDescription: 'Dampfventil-Sitz und Lanzen-Abgang direkt in KOMBI-01 integriert.',
        rationale: 'Verkürzt Dampfweg (trockenerer Dampf) und spart separate Ventilhalterung.',
        causeIdRaw: 'U04',
        stepIdRaw: 'E11',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
      {
        eventId: 'EV024',
        rseId: 'R3.3',
        version: 'v2.0 Modulare Serienreife',
        statusCode: 'CV',
        kombiPartIdRaw: '',
        stateDescription: 'Bewährtes Drehgeber-UI & OLED-Modul unverändert in Serienstand übernommen.',
        rationale: 'Vollständig validiert in M2 (Dauertest) – hohe Carryover-Stabilität.',
        causeIdRaw: '',
        stepIdRaw: 'E12',
        reviewStatus: 'Geprüft & final',
        mediaRef: '',
      },
    ],
    kombis: [
      {
        kombiId: 'KOMBI-01',
        partName: 'Integrierter Aluminium-Brühblock mit Pumpen-OPV & Dampfventil',
        integratedFromPhase: 'v2.0 Modulare Serienreife',
        involvedRseRaw: 'R2.2, R2.3, R2.4',
        involvedLanes: 'S2 (3 RSE in 1 Block)',
        variationType: 'PV (3-fach-Funktionsintegration)',
        rationale:
          'Verschmilzt Pumpen-Überdruckventil (R2.2), 58-mm-Brühkopf (R2.3) und Dampfventil-Sitz (R2.4) in einem kompakten CNC-Block – spart 4 Dichtstellen und 40 % Montagezeit.',
        mediaRef: '',
      },
    ],
    steps: [
      {
        id: 'E01',
        spur: 'S1_Gehaeuse_Ergonomie',
        rseIdRaw: 'R1.1, R1.2, R1.3',
        version: 'v0.0 Basis-Filtermaschine',
        stepType: 'Ausgangsstand',
        title: 'Referenz-Gehäuse & Glaskanne (Gen. n-1)',
        implementation: 'Kunststoffgehäuse mit festem 1,8-L-Tank und Warmhalteplatte.',
        detailBox: '',
        learnings: '',
      },
      {
        id: 'E02',
        spur: 'S2_Bruehgruppe_Hydraulik',
        rseIdRaw: 'R2.1',
        version: 'v0.0 Basis-Filtermaschine',
        stepType: 'Ausgangsstand',
        title: 'Druckloser Durchlauferhitzer',
        implementation: '950-W-U-Rohr-Erhitzer für drucklosen Filteraufguss.',
        detailBox: '',
        learnings: '',
      },
      {
        id: 'E03',
        spur: 'S3_Elektronik_Steuerung',
        rseIdRaw: 'R3.1',
        version: 'v0.0 Basis-Filtermaschine',
        stepType: 'Ausgangsstand',
        title: 'Bimetall-Zweipunkt-Thermostat',
        implementation: 'Mechanische Ein/Aus-Schaltung ohne Sollwertwahl.',
        detailBox: '',
        learnings: '',
      },
      {
        id: 'E04',
        spur: 'S1_Gehaeuse_Ergonomie',
        rseIdRaw: 'R1.1, R1.3',
        version: 'v1.0 Thermoblock-Prototyp',
        stepType: 'Konzeptwechsel',
        title: 'Modulrahmen & Entfall Glaskanne',
        implementation: 'Alu-Profilrahmen mit herausnehmbarer Tropfschale für Direktbezug.',
        detailBox: '',
        learnings: 'M01',
      },
      {
        id: 'E05',
        spur: 'S2_Bruehgruppe_Hydraulik',
        rseIdRaw: 'R2.1, R2.2, R2.3',
        version: 'v1.0 Thermoblock-Prototyp',
        stepType: 'Konzeptwechsel',
        title: '9-bar-Thermoblock & 58-mm-Siebträger',
        implementation: 'Erster druckfester Aufbau mit Thermoblock, Vibrationspumpe und Messing-Brühkopf.',
        detailBox: 'Box A1',
        learnings: 'M01',
      },
      {
        id: 'E06',
        spur: 'S3_Elektronik_Steuerung',
        rseIdRaw: 'R3.1, R3.2',
        version: 'v1.0 Thermoblock-Prototyp',
        stepType: 'Konzeptwechsel',
        title: 'Umstieg auf digitale PID-Regelung',
        implementation: 'Bimetall durch Mikrocontroller-PID mit SSR und NTC-Sensor abgelöst.',
        detailBox: '',
        learnings: 'M02',
      },
      {
        id: 'E07',
        spur: 'S1_Gehaeuse_Ergonomie',
        rseIdRaw: 'R1.2',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        stepType: 'Problembehebung',
        title: 'Tank-Bodenventil doppelt abgedichtet',
        implementation: 'Zweiter EPDM-O-Ring und korrosionsfeste Edelstahlfeder eingesetzt.',
        detailBox: '',
        learnings: 'M02',
      },
      {
        id: 'E08',
        spur: 'S2_Bruehgruppe_Hydraulik',
        rseIdRaw: 'R2.1, R2.2, R2.3, R2.4',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        stepType: 'Problembehebung',
        title: 'Dual-Kanal-Thermoblock, Dämpfung & Dampflanze',
        implementation: 'Vorheiz-Wendel gegen Temperaturabfall, entkoppelte Pumpe, Dampflanze ergänzt.',
        detailBox: 'Box A1',
        learnings: 'M02',
      },
      {
        id: 'E09',
        spur: 'S3_Elektronik_Steuerung',
        rseIdRaw: 'R3.2, R3.3',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        stepType: 'Weiterentwicklung',
        title: 'Tauchhülsen-NTC & OLED-Drehgeber',
        implementation: 'Direkte Wassertemperatur-Messung am Auslass plus Drehgeber-Bedienfeld.',
        detailBox: 'Box A2',
        learnings: 'M02',
      },
      {
        id: 'E10',
        spur: 'S1_Gehaeuse_Ergonomie',
        rseIdRaw: 'R1.1',
        version: 'v2.0 Modulare Serienreife',
        stepType: 'Weiterentwicklung',
        title: 'Edelstahl-Seriengehäuse mit Serviceklappe',
        implementation: 'Werkzeugloser Zugang zu Pumpe und Steuerung für schnelle Wartung.',
        detailBox: '',
        learnings: 'M03',
      },
      {
        id: 'E11',
        spur: 'S2_Bruehgruppe_Hydraulik',
        rseIdRaw: 'R2.2, R2.3, R2.4',
        version: 'v2.0 Modulare Serienreife',
        stepType: 'Integrationsstand',
        title: 'KOMBI-01: Integrierter Aluminium-Brühblock',
        implementation: 'Zusammenführung von Brühkopf, OPV und Dampfventil in einem CNC-Bauteil.',
        detailBox: 'Box A1',
        learnings: 'M03',
      },
      {
        id: 'E12',
        spur: 'S3_Elektronik_Steuerung',
        rseIdRaw: 'R3.3',
        version: 'v2.0 Modulare Serienreife',
        stepType: 'Meilenstein',
        title: 'M3 Serienfreigabe & Dauertest-Bestätigung',
        implementation: '1000-Zyklen-Validierung ohne Leckage und mit ±0,4 °C Temperaturstabilität.',
        detailBox: '',
        learnings: 'M03',
      },
    ],
    causes: [
      {
        id: 'U01',
        category: 'Anforderung / Konzept',
        laneRef: 'S1, S2, S3',
        affectedStepId: 'E02',
        triggeredStepId: 'E05',
        title: 'Produktziel: Kombination aus Espresso (9 bar) & Filterbezug',
        observation: 'Das Vorgängersystem (v0.0) arbeitet drucklos mit ±6 °C Schwankung und kann keine Espresso-Crema erzeugen.',
        hypothesis: 'Ein kompakter 1350-W-Thermoblock mit 9-bar-Pumpe und PID deckt beide Brüharten ab.',
        learnings: 'M01',
      },
      {
        id: 'U02',
        category: 'Testbefund / Messung',
        laneRef: 'S2, S3',
        affectedStepId: 'E05',
        triggeredStepId: 'E08',
        title: '7 °C Temperaturabfall bei zwei Bezügen hintereinander',
        observation: 'Messung mit Typ-K-Fühler im Siebträger: 1. Bezug 93,2 °C, 2. Bezug fällt auf 86,1 °C ab.',
        hypothesis: 'Anlege-NTC reagiert zu träge und der Einfach-Kanal kühlt bei 60 ml Durchfluss zu stark aus.',
        learnings: 'M02',
      },
      {
        id: 'U03',
        category: 'Problem / Defekt',
        laneRef: 'S1, S2',
        affectedStepId: 'E04',
        triggeredStepId: 'E07',
        title: 'Mikroleckage am Tankventil & 68 dB(A) Pumpenbrummen',
        observation: 'Nach 180 Zyklen im Dauertest traten Wassertropfen unter dem Tank auf; starre Pumpenmontage übertrug 50-Hz-Brummen.',
        hypothesis: 'Einzel-O-Ring setzt sich bei Kalkablagerung; Elastomer-Entkopplung verhindert Körperschall.',
        learnings: 'M02',
      },
      {
        id: 'U04',
        category: 'Fertigung / Montage',
        laneRef: 'S1, S2',
        affectedStepId: 'E08',
        triggeredStepId: 'E11',
        title: 'Hohe Montagezeit & 6 Einzelverschraubungen in der Hydraulik',
        observation: 'Fakt: Montage und Dichtigkeitsprüfung der 3 separaten Hydraulik-Baugruppen dauern 28 Minuten pro Gerät.',
        hypothesis: 'Funktionsintegration in einen gemeinsamen CNC-Brühblock (KOMBI-01) halbiert Schnittstellen und Prüfzeit.',
        learnings: 'M03',
      },
    ],
    arrows: [
      {
        id: 'P01',
        from: 'E02',
        to: 'E05',
        arrowType: 'Konzeptwechsel (Paradigmenbruch)',
        causeIdRaw: 'U01',
        laneRef: 'S2 -> S2',
        rationale: 'Umstieg vom drucklosen Durchlauferhitzer auf 9-bar-Thermoblock & Siebträger.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
      {
        id: 'P02',
        from: 'E03',
        to: 'E06',
        arrowType: 'Konzeptwechsel (Paradigmenbruch)',
        causeIdRaw: 'U01',
        laneRef: 'S3 -> S3',
        rationale: 'Ablösung des mechanischen Bimetall-Thermostats durch präzisen PID-Regler.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
      {
        id: 'P03',
        from: 'E05',
        to: 'E08',
        arrowType: 'Problembehebung (Fehler-Reaktion)',
        causeIdRaw: 'U02',
        laneRef: 'S2 -> S2',
        rationale: 'Dual-Kanal-Thermoblock eliminiert den gemessenen 7-°C-Temperaturabfall im Serienbezug.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
      {
        id: 'P04',
        from: 'E08',
        to: 'E09',
        arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
        causeIdRaw: 'U02',
        laneRef: 'S2 -> S3',
        rationale: 'Direkte Tauchhülsen-Messung (S3) verkürzt Regel-Totzeit für den neuen Thermoblock (S2).',
        layoutDirection: 'Versionsintern: S-Kurve',
      },
      {
        id: 'P05',
        from: 'E08',
        to: 'E11',
        arrowType: 'Weiterentwicklung (Optimierung)',
        causeIdRaw: 'U04',
        laneRef: 'S2 -> S2',
        rationale: 'Funktionsintegration von Pumpen-OPV, Brühkopf und Dampfventil in KOMBI-01.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
      {
        id: 'P06',
        from: 'E09',
        to: 'E12',
        arrowType: 'Meilenstein-Erprobung (Praxistest)',
        causeIdRaw: 'U04',
        laneRef: 'S3 -> S3',
        rationale: '1000-Zyklen-Serienfreigabe bestätigt stabile PID-Regelung und bewährtes Bedienkonzept.',
        layoutDirection: 'Versionsübergreifend: Links -> Rechts',
      },
    ],
    micros: [
      {
        detailBox: 'Box A1',
        rseId: 'R2.3',
        spur: 'S2_Bruehgruppe_Hydraulik',
        version: 'v1.0 Thermoblock-Prototyp',
        parentStepId: 'E05',
        subVersionId: 'v1.0_D1',
        change: 'Brühkopf-Dichtring: NBR 70 Shore -> lebensmittelechtes Silikon 60 Shore mit Fase.',
        result: 'Siebträger lässt sich mit 35 % weniger Handkraft dicht einspannen.',
        evaluation: 'Übernommen (v1.0)',
        mediaRef: '',
      },
      {
        detailBox: 'Box A1',
        rseId: 'R2.1',
        spur: 'S2_Bruehgruppe_Hydraulik',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        parentStepId: 'E08',
        subVersionId: 'v1.1_TB1',
        change: 'Heizkanal-Länge von 420 mm auf 680 mm (Doppelwendel) vergrößert.',
        result: 'Temperaturabfall im 2. Bezug sinkt von 7,1 °C auf 0,8 °C.',
        evaluation: 'Final übernommen (v1.1)',
        mediaRef: '',
      },
      {
        detailBox: 'Box A2',
        rseId: 'R3.2',
        spur: 'S3_Elektronik_Steuerung',
        version: 'v1.1 Druck- & Temperaturstabilisierung',
        parentStepId: 'E09',
        subVersionId: 'v1.1_PID1',
        change: 'Feedforward-Vorsteuerung (+25 % Heizleistung sobald Pumpe startet) ergänzt.',
        result: 'Ausregelzeit auf ±0,5 °C halbiert sich von 12 s auf 5 s.',
        evaluation: 'Final übernommen (v1.1)',
        mediaRef: '',
      },
      {
        detailBox: 'Box A1',
        rseId: 'R2.3',
        spur: 'S2_Bruehgruppe_Hydraulik',
        version: 'v2.0 Modulare Serienreife',
        parentStepId: 'E11',
        subVersionId: 'v2.0_K1',
        change: 'CNC-Block KOMBI-01: OPV-Rücklaufkanal direkt ins Guss-/Frästeil gebohrt.',
        result: '4 Druckverschraubungen eingespart, Dichtprüfung beim ersten Versuch bestanden.',
        evaluation: 'Final übernommen (v2.0)',
        mediaRef: '',
      },
    ],
    learnings: [
      {
        id: 'M01',
        topic: 'Systemarchitektur',
        title: 'Frühe Entkopplung von Rahmen und Kernhydraulik',
        principle: 'In frühen Prototypen (v1.0) Kernkomponenten modular auf einem offenen Profilrahmen testen, bevor sie integriert werden.',
        projectExample: 'Separater Thermoblock, Pumpe und Brühkopf in v1.0 (E04, E05) ermöglichten schnelle Austauschtests.',
        linkedSteps: 'E04, E05',
        linkedCauses: 'U01',
        scientificContext: 'SGE-Leitprinzip: Erst Funktion im modularen Aufbau absichern, dann integrieren.',
      },
      {
        id: 'M02',
        topic: 'Test & Validierung',
        title: 'Sensorik unmittelbar an der Wirkstelle platzieren',
        principle: 'Regelgrößen möglichst verzögerungsfrei direkt am Wirkort messen, statt indirekt am Gehäuse.',
        projectExample: 'Wechsel vom Anlege-NTC zur Tauchhülse am Brühwasserauslass (E09) löste Temperaturabfall U02.',
        linkedSteps: 'E08, E09',
        linkedCauses: 'U02, U03',
        scientificContext: 'Regelungstechnische Totzeitminimierung in thermischen Mechatronik-Systemen.',
      },
      {
        id: 'M03',
        topic: 'Funktionsintegration',
        title: 'Schnittstellen-Reduktion durch gezielte KOMBI-Bauteile',
        principle: 'Sobald Wirkprinzipien stabil sind, angrenzende Funktionsmodule in ein gemeinsames Bauteil verschmelzen.',
        projectExample: 'KOMBI-01 (E11) vereint R2.2, R2.3 und R2.4 und senkt die Montagezeit um 40 %.',
        linkedSteps: 'E10, E11, E12',
        linkedCauses: 'U04',
        scientificContext: 'Design for Assembly (DfA) & SGE-Funktionsintegration in reifen Produktgenerationen.',
      },
    ],
    preDims: [
      {
        id: 'D01',
        subDomain: 'Thermik',
        parameter: 'Heizleistung Thermoblock',
        value: '1350',
        unit: 'W',
        formulaOrSource: 'Energiebilanz 60 ml/25 s (ΔT = 75 K)',
        evidenceType: 'Rechnerische Auslegung',
        methodicalNotes: 'Inkl. 20 % Sicherheitsreserve für Serienbezug.',
      },
      {
        id: 'D02',
        subDomain: 'Hydraulik',
        parameter: 'Ziel-Brühdruck (Espresso)',
        value: '9.0',
        unit: 'bar',
        formulaOrSource: 'OPV-Kalibrierung gegen Blindfilter',
        evidenceType: 'Messwert (Prüfstand)',
        methodicalNotes: 'Für Filter-Modus per PWM auf 1,5 bar reduziert.',
      },
      {
        id: 'D03',
        subDomain: 'Thermik',
        parameter: 'Soll-Brühtemperatur',
        value: '93.0',
        unit: '°C',
        formulaOrSource: 'PID-Sollwert (Toleranz ±0,5 °C)',
        evidenceType: 'Messwert (Typ-K)',
        methodicalNotes: 'Validiert über 500 Zyklen in M2.',
      },
      {
        id: 'D04',
        subDomain: 'Ergonomie',
        parameter: 'Nutzvolumen Wassertank',
        value: '1.8',
        unit: 'L',
        formulaOrSource: 'Anforderung >= 12 Bezüge ohne Nachfüllen',
        evidenceType: 'Zielvorgabe',
        methodicalNotes: 'Kompakt in Rückwand integriert (R1.2).',
      },
      {
        id: 'D05',
        subDomain: 'Performance',
        parameter: 'Aufheizzeit bis Bezugsbereitschaft',
        value: '42',
        unit: 's',
        formulaOrSource: 'Stoppuhr-Messung ab 20 °C Kaltstart',
        evidenceType: 'Messwert (Prototyp)',
        methodicalNotes: 'Deutlich unter dem Zielwert von 60 s.',
      },
    ],
  });
}

function triggerXlsxDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadEmptySgeTemplateXlsx(): void {
  const bytes = buildEmptySgeTemplateBytes();
  triggerXlsxDownload(bytes, 'SGE_Entwicklungsdatenbank_Template.xlsx');
}

export function downloadExampleProjectXlsx(): void {
  const bytes = buildExampleCoffeeMachineBytes();
  triggerXlsxDownload(bytes, 'SGE_Beispielprojekt_Kaffeemaschine.xlsx');
}
