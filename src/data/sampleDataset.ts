import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  DuckomatDataset,
  MethodikLearning,
  MicroIteration,
  PhaseConfig,
} from '../types/duckomat';
import {
  classifyArrowType,
  classifyPhaseType,
  classifyStand,
  parseCauseIdList,
  parseIdList,
  sortLanesV2,
} from '../utils/excelParser';

const RAW_PHASES: Array<{
  phaseKey: string;
  sortOrder: number;
  name: string;
  phaseType: 'Arbeitsphase' | 'Meilenstein';
}> = [
  { phaseKey: 'P01_Ausgangslage', sortOrder: 1, name: 'Ausgangslage & Zielbild', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P02_Konzept_Entwurf', sortOrder: 2, name: 'Baugruppen-Konzept', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P03_Prototyp_V1', sortOrder: 3, name: 'Prototyp V1 Aufbau', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P04_Mechanik_Umbau', sortOrder: 4, name: 'Mechanik-Konzeptwechsel', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P05_Meilenstein_M1', sortOrder: 5, name: 'M1: Erster Nasslauf-Prüfpunkt', phaseType: 'Meilenstein' },
  { phaseKey: 'P06_Optik_Auswurf', sortOrder: 6, name: 'Optik & Auswurf-Iteration', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P07_Meilenstein_M2', sortOrder: 7, name: 'M2: Integrations-Dauerlauf', phaseType: 'Meilenstein' },
  { phaseKey: 'P08_Transfer_Dichtung', sortOrder: 8, name: 'Konzept-Transfer & IP65', phaseType: 'Arbeitsphase' },
  { phaseKey: 'P09_Meilenstein_M3', sortOrder: 9, name: 'M3: System-Abnahmetest', phaseType: 'Meilenstein' },
  { phaseKey: 'P10_Finaler_Stand', sortOrder: 10, name: 'Finaler Anlagenstand', phaseType: 'Arbeitsphase' },
];

const RAW_STEPS: Array<{
  id: string;
  spur: string;
  phase: string;
  phaseNr: string;
  stepType: string;
  title: string;
  implementation: string;
  stand: string;
  detailBox: string;
  learnings: string;
}> = [
  {
    id: 'E01',
    spur: 'S0_Gesamtsystem',
    phase: 'P01_Ausgangslage',
    phaseNr: '1',
    stepType: 'Systemanforderung',
    title: 'Anlagenarchitektur: 2-Band-Förderung mit Erkennung & Auswurf',
    implementation:
      'Festlegung der modularen Linienstruktur: Zuführband vorne (S1), Inspektionsband hinten (S2), Kamerabrücke (S3), Weiche (S4), Dichtung (S5) und Steuerung (S6).',
    stand: 'Überarbeitet / Abgelöst',
    detailBox: '',
    learnings: 'M01',
  },
  {
    id: 'E04',
    spur: 'S1_Band_vorne',
    phase: 'P02_Konzept_Entwurf',
    phaseNr: '2',
    stepType: 'Erstkonstruktion',
    title: 'Glattes PVC-Flachband mit festem Leitblech',
    implementation:
      'Einfaches Reibband (PVC, 120 mm Breite) über zwei gedruckte Umlenkrollen mit statischer Seitenführung.',
    stand: 'Überarbeitet / Abgelöst',
    detailBox: '',
    learnings: 'M01, M03',
  },
  {
    id: 'E08',
    spur: 'S2_Band_hinten',
    phase: 'P03_Prototyp_V1',
    phaseNr: '3',
    stepType: 'Erstkonstruktion',
    title: 'Gummiertes Flachband V1 für Kamera- & Auswurfstrecke',
    implementation:
      'Reibschlüssiges Gummiband mit höherem Trocken-Reibwert für konstante Fördergeschwindigkeit unter der Kamera.',
    stand: 'Überarbeitet / Abgelöst',
    detailBox: '',
    learnings: 'M03',
  },
  {
    id: 'E12',
    spur: 'S3_Erkennung',
    phase: 'P03_Prototyp_V1',
    phaseNr: '3',
    stepType: 'Erstkonstruktion',
    title: 'Offenes LED-Auflicht mit Standard-RGB-Kamera',
    implementation:
      'Direkte weiße LED-Leiste oberhalb der Übergabe ohne Polarisation oder Fremdlicht-Abschirmung.',
    stand: 'Überarbeitet / Abgelöst',
    detailBox: '',
    learnings: 'M04',
  },
  {
    id: 'E18',
    spur: 'S2_Band_hinten',
    phase: 'P04_Mechanik_Umbau',
    phaseNr: '4',
    stepType: 'Konzeptwechsel',
    title: 'Formschlüssige Modul-Kette v2 mit Drainage-Stegen',
    implementation:
      'Ablösung des Reibbands durch eine formschlüssige Gliederkette v2 mit 85 mm Taschen-Teilung, Ablaufnuten und V-Zentrierung.',
    stand: 'Aktueller Stand (Final)',
    detailBox: 'DB-Kette-v2',
    learnings: 'M03, M06',
  },
  {
    id: 'E25',
    spur: 'S0_Gesamtsystem',
    phase: 'P05_Meilenstein_M1',
    phaseNr: '5',
    stepType: 'Meilenstein',
    title: 'Meilenstein M1: Nasslauf-Prüfpunkt (n = 40 Enten)',
    implementation:
      'Erster durchgängiger Förder- und Erkennungstest mit nassen Badeenten bei 0,28 m/s zur Verifikation der Kette v2.',
    stand: 'Meilenstein (Prüfpunkt)',
    detailBox: '',
    learnings: 'M02, M03',
  },
  {
    id: 'E27',
    spur: 'S3_Erkennung',
    phase: 'P06_Optik_Auswurf',
    phaseNr: '6',
    stepType: 'Optimierung',
    title: 'Diffuses Ringlicht mit Polfilter, Lichttunnel & Lichtschranke',
    implementation:
      'Mattschwarzer Lichttunnel mit zirkularem Polfilter-Paar und optischer Gabellichtschranke zur exakten Triggerung pro Kettentasche.',
    stand: 'Aktueller Stand (Final)',
    detailBox: '',
    learnings: 'M04',
  },
  {
    id: 'E28',
    spur: 'S4_Auswurf',
    phase: 'P06_Optik_Auswurf',
    phaseNr: '6',
    stepType: 'Erstkonstruktion',
    title: 'Starre 90°-Servo-Klappe mit Zeitversatz-Trigger',
    implementation:
      'Direkt angetriebener Servo mit gerader PLA-Klappe, ausgelöst über fixe Verzögerung nach dem neuen Lichtschranken-Trigger aus E27.',
    stand: 'Überarbeitet / Abgelöst',
    detailBox: '',
    learnings: 'M04, M05',
  },
  {
    id: 'E33',
    spur: 'S0_Gesamtsystem',
    phase: 'P07_Meilenstein_M2',
    phaseNr: '7',
    stepType: 'Meilenstein',
    title: 'Meilenstein M2: 30-min-Integrations-Dauerlauf',
    implementation:
      'Kombinierte Nasslauf-Erprobung von Kette v2 (hinten), Polfilter-Optik (E27) und Servo-Weiche (E28) über 30 Minuten.',
    stand: 'Meilenstein (Prüfpunkt)',
    detailBox: '',
    learnings: 'M02, M05',
  },
  {
    id: 'E35',
    spur: 'S1_Band_vorne',
    phase: 'P08_Transfer_Dichtung',
    phaseNr: '8',
    stepType: 'Konzept-Transfer',
    title: 'Übernahme Modul-Kette v2 auf Band vorne (Zuführung)',
    implementation:
      'Konstruktive Übernahme der bewährten Kette v2 von Band 2 auf Band 1 mit angepasster Einlaufschräge für reproduzierbare Vereinzelung.',
    stand: 'Aktueller Stand (Final)',
    detailBox: '',
    learnings: 'M06',
  },
  {
    id: 'E36',
    spur: 'S4_Auswurf',
    phase: 'P08_Transfer_Dichtung',
    phaseNr: '8',
    stepType: 'Optimierung',
    title: 'Gebogene 35°-Leitweiche mit Zellkautschuk-Lippe',
    implementation:
      'Sanfte gekrümmte Ablenkgeometrie (35°) mit gedämpfter Elastomer-Lippe verhindert Zurückprallen leichter Enten.',
    stand: 'Aktueller Stand (Final)',
    detailBox: 'DB-Auswurf',
    learnings: 'M05',
  },
  {
    id: 'E37',
    spur: 'S5_Wasserfestigkeit',
    phase: 'P08_Transfer_Dichtung',
    phaseNr: '8',
    stepType: 'Problembehebung',
    title: 'Labyrinth-Flanschdichtung, Tropfblech & Polymerlager (IP65)',
    implementation:
      'Kapselung des Weichen-Servos mit Abtropfkragen, Labyrinthdichtung an der Antriebswelle und Umstellung auf korrosionsfreie Polymerlager.',
    stand: 'Aktueller Stand (Final)',
    detailBox: '',
    learnings: 'M02, M05',
  },
  {
    id: 'E41',
    spur: 'S0_Gesamtsystem',
    phase: 'P09_Meilenstein_M3',
    phaseNr: '9',
    stepType: 'Meilenstein',
    title: 'Meilenstein M3: Vorabnahme Gesamtanlage',
    implementation:
      'Systemprüfung aller abgedichteten Baugruppen unter Volllast zur Verifikation der Schnittstellen und Taktzeit.',
    stand: 'Meilenstein (Prüfpunkt)',
    detailBox: '',
    learnings: 'M02',
  },
  {
    id: 'E44',
    spur: 'S6_Software',
    phase: 'P10_Finaler_Stand',
    phaseNr: '10',
    stepType: 'Optimierung',
    title: 'Encoder-gekoppelte Tracking-Queue & Zustandsautomat',
    implementation:
      'Wegbasierte FIFO-Objektverfolgung über Inkrementalgeber statt starrer Zeitverzögerung; kompensiert Last- und Drehzahlschwankungen.',
    stand: 'Aktueller Stand (Final)',
    detailBox: '',
    learnings: 'M01, M05',
  },
  {
    id: 'E45',
    spur: 'S0_Gesamtsystem',
    phase: 'P10_Finaler_Stand',
    phaseNr: '10',
    stepType: 'Gesamtstand',
    title: 'Finaler Duckomat-Gesamtstand (98 % Sortierquote)',
    implementation:
      'Integrierter Gesamtstand mit doppelter Modul-Kette v2, Polfilter-Erkennung, gedämpfter Weiche, IP65-Aktorik und Encoder-Tracking.',
    stand: 'Aktueller Stand (Final)',
    detailBox: '',
    learnings: 'M01, M06',
  },
];

const RAW_CAUSES: Array<{
  id: string;
  category: string;
  laneRef: string;
  affectedStepId: string;
  triggeredStepId: string;
  title: string;
  observation: string;
  hypothesis: string;
  learnings: string;
}> = [
  {
    id: 'U01',
    category: 'Befund / Fehlerbild',
    laneRef: 'S2_Band_hinten',
    affectedStepId: 'E08',
    triggeredStepId: 'E18',
    title: 'Schlupf & Wasserfilm auf Reibband V1 im Nasslauf',
    observation:
      'Im Nasslauf rutschen 35 % der Enten auf dem glatten Reibband durch. Ab 6° Steigung stauen sich Enten an der Übergabe und drehen sich quer.',
    hypothesis:
      'Der reale Nass-Reibwert μ wurde nicht tribometrisch gemessen; vermutlich sinkt μ unter Wasserfilm unter 0,18, sodass Reibschluss prinzipiell ungeeignet ist.',
    learnings: 'M03',
  },
  {
    id: 'U02',
    category: 'Test / Analyse',
    laneRef: 'S3_Erkennung',
    affectedStepId: 'E12',
    triggeredStepId: 'E27',
    title: 'Glanzreflexionen & Fremdlicht verfälschen Farberkennung',
    observation:
      'Unter offenem LED-Auflicht erreicht die Klassifikation nur 68 % Trefferquote; nasse Oberflächen erzeugen weiße Sättigungsflecken im HSV-Raum.',
    hypothesis:
      'Restfehler von 2,5 % nach Polfilter-Umbau ist voraussichtlich durch extreme Entenfarben oder Restlicht im Einlauf bedingt.',
    learnings: 'M04',
  },
  {
    id: 'U03',
    category: 'Praxistest-Befund',
    laneRef: 'S1_Band_vorne',
    affectedStepId: 'E04',
    triggeredStepId: 'E35',
    title: 'Kette v2 löst Vereinzelung – Band 1 bleibt Engpass',
    observation:
      'Während Band 2 mit Kette v2 im Integrationstest M2 100 % lagestabil fördert, liefert das alte Flachband E04 weiterhin unregelmäßige Doppelbelegungen.',
    hypothesis:
      'Übertragbarkeit der Steg-Geometrie auf den steileren Einlaufwinkel von Band 1 unter Volllast (>25 Enten/min) im Langzeittest weiter absichern.',
    learnings: 'M03, M06',
  },
  {
    id: 'U04',
    category: 'Fehlerbild',
    laneRef: 'S4_Auswurf',
    affectedStepId: 'E28',
    triggeredStepId: 'E36',
    title: 'Abprallen leichter Enten & Timing-Drift an 90°-Klappe',
    observation:
      'Bei 0,32 m/s prallen leichte Enten (<28 g) von der starren 90°-PLA-Klappe zurück auf die Hauptspur (Fehl-Auswurf in 8 % der Zyklen).',
    hypothesis:
      'Masse-Varianz der Enten und Drehzahlschwankung überlagern sich; Trennung beider Effekte erst über Encoder-Telemetrie quantifizierbar.',
    learnings: 'M05',
  },
  {
    id: 'U05',
    category: 'Fehlerbild (Dauerlauf)',
    laneRef: 'S5_Wasserfestigkeit',
    affectedStepId: 'E33',
    triggeredStepId: 'E37',
    title: 'Spritzwassereintrag am Servo-Flansch & Korrosion an Lagern',
    observation:
      'Nach 30 min Nassbetrieb in M2 sammelt sich Tropfwasser aus den Drainage-Nuten auf dem tieferliegenden Servo-Flansch; Flugrost an Kugellagern sichtbar.',
    hypothesis:
      'IP65-Schutzwirkung der Labyrinthdichtung basiert auf 1-h-Spritzwassertest; Langzeit-Dichtigkeit >50 h steht noch aus.',
    learnings: 'M02, M05',
  },
  {
    id: 'U06',
    category: 'System-Validierung',
    laneRef: 'S6_Software',
    affectedStepId: 'E36',
    triggeredStepId: 'E44',
    title: 'Lastabhängige Bandgeschwindigkeit verschiebt Auswurf-Zeitfenster',
    observation:
      'Bei Vollbelegung sinkt die DC-Motordrehzahl um 9 %, wodurch zeitbasierte Auslöser bis zu 35 mm zu früh schalten.',
    hypothesis:
      'Auflösung des Inkrementalgebers (1,2 mm/Impuls) reicht rechnerisch aus; Schlupf zwischen Ritzel und Kette v2 wird als vernachlässigbar angenommen.',
    learnings: 'M01, M05',
  },
];

const RAW_ARROWS: Array<{
  id: string;
  from: string;
  to: string;
  arrowType: string;
  causeIdRaw: string;
  laneRef: string;
  rationale: string;
}> = [
  {
    id: 'P_01',
    from: 'E01',
    to: 'E04',
    arrowType: 'Weiterentwicklung (Optimierung)',
    causeIdRaw: '',
    laneRef: 'S1_Band_vorne',
    rationale: 'Erstaufbau Zuführstrecke als einfaches Flachband',
  },
  {
    id: 'P_02',
    from: 'E01',
    to: 'E08',
    arrowType: 'Weiterentwicklung (Optimierung)',
    causeIdRaw: '',
    laneRef: 'S2_Band_hinten',
    rationale: 'Erstaufbau Inspektionsstrecke als gummiertes Reibband',
  },
  {
    id: 'P_08',
    from: 'E08',
    to: 'E12',
    arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    causeIdRaw: 'U01',
    laneRef: 'S2_Band_hinten -> S3_Erkennung',
    rationale: 'Unruhige Lage auf Reibband V1 gelangt direkt ins Kamerafeld (phasenintern P03)',
  },
  {
    id: 'P_12',
    from: 'E08',
    to: 'E18',
    arrowType: 'Konzeptwechsel (Paradigmenbruch)',
    causeIdRaw: 'U01',
    laneRef: 'S2_Band_hinten',
    rationale: 'Paradigmenwechsel von Reibschluss auf formschlüssige Modul-Kette v2',
  },
  {
    id: 'P_15',
    from: 'E18',
    to: 'E25',
    arrowType: 'Meilenstein-Erprobung (Praxistest)',
    causeIdRaw: 'U01',
    laneRef: 'S0_Gesamtsystem',
    rationale: 'Prüfpunkt M1 bestätigt schlupffreie Nassförderung der Kette v2',
  },
  {
    id: 'P_18',
    from: 'E12',
    to: 'E27',
    arrowType: 'Problembehebung (Fehler-Reaktion)',
    causeIdRaw: 'U02',
    laneRef: 'S3_Erkennung',
    rationale: 'Polfilter & Lichttunnel eliminieren Wasserreflexionen',
  },
  {
    id: 'P_20',
    from: 'E18',
    to: 'E27',
    arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    causeIdRaw: 'U01, U02',
    laneRef: 'S2_Band_hinten -> S3_Erkennung',
    rationale: 'Feste 85-mm-Taschenteilung stabilisiert Objektlage für die Kamera',
  },
  {
    id: 'P_21',
    from: 'E27',
    to: 'E28',
    arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    causeIdRaw: 'U02',
    laneRef: 'S3_Erkennung -> S4_Auswurf',
    rationale: 'Lichtschranken-Trigger aus E27 steuert Auswurfklappe E28 (phasenintern P06)',
  },
  {
    id: 'P_24',
    from: 'E27',
    to: 'E33',
    arrowType: 'Meilenstein-Erprobung (Praxistest)',
    causeIdRaw: 'U05',
    laneRef: 'S0_Gesamtsystem',
    rationale: 'Dauerlauftest M2 prüft Optik im 30-min-Nassbetrieb',
  },
  {
    id: 'P_25',
    from: 'E28',
    to: 'E33',
    arrowType: 'Meilenstein-Erprobung (Praxistest)',
    causeIdRaw: 'U04, U05',
    laneRef: 'S0_Gesamtsystem',
    rationale: 'Dauerlauf M2 deckt Abprallen und Spritzwassereintrag am Servo auf',
  },
  {
    id: 'P_29',
    from: 'E18',
    to: 'E35',
    arrowType: 'Konzept-Transfer (Bewährte Lösung übernehmen)',
    causeIdRaw: 'U03',
    laneRef: 'S2_Band_hinten -> S1_Band_vorne',
    rationale: 'Übernahme der bewährten Kette v2 von Band 2 auf Band 1',
  },
  {
    id: 'P_30',
    from: 'E04',
    to: 'E35',
    arrowType: 'Konzeptwechsel (Paradigmenbruch)',
    causeIdRaw: 'U03',
    laneRef: 'S1_Band_vorne',
    rationale: 'Ablösung des rutschenden PVC-Flachbands durch Modul-Kette v2',
  },
  {
    id: 'P_31',
    from: 'E28',
    to: 'E36',
    arrowType: 'Problembehebung (Fehler-Reaktion)',
    causeIdRaw: 'U04',
    laneRef: 'S4_Auswurf',
    rationale: '35°-Leitgeometrie + Zellkautschuk verhindert Zurückprallen',
  },
  {
    id: 'P_32',
    from: 'E33',
    to: 'E37',
    arrowType: 'Problembehebung (Fehler-Reaktion)',
    causeIdRaw: 'U05',
    laneRef: 'S5_Wasserfestigkeit',
    rationale: 'Labyrinthdichtung & Polymerlager beheben Korrosionsrisiko',
  },
  {
    id: 'P_35',
    from: 'E36',
    to: 'E37',
    arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    causeIdRaw: 'U05',
    laneRef: 'S4_Auswurf -> S5_Wasserfestigkeit',
    rationale: 'Geänderte Klappengeometrie definiert neuen Flansch-Dichtraum (phasenintern P08)',
  },
  {
    id: 'P_37',
    from: 'E35',
    to: 'E41',
    arrowType: 'Meilenstein-Erprobung (Praxistest)',
    causeIdRaw: '',
    laneRef: 'S0_Gesamtsystem',
    rationale: 'Vorabnahme M3 verifiziert doppelte Modul-Kette unter Volllast',
  },
  {
    id: 'P_38',
    from: 'E37',
    to: 'E41',
    arrowType: 'Meilenstein-Erprobung (Praxistest)',
    causeIdRaw: 'U05',
    laneRef: 'S0_Gesamtsystem',
    rationale: 'Vorabnahme M3 bestätigt Spritzwasserschutz',
  },
  {
    id: 'P_40',
    from: 'E36',
    to: 'E44',
    arrowType: 'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
    causeIdRaw: 'U06',
    laneRef: 'S4_Auswurf -> S6_Software',
    rationale: 'Wegbasiertes Encoder-Tracking kompensiert Lastschwankungen der Weiche',
  },
  {
    id: 'P_41',
    from: 'E44',
    to: 'E45',
    arrowType: 'Weiterentwicklung (Optimierung)',
    causeIdRaw: 'U06',
    laneRef: 'S6_Software -> S0_Gesamtsystem',
    rationale: 'Finale Integration zur Gesamtanlage mit 98 % Sortierquote (phasenintern P10)',
  },
];

const RAW_MICRO: Array<Omit<MicroIteration, 'rowIndex'>> = [
  {
    detailBox: 'DB-Kette-v2',
    parentStepId: 'E18',
    spur: 'S2_Band_hinten',
    stepNumber: '1.1',
    change: 'Aufgeklebte 4-mm-Silikonstege auf Gummiband V1',
    result: 'Gute Anfangshaftung, aber Klebung löst sich nach 12 min im Nasslauf.',
    evaluation: 'Verworfen – nicht wasserfest',
  },
  {
    detailBox: 'DB-Kette-v2',
    parentStepId: 'E18',
    spur: 'S2_Band_hinten',
    stepNumber: '1.2',
    change: '3D-gedruckte Kettenglieder (PETG) mit 110 mm Teilung und TPU-Mitnehmern',
    result: 'Kein Schlupf mehr, aber kleine Enten liegen gelegentlich doppelt in einer Tasche.',
    evaluation: 'Anpassen – Teilung verkürzen',
  },
  {
    detailBox: 'DB-Kette-v2',
    parentStepId: 'E18',
    spur: 'S2_Band_hinten',
    stepNumber: '1.3',
    change: 'Teilung auf 85 mm reduziert + 3-mm-Drainage-Schlitze je Glied',
    result: '100 % Vereinzelung über 50 Testläufe, Restwasser läuft vor Kamera ab.',
    evaluation: 'Final übernommen',
  },
  {
    detailBox: 'DB-Auswurf',
    parentStepId: 'E36',
    spur: 'S4_Auswurf',
    stepNumber: '2.1',
    change: 'Gerade PLA-Klappe (60° Anstellwinkel, harte Kante)',
    result: 'Leichte Enten prallen bei 0,32 m/s zurück auf das Hauptband.',
    evaluation: 'Verworfen – zu harter Impuls',
  },
  {
    detailBox: 'DB-Auswurf',
    parentStepId: 'E36',
    spur: 'S4_Auswurf',
    stepNumber: '2.2',
    change: 'Gekrümmte 35°-Leitkontur mit 3 mm Zellkautschuk-Auflage',
    result: 'Sanfte, reproduzierbare Umlenkung ohne Rückprall bei allen Entengrößen.',
    evaluation: 'Final übernommen',
  },
];

const RAW_LEARNINGS: Array<{
  id: string;
  topic: string;
  title: string;
  principle: string;
  projectExample: string;
  linkedSteps: string;
  linkedCauses: string;
  scientificContext: string;
}> = [
  {
    id: 'M01',
    topic: 'Systemarchitektur & Kopplung',
    title: 'Zeit- vs. Weg-Synchronisation bei Lastschwankung',
    principle:
      'In mechatronischen Förderstrecken dürfen zeitkritische Folgeaktionen nicht über offene Zeitverzögerungen gesteuert werden, sobald Reibung oder Last die Antriebsdrehzahl beeinflussen.',
    projectExample: 'Übergang von Zeitversatz-Weiche (E28) zu Encoder-Tracking-Queue (E44).',
    linkedSteps: 'E01, E04, E44, E45',
    linkedCauses: 'U06',
    scientificContext:
      'DRM Prescriptive Study: Nachweis, wie frühe Architekturannahmen späte Software-Kompensation erzwingen.',
  },
  {
    id: 'M02',
    topic: 'Erprobung & Umwelteinfluss',
    title: 'Frühe Realmedium-Tests statt Trockenläufe',
    principle:
      'Sekundäre Betriebsmedien (Wasser, Schmierstoff, Staub) verändern Tribologie, Optik und Korrosion fundamental und müssen vor dem Einfrieren von Baugruppen im Dauerlauf geprüft werden.',
    projectExample: 'Nasslauf M1 (E25) und 30-min-Dauerlauf M2 (E33) decken Schlupf und Spritzwasserkorrosion (E37) auf.',
    linkedSteps: 'E25, E33, E37, E41',
    linkedCauses: 'U05',
    scientificContext:
      'DRM Descriptive Study I: Empirischer Beleg für späte Fehlerentdeckung bei verspäteten Realmedium-Prüfpunkten.',
  },
  {
    id: 'M03',
    topic: 'Mechanische Wirkprinzipien',
    title: 'Formschluss vor Reibschluss unter Nassbedingungen',
    principle:
      'Bei variablen oder geschmierten Reibpartnern liefert Formschluss (Taschen, Mitnehmer) deterministische Objektpositionierung und entlastet nachgelagerte Sensorik.',
    projectExample: 'Paradigmenwechsel von Reibband (E08) auf Modul-Kette v2 (E18).',
    linkedSteps: 'E04, E08, E18, E25',
    linkedCauses: 'U01, U03',
    scientificContext:
      'VDI 2221 / Pahl-Beitz Wirkprinzip-Wechsel als dokumentierte Kausalkette statt lokaler Parameteroptimierung.',
  },
  {
    id: 'M04',
    topic: 'Optik & Schnittstellen',
    title: 'Mechanische Lagekontrolle als Enabler für Bildverarbeitung',
    principle:
      'Robuste optische Erkennung entsteht kostengünstiger durch definierte mechanische Zuführung plus kontrollierte Beleuchtung als durch komplexe Software-Nachbearbeitung.',
    projectExample: 'Zusammenspiel aus Kette v2 (E18) und Polfilter-Lichttunnel (E27) hebt Quote von 68 % auf 97,5 %.',
    linkedSteps: 'E12, E27, E28',
    linkedCauses: 'U02',
    scientificContext:
      'Domänenübergreifende Mechatronik-Synthese: Mechanik-Optik-Ko-Design reduziert Komplexität im Gesamtsystem.',
  },
  {
    id: 'M05',
    topic: 'Aktorik & Dauerbetrieb',
    title: 'Impulsdämpfung & Medienschutz gemeinsam auslegen',
    principle:
      'Aktorische Eingriffe an leichten Fördergütern erfordern sanfte Leitgeometrien sowie eine räumliche Trennung von Medienabfluss und Lagerung/Elektronik.',
    projectExample: 'Umbau von 90°-Klappe (E28) auf 35°-Zellkautschuk-Weiche (E36) und IP65-Flansch (E37).',
    linkedSteps: 'E28, E33, E36, E37, E44',
    linkedCauses: 'U04, U05, U06',
    scientificContext:
      'DRM Descriptive Study II: Traceability zwischen Dauerlauf-Befund und parallelen konstruktiven Maßnahmen.',
  },
  {
    id: 'M06',
    topic: 'Wiederverwendung & Standardisierung',
    title: 'Bewährte Teillösungen gezielt auf Nachbarspuren transferieren',
    principle:
      'Nach erfolgreicher Validierung eines geänderten Wirkprinzips in einer kritischen Spur lohnt die Prüfung auf baugleichen Transfer zur Reduktion von Varianten und Fehlerquellen.',
    projectExample: 'Konzept-Transfer der Modul-Kette v2 von Band hinten (E18) auf Band vorne (E35).',
    linkedSteps: 'E18, E35, E45',
    linkedCauses: 'U03',
    scientificContext:
      'Plattform- und Baukastenmethodik: Empirisch begründeter Modul-Transfer senkt Entwicklungsrisiko.',
  },
];

export function createSampleDataset(): DuckomatDataset {
  const phases: PhaseConfig[] = RAW_PHASES.map((p, idx) => ({
    phaseKey: p.phaseKey,
    sortOrder: p.sortOrder,
    name: p.name,
    phaseType: classifyPhaseType(p.phaseType),
    rawPhaseType: p.phaseType,
    rowIndex: idx + 2,
  })).sort((a, b) => a.sortOrder - b.sortOrder);

  const phaseTypeByKey = new Map(phases.map((p) => [p.phaseKey, p.phaseType]));

  const steps: DevelopmentStep[] = RAW_STEPS.map((s, idx) => ({
    id: s.id,
    spur: s.spur,
    phase: s.phase,
    phaseNr: s.phaseNr,
    stepType: s.stepType,
    title: s.title,
    implementation: s.implementation,
    stand: s.stand,
    standCategory: classifyStand(s.stand, s.stepType, phaseTypeByKey.get(s.phase) === 'Meilenstein'),
    detailBox: s.detailBox,
    learnings: parseIdList(s.learnings),
    rowIndex: idx + 2,
  }));

  const causes: CauseFinding[] = RAW_CAUSES.map((c, idx) => ({
    id: c.id,
    category: c.category,
    laneRef: c.laneRef,
    affectedStepId: c.affectedStepId,
    triggeredStepId: c.triggeredStepId,
    title: c.title,
    observation: c.observation,
    hypothesis: c.hypothesis,
    learnings: parseIdList(c.learnings),
    rowIndex: idx + 2,
  }));

  const arrows: ConnectionArrow[] = RAW_ARROWS.map((a, idx) => ({
    ...a,
    category: classifyArrowType(a.arrowType),
    causeIds: parseCauseIdList(a.causeIdRaw),
    rowIndex: idx + 2,
  }));

  const microIterations: MicroIteration[] = RAW_MICRO.map((m, idx) => ({
    ...m,
    rowIndex: idx + 2,
  }));

  const learnings: MethodikLearning[] = RAW_LEARNINGS.map((l, idx) => ({
    id: l.id,
    topic: l.topic,
    title: l.title,
    principle: l.principle,
    projectExample: l.projectExample,
    linkedStepIds: parseIdList(l.linkedSteps),
    linkedCauseIds: parseIdList(l.linkedCauses),
    scientificContext: l.scientificContext,
    rowIndex: idx + 2,
  }));

  const lanes = sortLanesV2(steps.map((s) => s.spur));

  return {
    sourceName: 'Beispieldatensatz (Duckomat v5 · 7 Spuren × 10 Phasen + Learnings)',
    isSample: true,
    phases,
    lanes,
    steps,
    causes,
    arrows,
    microIterations,
    learnings,
  };
}
