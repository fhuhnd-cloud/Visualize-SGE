import {
  CauseFinding,
  KombiIntegration,
  MethodikLearning,
  MicroIteration,
  PhaseVersionConfig,
  ProjectEditsOverlay,
  RseMaster,
  RsePhaseEvent,
  RseReferenceLink,
  SgeDataset,
  SgeVariationKind,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import { isPlaceholderMicroIteration } from './excelParser';
import {
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
  isPlannedStatusCode,
  statusCodeToColorGroup,
  statusCodeToVariationKind,
} from './sgeVisualConfig';

export type RsePresenceInVersion = 'active' | 'removed_here' | 'removed_earlier' | 'future';

export interface RseStateAtVersion {
  rse: RseMaster;
  presence: RsePresenceInVersion;
  statusCode: StatusCode | '';
  eventAtVersion: RsePhaseEvent | null;
  latestEventUpToVersion: RsePhaseEvent | null;
  kombiIdsAtVersion: string[];
  removedInVersionLabel: string | null;
}

export interface VersionKpiSnapshot {
  version: PhaseVersionConfig;
  activeCount: number;
  removedHereCount: number;
  removedTotalCount: number;
  futureCount: number;
  countsByGroup: Record<StatusColorGroup, number>;
  countsByCode: Record<StatusCode, number>;
  /** Canonical SGE variation counts (Model of SGE): CV, AV, PV, REM */
  countsByVariation: Record<SgeVariationKind, number>;
  plannedChanges: number;       // EC-AV + EC-PV
  unplannedDeviations: number;  // UD-AV + UD-PV
  unplannedRatio: number;       // UD / (EC + UD + NEW + REM)
  carryoverRatio: number;       // CV / activeCount
}

/** Group of Engineering Generations E_{n,m} belonging to one System Generation G_n */
export interface GenerationGroup {
  generationId: string;         // G_0, G_1, G_2, G_3
  generationName: string;
  milestoneLabel: string;
  versions: PhaseVersionConfig[];
}

export function groupVersionsByGeneration(versions: PhaseVersionConfig[]): GenerationGroup[] {
  const groups: GenerationGroup[] = [];
  const byId = new Map<string, GenerationGroup>();

  for (const ver of versions) {
    let grp = byId.get(ver.generationId);
    if (!grp) {
      grp = {
        generationId: ver.generationId,
        generationName: ver.generationName,
        milestoneLabel: ver.milestoneLabel,
        versions: [],
      };
      byId.set(ver.generationId, grp);
      groups.push(grp);
    }
    grp.versions.push(ver);
    if (ver.milestoneLabel && /^ME\s*G/i.test(ver.milestoneLabel)) {
      grp.milestoneLabel = ver.milestoneLabel;
    }
  }
  return groups;
}

/** Summarizes reference counts (CV, AV, PV, REM) for the detached reference bar under a card */
export function countReferencesByVariation(references: RseReferenceLink[]): {
  CV: number;
  AV: number;
  PV: number;
  REM: number;
  total: number;
} {
  let CV = 0;
  let AV = 0;
  let PV = 0;
  let REM = 0;
  for (const r of references) {
    if (r.variationType === 'CV') CV++;
    else if (r.variationType === 'AV') AV++;
    else if (r.variationType === 'REM') REM++;
    else PV++;
  }
  return { CV, AV, PV, REM, total: references.length };
}

export function applyEditsToDataset(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay
): SgeDataset {
  const hasEventEdits = Object.keys(edits.events).length > 0;
  const hasMicroEdits = Object.keys(edits.microIterations).length > 0;
  const hasKombiEdits = Object.keys(edits.kombis).length > 0;
  if (!hasEventEdits && !hasMicroEdits && !hasKombiEdits) return dataset;

  const events = dataset.events.map((ev) => {
    const patch = edits.events[ev.eventId];
    if (!patch) return ev;
    const statusCode = patch.statusCode ?? ev.statusCode;
    return {
      ...ev,
      statusCode,
      sgeVariation: statusCodeToVariationKind(statusCode),
      isPlanned: isPlannedStatusCode(statusCode),
      planningCategoryFig2: derivePlanningCategoryFromStatus(statusCode),
      variationType: deriveVariationTypeFromStatus(statusCode, 'en'),
      stateDescription: patch.stateDescription ?? ev.stateDescription,
      rationale: patch.rationale ?? ev.rationale,
      mediaRef: patch.mediaRef ?? ev.mediaRef,
    };
  });

  const microIterations = dataset.microIterations.map((m) => {
    const patch = edits.microIterations[m.id];
    if (!patch) return m;
    const change = patch.change ?? m.change;
    const evaluation = patch.evaluation ?? m.evaluation;
    const isPlaceholder =
      (m.detailBox.toUpperCase().startsWith('BOX PH_') &&
        change.trim().startsWith('[Platzhalter')) ||
      evaluation.toLowerCase().includes('platzhalter');
    return {
      ...m,
      change,
      result: patch.result ?? m.result,
      evaluation,
      mediaRef: patch.mediaRef ?? m.mediaRef,
      isPlaceholder,
    };
  });

  const kombis = dataset.kombis.map((k) => {
    const patch = edits.kombis[k.kombiId];
    if (!patch) return k;
    return {
      ...k,
      partName: patch.partName ?? k.partName,
      rationale: patch.rationale ?? k.rationale,
      mediaRef: patch.mediaRef ?? k.mediaRef,
    };
  });

  return { ...dataset, events, microIterations, kombis };
}

export function computeRseStatesAtVersion(
  dataset: SgeDataset,
  version: PhaseVersionConfig
): Map<string, RseStateAtVersion> {
  const matrixByRse = new Map(dataset.matrix.map((m) => [m.rseId, m]));
  const eventsByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of dataset.events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }
  for (const list of eventsByRse.values()) {
    list.sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex);
  }

  const versionBySort = new Map(dataset.versions.map((v) => [v.sortOrder, v]));
  const map = new Map<string, RseStateAtVersion>();

  for (const rse of dataset.rseList) {
    const matRow = matrixByRse.get(rse.rseId);
    const rseEvents = eventsByRse.get(rse.rseId) ?? [];
    const eventAtVersion = rseEvents.find((e) => e.versionNr === version.sortOrder) ?? null;

    let latestEventUpToVersion: RsePhaseEvent | null = null;
    for (const ev of rseEvents) {
      if (ev.versionNr <= version.sortOrder) latestEventUpToVersion = ev;
    }

    let statusCode: StatusCode | '' = matRow?.statusByVersionKey[version.versionKey] ?? '';
    if (!statusCode && eventAtVersion) statusCode = eventAtVersion.statusCode;

    let presence: RsePresenceInVersion = 'future';
    let removedInVersionLabel: string | null = null;

    if (statusCode === 'REM') {
      presence = 'removed_here';
      removedInVersionLabel = version.versionKey;
    } else if (statusCode) {
      presence = 'active';
    } else if (latestEventUpToVersion && latestEventUpToVersion.statusCode === 'REM') {
      presence = 'removed_earlier';
      const remVer = versionBySort.get(latestEventUpToVersion.versionNr);
      removedInVersionLabel = remVer ? remVer.versionKey : latestEventUpToVersion.version;
    } else {
      presence = 'future';
    }

    let kombiIdsAtVersion: string[] = [];
    if (presence === 'active') {
      if (eventAtVersion && eventAtVersion.kombiPartIds.length > 0) {
        kombiIdsAtVersion = eventAtVersion.kombiPartIds;
      } else if (latestEventUpToVersion && latestEventUpToVersion.kombiPartIds.length > 0) {
        kombiIdsAtVersion = latestEventUpToVersion.kombiPartIds;
      } else if (rse.currentKombiIds.length > 0) {
        const alreadyIntegrated = rseEvents.some(
          (ev) =>
            ev.versionNr <= version.sortOrder &&
            ev.kombiPartIds.some((kId) => rse.currentKombiIds.includes(kId))
        );
        if (alreadyIntegrated) kombiIdsAtVersion = rse.currentKombiIds;
      }
    } else if (presence === 'removed_here' && eventAtVersion) {
      kombiIdsAtVersion = eventAtVersion.kombiPartIds;
    }

    map.set(rse.rseId, {
      rse,
      presence,
      statusCode,
      eventAtVersion,
      latestEventUpToVersion,
      kombiIdsAtVersion,
      removedInVersionLabel,
    });
  }

  return map;
}

export function computeVersionKpis(
  dataset: SgeDataset,
  version: PhaseVersionConfig,
  states?: Map<string, RseStateAtVersion>
): VersionKpiSnapshot {
  const resolvedStates = states ?? computeRseStatesAtVersion(dataset, version);
  const countsByCode: Record<StatusCode, number> = {
    BASE: 0,
    CV: 0,
    NEW: 0,
    'EC-AV': 0,
    'EC-PV': 0,
    'UD-AV': 0,
    'UD-PV': 0,
    REM: 0,
  };
  const countsByGroup: Record<StatusColorGroup, number> = {
    BASE: 0,
    CV: 0,
    NEW: 0,
    EC: 0,
    UD: 0,
    REM: 0,
    KOMBI: 0,
  };
  const countsByVariation: Record<SgeVariationKind, number> = {
    CV: 0,
    AV: 0,
    PV: 0,
    REM: 0,
  };

  let activeCount = 0;
  let removedHereCount = 0;
  let removedTotalCount = 0;
  let futureCount = 0;

  for (const st of resolvedStates.values()) {
    if (st.presence === 'active') {
      activeCount++;
      if (st.kombiIdsAtVersion.length > 0) countsByGroup.KOMBI++;
      if (st.statusCode) {
        countsByCode[st.statusCode]++;
        countsByGroup[statusCodeToColorGroup(st.statusCode)]++;
        countsByVariation[statusCodeToVariationKind(st.statusCode)]++;
      }
    } else if (st.presence === 'removed_here') {
      removedHereCount++;
      removedTotalCount++;
      countsByCode.REM++;
      countsByGroup.REM++;
      countsByVariation.REM++;
    } else if (st.presence === 'removed_earlier') {
      removedTotalCount++;
    } else {
      futureCount++;
    }
  }

  const plannedChanges = countsByCode['EC-AV'] + countsByCode['EC-PV'];
  const unplannedDeviations = countsByCode['UD-AV'] + countsByCode['UD-PV'];
  const totalChanges = plannedChanges + unplannedDeviations + countsByCode.NEW + countsByCode.REM;

  return {
    version,
    activeCount,
    removedHereCount,
    removedTotalCount,
    futureCount,
    countsByGroup,
    countsByCode,
    countsByVariation,
    plannedChanges,
    unplannedDeviations,
    unplannedRatio: totalChanges > 0 ? unplannedDeviations / totalChanges : 0,
    carryoverRatio: activeCount > 0 ? countsByCode.CV / activeCount : 0,
  };
}

export function getLearningsForEvent(
  event: RsePhaseEvent,
  dataset: SgeDataset
): MethodikLearning[] {
  const stepSet = new Set(event.stepIds);
  const causeSet = new Set(event.causeIds);
  const learningIds = new Set<string>();

  for (const step of dataset.steps) {
    if (stepSet.has(step.id)) step.learnings.forEach((id) => learningIds.add(id));
  }
  for (const cause of dataset.causes) {
    if (causeSet.has(cause.id)) cause.learnings.forEach((id) => learningIds.add(id));
  }
  for (const l of dataset.learnings) {
    if (
      l.linkedStepIds.some((sId) => stepSet.has(sId)) ||
      l.linkedCauseIds.some((cId) => causeSet.has(cId))
    ) {
      learningIds.add(l.id);
    }
  }
  return dataset.learnings.filter((l) => learningIds.has(l.id));
}

export function getCausesForEvent(event: RsePhaseEvent, dataset: SgeDataset): CauseFinding[] {
  const causeMap = new Map(dataset.causes.map((c) => [c.id, c]));
  return event.causeIds
    .map((id) => causeMap.get(id))
    .filter((c): c is CauseFinding => Boolean(c));
}

export function getKombisForRse(rseId: string, dataset: SgeDataset): KombiIntegration[] {
  return dataset.kombis.filter((k) => k.involvedRseIds.includes(rseId));
}

export function getMicroIterationsForRse(rseId: string, dataset: SgeDataset): MicroIteration[] {
  return dataset.microIterations
    .filter((m) => m.rseId === rseId && !isPlaceholderMicroIteration(m))
    .sort((a, b) => (a.versionNr ?? 99) - (b.versionNr ?? 99) || a.rowIndex - b.rowIndex);
}
