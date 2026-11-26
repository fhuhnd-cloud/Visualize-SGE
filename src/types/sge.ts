/** Canonical SGE variation types ("Model of SGE", Albers et al.) */
export type SgeVariationKind = 'CV' | 'AV' | 'PV' | 'REM';

/** Detailed event status codes (AV replaces legacy GV everywhere) */
export type StatusCode =
  | 'BASE'
  | 'CV'
  | 'NEW'
  | 'EC-AV'
  | 'EC-PV'
  | 'UD-AV'
  | 'UD-PV'
  | 'REM';

export type StatusColorGroup = 'BASE' | 'CV' | 'NEW' | 'EC' | 'UD' | 'REM' | 'KOMBI';

export type ColorMode = 'variation' | 'planning' | 'lifecycle';

/** Toggle between canonical English (CV / AV / PV) and German (ÜV / AV / PV) labels */
export type NomenclatureLang = 'en' | 'de';

/** Global application mode: clean presentation vs full editing */
export type AppMode = 'presentation' | 'edit';

/** Progressive disclosure depth (1=Compact, 2=Standard, 3=Deep Dive) */
export type DetailLevel = 1 | 2 | 3;

export type WorkspaceView = 'swimlane2d' | 'board' | 'matrix' | 'media' | 'tables';

export interface PaletteSwatch {
  bg: string;
  border: string;
  text: string;
  dashed?: boolean;
}

export type CustomPalette = Record<StatusColorGroup, PaletteSwatch>;

/** Structured reference item for the detached reference bar & expandable table */
export interface RseReferenceLink {
  id: string;
  refRseId: string;           // e.g. "R2.6" or "EXTERN"
  refName: string;            // RSE Bezeichnung or external reference name
  originGeneration: string;   // e.g. "G_0", "G_1", "G_2", "Extern"
  variationType: SgeVariationKind; // CV | AV | PV | REM
  rationale: string;          // Anpassungs- / Übernahme-Begründung
}

/** 1. Überblick_Dashboard */
export interface SpurDashboardRow {
  spurId: string;
  name: string;
  role: string;
  totalRse: number;
  activeRseV22: number;
  removedOrReplaced: number;
  integratedRse: number;
  versionEventsCount: number;
  microIterationsCount: number;
  eventsChecked: string;
  maturitySummary: string;
  rowIndex: number;
}

/** 2. Phasen_Konfiguration (extended with G_n & E_{n,m} SGE hierarchy) */
export interface PhaseVersionConfig {
  versionKey: string;           // Version_Key (v0.0 .. v2.2)
  sortOrder: number;            // Sortier_Nr (1 .. 7)
  generationId: string;         // Generation_ID (G_0, G_1, G_2, G_3)
  generationName: string;       // e.g. "Referenzsystem", "GSD-Abschluss", "Entenrennen", "Antrittsvorlesung / Aktuell"
  engineeringGenId: string;     // Engineering_Gen_ID (G_0, E_{1,1}, E_{2,1}, E_{3,1} ..)
  milestoneLabel: string;       // Meilenstein_Label (e.g. "ME G_1", "ME G_2", "ME G_3")
  phaseName: string;            // Phasen_Name (e.g., "v1.1 Entenrennen")
  milestoneBadge: string;       // Meilenstein_Badge (e.g., "M1: Entenrennen", "")
  isMilestone: boolean;         // true for ME G_n / M1 / M2 / M3
  systemStateSummary: string;   // Technischer Systemstand & Einordnung
  rowIndex: number;
}

/** 3. RSE_Stammdaten */
export interface RseMaster {
  rseId: string;
  spur: string;
  name: string;
  origin: string;
  firstVersion: string;
  firstVersionNr: number;
  removalVersion: string;
  removalVersionNr: number | null;
  currentLifecycle: string;
  predecessorOrReplacement: string;
  currentKombiIdRaw: string;
  currentKombiIds: string[];
  rseCountInPart: number;
  versionEventsCount: number;
  microIterationsCount: number;
  reviewStatus: string;
  functionSummary: string;
  rowIndex: number;
}

/** 4. RSE_Phasenwechsel */
export interface RsePhaseEvent {
  eventId: string;
  rseId: string;
  spur: string;
  version: string;
  versionNr: number;
  lookupKey: string;
  statusCode: StatusCode;         // BASE | CV | NEW | EC-AV | EC-PV | UD-AV | UD-PV | REM
  sgeVariation: SgeVariationKind; // Canonical CV | AV | PV | REM
  isPlanned: boolean;             // true for EC-*, false for UD-*
  planningCategoryFig2: string;
  variationType: string;
  kombiPartIdRaw: string;
  kombiPartIds: string[];
  stateDescription: string;
  rationale: string;
  causeIdRaw: string;
  causeIds: string[];
  stepIdRaw: string;
  stepIds: string[];
  reviewStatus: string;
  mediaRef: string;
  /** Structured references used in this development step (for reference bar & expandable table) */
  references: RseReferenceLink[];
  rowIndex: number;
}

/** 5. RSE_Phasenmatrix */
export interface RseMatrixRow {
  rseId: string;
  spur: string;
  name: string;
  kombiIdRaw: string;
  kombiIds: string[];
  statusByVersionKey: Record<string, StatusCode | ''>;
  rowIndex: number;
}

/** 6. Bauteil_Integrationen */
export interface KombiIntegration {
  kombiId: string;
  partName: string;
  integratedFromPhase: string;
  rseCountInPart: number;
  involvedRseRaw: string;
  involvedRseIds: string[];
  involvedLanes: string;
  variationType: string;
  rationale: string;
  mediaRef: string;
  rowIndex: number;
}

/** 7. Mikro_Iterationen */
export interface MicroIteration {
  id: string;
  detailBox: string;
  rseId: string;
  spur: string;
  version: string;
  versionNr: number | null;
  parentStepId: string;
  subVersionId: string;
  variationType?: SgeVariationKind; // Optional granular CV/AV/PV/REM at micro-iteration level
  change: string;
  result: string;
  evaluation: string;
  mediaRef: string;
  isPlaceholder: boolean;
  rowIndex: number;
}

/** 8. Entwicklungsschritte */
export interface DevelopmentStep {
  id: string;
  spur: string;
  rseIds: string[];
  rseIdRaw: string;
  version: string;
  versionNr: number | null;
  stepType: string;
  title: string;
  implementation: string;
  stand: string;
  detailBox: string;
  learnings: string[];
  rowIndex: number;
}

/** 9. Ursachen_Tests_Befunde */
export interface CauseFinding {
  id: string;
  category: string;
  laneRef: string;
  affectedStepId: string;
  triggeredStepId: string;
  title: string;
  observation: string;
  hypothesis: string;
  learnings: string[];
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
  id: string;
  from: string;
  to: string;
  fromRseId?: string;
  fromVersionKey?: string;
  toRseId?: string;
  toVersionKey?: string;
  arrowType: string;
  category: EdgeCategory;
  causeIdRaw: string;
  causeIds: string[];
  laneRef: string;
  rationale: string;
  layoutDirection: string;
  rowIndex: number;
}

/** 11. Methodik_Learnings */
export interface MethodikLearning {
  id: string;
  topic: string;
  title: string;
  principle: string;
  projectExample: string;
  linkedStepIds: string[];
  linkedCauseIds: string[];
  scientificContext: string;
  rowIndex: number;
}

/** 12. Vorab_Dimensionierung */
export interface PreDimensioningRow {
  id: string;
  subDomain: string;
  parameter: string;
  value: string;
  unit: string;
  formulaOrSource: string;
  evidenceType: string;
  methodicalNotes: string;
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
  | 'RSE_Referenzen'
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
  refKey: string;
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
