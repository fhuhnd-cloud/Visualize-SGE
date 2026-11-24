export type StatusCode =
  | 'BASE'
  | 'CV'
  | 'NEW'
  | 'EC-GV'
  | 'EC-PV'
  | 'UD-GV'
  | 'UD-PV'
  | 'REM';

export type StatusColorGroup = 'BASE' | 'CV' | 'NEW' | 'EC' | 'UD' | 'REM' | 'KOMBI';

export type ColorMode = 'planning' | 'variation' | 'lifecycle';

/** Global application mode: clean presentation vs full editing */
export type AppMode = 'presentation' | 'edit';

/** Progressive disclosure depth (1=Compact, 2=Standard, 3=Deep Dive) */
export type DetailLevel = 1 | 2 | 3;

export type WorkspaceView = 'board' | 'swimlane2d' | 'matrix' | 'media' | 'tables';

export interface PaletteSwatch {
  bg: string;
  border: string;
  text: string;
  dashed?: boolean;
}

export type CustomPalette = Record<StatusColorGroup, PaletteSwatch>;

/** 1. Überblick_Dashboard */
export interface SpurDashboardRow {
  spurId: string;               // Spur_ID (S1_Rahmen_Peripherie .. S9_Benutzeroberflaeche)
  name: string;                 // Systemspur / Baugruppe
  role: string;                 // Rolle im Gesamtsystem
  totalRse: number;             // RSE gesamt
  activeRseV22: number;         // Aktive RSE (v2.2)
  removedOrReplaced: number;    // Entfernt / Ersetzt
  integratedRse: number;        // Integrierte RSE (Kombi)
  versionEventsCount: number;   // Versions-Events
  microIterationsCount: number; // Mikro-Iterationen
  eventsChecked: string;        // Events geprüft
  maturitySummary: string;      // Aktueller Reifegrad (SGE-Überblick)
  rowIndex: number;
}

/** 2. Phasen_Konfiguration */
export interface PhaseVersionConfig {
  versionKey: string;           // Version_Key (v0.0 .. v2.2)
  sortOrder: number;            // Sortier_Nr (1 .. 7)
  phaseName: string;            // Phasen_Name (e.g., "v1.1 Entenrennen")
  milestoneBadge: string;       // Meilenstein_Badge (e.g., "M1: Entenrennen", "")
  isMilestone: boolean;         // true for M1, M2, M3
  systemStateSummary: string;   // Technischer Systemstand & Einordnung
  rowIndex: number;
}

/** 3. RSE_Stammdaten */
export interface RseMaster {
  rseId: string;                  // RSE_ID (R1.1 .. R9.4)
  spur: string;                   // Spur
  name: string;                   // RSE_Bezeichnung
  origin: string;                 // Herkunft
  firstVersion: string;           // Erste_Version
  firstVersionNr: number;         // Erste_Ver_Nr
  removalVersion: string;         // Entfall_Version
  removalVersionNr: number | null;// Entfall_Ver_Nr (null if 999 or empty)
  currentLifecycle: string;       // Aktueller_Lebenszyklus
  predecessorOrReplacement: string; // Vorgaenger_oder_Ersatz_RSE
  currentKombiIdRaw: string;      // Aktuelle_Kombi_ID
  currentKombiIds: string[];      // Parsed KOMBI IDs
  rseCountInPart: number;         // RSE_Anzahl_im_Bauteil
  versionEventsCount: number;     // Anzahl_Versions_Events
  microIterationsCount: number;   // Anzahl_Mikro_Iterationen
  reviewStatus: string;           // Pruefstatus_Inhalt
  functionSummary: string;        // Kurzbeschreibung_Funktion
  rowIndex: number;
}

/** 4. RSE_Phasenwechsel */
export interface RsePhaseEvent {
  eventId: string;                // Event_ID (EV001 .. EV165)
  rseId: string;                  // RSE_ID
  spur: string;                   // Spur
  version: string;                // Version (full phaseName)
  versionNr: number;              // Version_Nr (1 .. 7)
  lookupKey: string;              // Lookup_Key (RSE_ID|Version_Nr)
  statusCode: StatusCode;         // Status_Code
  planningCategoryFig2: string;   // Planungs_Kategorie_Fig2
  variationType: string;          // SGE_Variationstyp
  kombiPartIdRaw: string;         // Kombi_Bauteil_ID
  kombiPartIds: string[];         // Parsed KOMBI IDs
  stateDescription: string;       // Kurzbeschreibung_Zustand
  rationale: string;              // Begruendung
  causeIdRaw: string;             // Ursache_ID
  causeIds: string[];             // Parsed Ursache_IDs
  stepIdRaw: string;              // Schritt_ID
  stepIds: string[];              // Parsed Schritt_IDs
  reviewStatus: string;           // Pruefstatus_Inhalt
  mediaRef: string;               // Medien_Ref
  rowIndex: number;
}

/** 5. RSE_Phasenmatrix */
export interface RseMatrixRow {
  rseId: string;
  spur: string;
  name: string;
  kombiIdRaw: string;
  kombiIds: string[];
  /** Map from Version_Key (e.g. "v0.0") -> StatusCode or "" */
  statusByVersionKey: Record<string, StatusCode | ''>;
  rowIndex: number;
}

/** 6. Bauteil_Integrationen */
export interface KombiIntegration {
  kombiId: string;                // Kombi_ID (KOMBI-01 .. KOMBI-06)
  partName: string;               // Bauteil_Bezeichnung
  integratedFromPhase: string;    // Integration_ab_Phase
  rseCountInPart: number;         // Anzahl_RSE_im_Bauteil
  involvedRseRaw: string;         // Beteiligte_RSE_IDs
  involvedRseIds: string[];       // Parsed RSE IDs
  involvedLanes: string;          // Beteiligte_Spuren
  variationType: string;          // SGE_Variationsart
  rationale: string;              // Begruendung_Funktionsintegration
  mediaRef: string;               // Medien_Ref
  rowIndex: number;
}

/** 7. Mikro_Iterationen */
export interface MicroIteration {
  id: string;                     // Stable unique key (Sub_Version_ID or fallback)
  detailBox: string;              // Detail_Box (Box A1, Box PH_RH, ...)
  rseId: string;                  // RSE_ID
  spur: string;                   // Spur
  version: string;                // Version
  versionNr: number | null;       // Resolved Sortier_Nr
  parentStepId: string;           // Gehört_zu_Schritt
  subVersionId: string;           // Sub_Version_ID
  change: string;                 // Konstruktive / Fertigungstechnische Änderung
  result: string;                 // Beobachtetes Ergebnis
  evaluation: string;             // Bewertung
  mediaRef: string;               // Medien_Ref
  isPlaceholder: boolean;         // true for Box PH_* or placeholder text
  rowIndex: number;
}

/** 8. Entwicklungsschritte */
export interface DevelopmentStep {
  id: string;                     // Schritt_ID (E01..E49)
  spur: string;                   // Spur
  rseIds: string[];               // RSE_ID (parsed)
  rseIdRaw: string;
  version: string;                // Version
  versionNr: number | null;       // Version_Nr
  stepType: string;               // Schritt_Typ
  title: string;                  // Kurz_Titel
  implementation: string;         // Konstruktive / Logische Ausführung
  stand: string;                  // Automatischer_Stand
  detailBox: string;              // Detail_Box
  learnings: string[];            // Learnings
  rowIndex: number;
}

/** 9. Ursachen_Tests_Befunde */
export interface CauseFinding {
  id: string;                     // Ursache_ID (U01..U25)
  category: string;               // Kategorie
  laneRef: string;                // Spur_Bezug
  affectedStepId: string;         // Betroffener_Schritt
  triggeredStepId: string;        // Ausgeloester_Schritt
  title: string;                  // Kurz_Titel
  observation: string;            // Dokumentierte Beobachtung / Fakt
  hypothesis: string;             // Hypothese / Grenze der Nachweiskraft
  learnings: string[];            // Learnings
  rowIndex: number;
}

/** 10. Verbindungen_Pfeile */
export type EdgeCategory =
  | 'optimization'
  | 'bugfix'
  | 'paradigmShift'
  | 'transfer'
  | 'crossLane'
  | 'milestoneTest';

export interface ConnectionArrow {
  id: string;                     // Pfeil_ID (P_01..P_50)
  from: string;                   // Von_Schritt_ID
  to: string;                     // Nach_Schritt_ID
  /** Optional direct 2D-Swimlane anchors for arrows added directly between RSE nodes */
  fromRseId?: string;
  fromVersionKey?: string;
  toRseId?: string;
  toVersionKey?: string;
  arrowType: string;              // Pfeil_Typ
  category: EdgeCategory;
  causeIdRaw: string;             // Begruendung_Ursache_ID
  causeIds: string[];
  laneRef: string;                // Spur_Bezug
  rationale: string;              // Begründung des Entwicklungsschritts
  layoutDirection: string;        // Wirkrichtung_Layout
  rowIndex: number;
}

/** 11. Methodik_Learnings */
export interface MethodikLearning {
  id: string;                     // Learning_ID (M01..M16)
  topic: string;                  // Themenfeld
  title: string;                  // Kurz_Titel_Learning
  principle: string;              // Übertragbares Prinzip
  projectExample: string;         // Konkretes Projektbeispiel
  linkedStepIds: string[];        // Verknuepfte_Schritte
  linkedCauseIds: string[];       // Verknuepfte_Ursachen
  scientificContext: string;      // Wissenschaftliche Einordnung
  rowIndex: number;
}

/** 12. Vorab_Dimensionierung */
export interface PreDimensioningRow {
  id: string;                     // Parameter-ID (D01..D32)
  subDomain: string;              // Teilbereich
  parameter: string;              // Größe / Parameter
  value: string;                  // Wert
  unit: string;                   // Einheit
  formulaOrSource: string;        // Excel-Formel / Herkunft
  evidenceType: string;           // Evidenz-Typ
  methodicalNotes: string;        // Methodische Einordnung / Kritische Prüfung
  rowIndex: number;
}

/** 13. SGE_Auswertung */
export interface SgeSummaryRow {
  metricLabel: string;
  valuesByVersionKey: Record<string, string>;
  totalOrSummary: string;
  rowIndex: number;
}

export type SheetNameV14 =
  | 'Überblick_Dashboard'
  | 'Phasen_Konfiguration'
  | 'RSE_Stammdaten'
  | 'RSE_Phasenwechsel'
  | 'RSE_Phasenmatrix'
  | 'Bauteil_Integrationen'
  | 'Mikro_Iterationen'
  | 'Entwicklungsschritte'
  | 'Ursachen_Tests_Befunde'
  | 'Verbindungen_Pfeile'
  | 'Methodik_Learnings'
  | 'Vorab_Dimensionierung'
  | 'SGE_Auswertung'
  | 'Arbeitsmappe';

export type IssueSeverity = 'error' | 'warning';

export interface IntegrityIssue {
  id: string;
  severity: IssueSeverity;
  sheet: SheetNameV14;
  referenceId?: string;
  foreignKeyType?: 'RSE_ID' | 'Ursache_ID' | 'Schritt_ID' | 'Kombi_ID' | 'Schema';
  message: string;
  hint?: string;
}

export interface IntegrityReport {
  issues: IntegrityIssue[];
  errorCount: number;
  warningCount: number;
  checkedAt: string;
  sheetsDetected: number;
  stats: {
    laneCount: number;
    versionCount: number;
    milestoneCount: number;
    rseCount: number;
    eventCount: number;
    kombiCount: number;
    microIterationCount: number;
    placeholderCount: number;
    stepCount: number;
    causeCount: number;
    arrowCount: number;
    learningCount: number;
    preDimCount: number;
  };
}

export interface SgeDataset {
  sourceName: string;
  isBundledDefault: boolean;
  sheetNamesFound: string[];
  dashboard: SpurDashboardRow[];
  dashboardTotal: SpurDashboardRow | null;
  versions: PhaseVersionConfig[];
  lanes: string[];
  rseList: RseMaster[];
  events: RsePhaseEvent[];
  matrix: RseMatrixRow[];
  kombis: KombiIntegration[];
  microIterations: MicroIteration[];
  steps: DevelopmentStep[];
  causes: CauseFinding[];
  arrows: ConnectionArrow[];
  learnings: MethodikLearning[];
  preDimensioning: PreDimensioningRow[];
  sgeSummary: SgeSummaryRow[];
}

/** Locally persisted media attachment (stored in IndexedDB) */
export interface MediaAttachment {
  refKey: string;         // Normalized Medien_Ref (e.g. "media/RH_01.png", "rse:R1.1", "event:EV001")
  fileName: string;
  mimeType: string;
  dataUrl: string;
  caption: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface EventEditPatch {
  statusCode?: StatusCode;
  stateDescription?: string;
  rationale?: string;
  mediaRef?: string;
}

export interface MicroIterationEditPatch {
  change?: string;
  result?: string;
  evaluation?: string;
  mediaRef?: string;
}

export interface KombiEditPatch {
  partName?: string;
  rationale?: string;
  mediaRef?: string;
}

export interface ProjectEditsOverlay {
  events: Record<string, EventEditPatch>;
  microIterations: Record<string, MicroIterationEditPatch>;
  kombis: Record<string, KombiEditPatch>;
  updatedAt: string;
}
