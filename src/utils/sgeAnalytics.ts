import {
  CauseFinding,
  KombiIntegration,
  MethodikLearning,
  MicroIteration,
  PhaseVersionConfig,
  ProjectEditsOverlay,
  RseMaster,
  RsePhaseEvent,
  SgeDataset,
  StatusCode,
  StatusColorGroup,
} from '../types/sge';
import {
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
  statusCodeToColorGroup,
} from './sgeVisualConfig';

export type RsePresenceInVersion = 'active' | 'removed_here' | 'removed_earlier' | 'future';

export interface RseStateAtVersion {
  rse: RseMaster;
  presence: RsePresenceInVersion;
  statusCode: StatusCode | '';
  /** The exact event occurring in the selected version, if any */
  eventAtVersion: RsePhaseEvent | null;
  /** The latest event up to and including the selected version (for context/kombi) */
  latestEventUpToVersion: RsePhaseEvent | null;
  /** Active KOMBI IDs at the selected version */
  kombiIdsAtVersion: string[];
  /** Removal version label if removed_here or removed_earlier */
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
  plannedChanges: number;       // EC-GV + EC-PV
  unplannedDeviations: number;  // UD-GV + UD-PV
  unplannedRatio: number;       // UD / (EC + UD + NEW + REM)
  carryoverRatio: number;       // CV / activeCount
}

/** Merges locally persisted user edits into a clean view of the SgeDataset. */
export function applyEditsToDataset(
  dataset: SgeDataset,
  edits: ProjectEditsOverlay
): SgeDataset {
  const hasEventEdits = Object.keys(edits.events).length > 0;
  const hasMicroEdits = Object.keys(edits.microIterations).length > 0;
  const hasKombiEdits = Object.keys(edits.kombis).length > 0;

  if (!hasEventEdits && !hasMicroEdits && !hasKombiEdits) {
    return dataset;
  }

  const events = dataset.events.map((ev) => {
    const patch = edits.events[ev.eventId];
    if (!patch) return ev;
    const statusCode = patch.statusCode ?? ev.statusCode;
    return {
      ...ev,
      statusCode,
      planningCategoryFig2: derivePlanningCategoryFromStatus(statusCode),
      variationType: deriveVariationTypeFromStatus(statusCode),
      stateDescription: patch.stateDescription ?? ev.stateDescription,
      rationale: patch.rationale ?? ev.rationale,
      mediaRef: patch.mediaRef ?? ev.mediaRef,
    };
  });

  const microIterations = dataset.microIterations.map((m) => {
    const patch = edits.microIterations[m.id];
    if (!patch) return m;
    const change = patch.change ?? m.change;
    const result = patch.result ?? m.result;
    const evaluation = patch.evaluation ?? m.evaluation;
    const isPlaceholder =
      (m.detailBox.toUpperCase().startsWith('BOX PH_') &&
        change.trim().startsWith('[Platzhalter')) ||
      evaluation.toLowerCase().includes('platzhalter');
    return {
      ...m,
      change,
      result,
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

  // Update matrix cells if event status codes changed
  let matrix = dataset.matrix;
  if (hasEventEdits) {
    const evByRse = new Map<string, RsePhaseEvent[]>();
    for (const ev of events) {
      const list = evByRse.get(ev.rseId) ?? [];
      list.push(ev);
      evByRse.set(ev.rseId, list);
    }
    matrix = dataset.matrix.map((row) => {
      const rseEvents = evByRse.get(row.rseId) ?? [];
      const anyEdited = rseEvents.some((ev) => Boolean(edits.events[ev.eventId]?.statusCode));
      if (!anyEdited) return row;

      const byVerNr = new Map<number, RsePhaseEvent>();
      for (const ev of rseEvents) byVerNr.set(ev.versionNr, ev);
      const nextMap: Record<string, StatusCode | ''> = {};
      let active = false;
      for (const v of dataset.versions) {
        const ev = byVerNr.get(v.sortOrder);
        if (ev) {
          nextMap[v.versionKey] = ev.statusCode;
          active = ev.statusCode !== 'REM';
        } else if (active) {
          nextMap[v.versionKey] = 'CV';
        } else {
          nextMap[v.versionKey] = '';
        }
      }
      return { ...row, statusByVersionKey: nextMap };
    });
  }

  return {
    ...dataset,
    events,
    microIterations,
    kombis,
    matrix,
  };
}

/**
 * Resolves the exact live state of every RSE at a selected system version (v0.0 .. v2.2).
 */
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
      if (ev.versionNr <= version.sortOrder) {
        latestEventUpToVersion = ev;
      }
    }

    // Determine exact status from matrix (primary) or event fallback
    let statusCode: StatusCode | '' = matRow?.statusByVersionKey[version.versionKey] ?? '';
    if (!statusCode && eventAtVersion) {
      statusCode = eventAtVersion.statusCode;
    }

    let presence: RsePresenceInVersion = 'future';
    let removedInVersionLabel: string | null = null;

    if (statusCode === 'REM') {
      presence = 'removed_here';
      removedInVersionLabel = version.versionKey;
    } else if (statusCode) {
      presence = 'active';
    } else {
      // No status in this version: check if it was removed earlier or not yet introduced
      if (latestEventUpToVersion && latestEventUpToVersion.statusCode === 'REM') {
        presence = 'removed_earlier';
        const remVer = versionBySort.get(latestEventUpToVersion.versionNr);
        removedInVersionLabel = remVer ? remVer.versionKey : latestEventUpToVersion.version;
      } else {
        presence = 'future';
      }
    }

    // Active KOMBI IDs at this version:
    // Use kombiPartIds from the current/latest event up to this version; if an RSE's
    // master Aktuelle_Kombi_ID was already introduced at or before this version (e.g. KOMBI-04
    // introduced in v1.1 for R2.3/R2.7 while v2.0 events modified sub-features), preserve it.
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
        if (alreadyIntegrated) {
          kombiIdsAtVersion = rse.currentKombiIds;
        }
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
    'EC-GV': 0,
    'EC-PV': 0,
    'UD-GV': 0,
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

  let activeCount = 0;
  let removedHereCount = 0;
  let removedTotalCount = 0;
  let futureCount = 0;

  for (const st of resolvedStates.values()) {
    if (st.presence === 'active') {
      activeCount++;
      if (st.kombiIdsAtVersion.length > 0) {
        countsByGroup.KOMBI++;
      }
      if (st.statusCode) {
        countsByCode[st.statusCode]++;
        countsByGroup[statusCodeToColorGroup(st.statusCode)]++;
      }
    } else if (st.presence === 'removed_here') {
      removedHereCount++;
      removedTotalCount++;
      countsByCode.REM++;
      countsByGroup.REM++;
    } else if (st.presence === 'removed_earlier') {
      removedTotalCount++;
    } else {
      futureCount++;
    }
  }

  const plannedChanges = countsByCode['EC-GV'] + countsByCode['EC-PV'];
  const unplannedDeviations = countsByCode['UD-GV'] + countsByCode['UD-PV'];
  const totalChanges = plannedChanges + unplannedDeviations + countsByCode.NEW + countsByCode.REM;

  return {
    version,
    activeCount,
    removedHereCount,
    removedTotalCount,
    futureCount,
    countsByGroup,
    countsByCode,
    plannedChanges,
    unplannedDeviations,
    unplannedRatio: totalChanges > 0 ? unplannedDeviations / totalChanges : 0,
    carryoverRatio: activeCount > 0 ? countsByCode.CV / activeCount : 0,
  };
}

/** Resolves all Methodik_Learnings linked to an event (via its Schritt_IDs & Ursache_IDs). */
export function getLearningsForEvent(
  event: RsePhaseEvent,
  dataset: SgeDataset
): MethodikLearning[] {
  const stepSet = new Set(event.stepIds);
  const causeSet = new Set(event.causeIds);
  const learningIds = new Set<string>();

  for (const step of dataset.steps) {
    if (stepSet.has(step.id)) {
      step.learnings.forEach((id) => learningIds.add(id));
    }
  }
  for (const cause of dataset.causes) {
    if (causeSet.has(cause.id)) {
      cause.learnings.forEach((id) => learningIds.add(id));
    }
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
    .filter((m) => m.rseId === rseId)
    .sort((a, b) => (a.versionNr ?? 99) - (b.versionNr ?? 99) || a.rowIndex - b.rowIndex);
}
