export type PhaseType = 'Arbeitsphase' | 'Meilenstein';

export interface PhaseConfig {
  phaseKey: string;
  sortOrder: number;
  name: string;
  phaseType: PhaseType;
  rawPhaseType: string;
  rowIndex: number;
}

export type StandCategory = 'final' | 'superseded' | 'milestone' | 'other';

export type EdgeCategory =
  | 'optimization'   // Weiterentwicklung (Optimierung) -> Durchgezogen Blau
  | 'bugfix'         // Problembehebung (Fehler-Reaktion) -> Durchgezogen Rot
  | 'paradigmShift'  // Konzeptwechsel (Paradigmenbruch) -> Dick Violett
  | 'transfer'       // Konzept-Transfer (Bewährte Lösung übernehmen) -> Gestrichelt Grün
  | 'crossLane'      // Spurübergreifende Wirkbeziehung -> Gepunktet Türkis/Amber
  | 'milestoneTest'; // Meilenstein-Erprobung (Praxistest) -> Gestrichelt Grau

export interface DevelopmentStep {
  id: string;                 // Schritt_ID
  spur: string;               // Spur
  phase: string;              // Phase (matches Phase_Key)
  phaseNr: string;            // Phase_Nr
  stepType: string;           // Schritt_Typ
  title: string;              // Kurz_Titel
  implementation: string;     // Konstruktive / Logische Ausführung (Was wurde gebaut/geändert?)
  stand: string;              // Automatischer_Stand
  standCategory: StandCategory;
  detailBox: string;          // Detail_Box
  learnings: string[];        // Learnings (kommagetrennt, z. B. ["M03", "M04", "M12"])
  rowIndex: number;
}

export interface CauseFinding {
  id: string;                 // Ursache_ID
  category: string;           // Kategorie
  laneRef: string;            // Spur_Bezug
  affectedStepId: string;     // Betroffener_Schritt
  triggeredStepId: string;    // Ausgeloester_Schritt
  title: string;              // Kurz_Titel (Befund / Test / Problem)
  observation: string;        // Dokumentierte Beobachtung / Fakt
  hypothesis: string;         // Hypothese / Grenze der Nachweiskraft
  learnings: string[];        // Learnings (kommagetrennt, z. B. ["M03", "M12"])
  rowIndex: number;
}

export interface ConnectionArrow {
  id: string;                 // Pfeil_ID
  from: string;               // Von_Schritt_ID
  to: string;                 // Nach_Schritt_ID
  arrowType: string;          // Pfeil_Typ (Visuelle Darstellung)
  category: EdgeCategory;
  causeIdRaw: string;         // Begruendung_Ursache_ID (original cell value)
  causeIds: string[];         // Parsed Ursache_ID list (supports single or comma/semicolon-separated)
  laneRef: string;            // Spur_Bezug
  rationale: string;          // Begründung des Entwicklungsschritts (Anzeige am Pfeil)
  rowIndex: number;
}

export interface MicroIteration {
  detailBox: string;          // Detail_Box
  parentStepId: string;       // Gehört_zu_Schritt
  spur: string;               // Spur
  stepNumber: string;         // Schritt_Nr
  change: string;             // Konstruktive / Fertigungstechnische Änderung
  result: string;             // Beobachtetes Ergebnis
  evaluation: string;         // Bewertung
  rowIndex: number;
}

export interface MethodikLearning {
  id: string;                  // Learning_ID (z. B. M01)
  topic: string;               // Themenfeld
  title: string;               // Kurz_Titel_Learning
  principle: string;           // Übertragbares Prinzip (losgelöst vom Duckomat)
  projectExample: string;      // Konkretes Projektbeispiel (Anker in Datenbank)
  linkedStepIds: string[];     // Verknuepfte_Schritte
  linkedCauseIds: string[];    // Verknuepfte_Ursachen
  scientificContext: string;   // Wissenschaftliche Einordnung (DRM / Paper-Mehrwert)
  rowIndex: number;
}

export type SheetNameV2 =
  | 'Phasen_Konfiguration'
  | 'Entwicklungsschritte'
  | 'Ursachen_Tests_Befunde'
  | 'Verbindungen_Pfeile'
  | 'Mikro_Iterationen'
  | 'Methodik_Learnings'
  | 'Arbeitsmappe';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  sheet: SheetNameV2;
  referenceId?: string;
  message: string;
  hint?: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  checkedAt: string;
  stats: {
    phaseCount: number;
    milestoneCount: number;
    stepCount: number;
    finalStepCount: number;
    causeCount: number;
    arrowCount: number;
    microIterationCount: number;
    learningCount: number;
    laneCount: number;
  };
}

export interface DuckomatDataset {
  sourceName: string;
  isSample: boolean;
  phases: PhaseConfig[];
  lanes: string[];
  steps: DevelopmentStep[];
  causes: CauseFinding[];
  arrows: ConnectionArrow[];
  microIterations: MicroIteration[];
  learnings: MethodikLearning[];
}

export type StepperMode = 'phase' | 'step';

export interface FilterState {
  search: string;
  selectedLanes: string[];            // empty means all lanes
  selectedArrowTypes: EdgeCategory[]; // empty means all arrow types
  hideSuperseded: boolean;            // Vorgängerstände ausblenden
  finalOverviewMode: boolean;         // Gesamtübersicht Finaler Stand einblenden
}
