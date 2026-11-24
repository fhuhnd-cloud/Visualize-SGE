import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  KombiIntegration,
  MethodikLearning,
  MicroIteration,
  PhaseVersionConfig,
  RseMaster,
  RseMatrixRow,
  RsePhaseEvent,
  SgeDataset,
  SpurDashboardRow,
  StatusCode,
} from '../types/sge';
import { classifyArrowType, parseIdList } from './excelParser';
import {
  derivePlanningCategoryFromStatus,
  deriveVariationTypeFromStatus,
} from './sgeVisualConfig';

/**
 * Recomputes synchronized matrix rows, RSE event/micro counts, and dashboard rollups
 * after any CRUD operation on SgeDataset.
 */
export function reconcileDerivedFields(dataset: SgeDataset): SgeDataset {
  const eventsByRse = new Map<string, RsePhaseEvent[]>();
  for (const ev of dataset.events) {
    const list = eventsByRse.get(ev.rseId) ?? [];
    list.push(ev);
    eventsByRse.set(ev.rseId, list);
  }
  for (const list of eventsByRse.values()) {
    list.sort((a, b) => a.versionNr - b.versionNr || a.rowIndex - b.rowIndex);
  }

  const microCountByRse = new Map<string, number>();
  for (const m of dataset.microIterations) {
    if (m.rseId) {
      microCountByRse.set(m.rseId, (microCountByRse.get(m.rseId) ?? 0) + 1);
    }
  }

  const versionBySort = new Map(dataset.versions.map((v) => [v.sortOrder, v]));

  // Reconcile RSE master counts & lifecycle
  const rseList: RseMaster[] = dataset.rseList.map((rse) => {
    const rEvents = eventsByRse.get(rse.rseId) ?? [];
    const lastEv = rEvents[rEvents.length - 1];
    const firstEv = rEvents[0];
    const lastVer = lastEv ? versionBySort.get(lastEv.versionNr) : undefined;
    const firstVer = firstEv ? versionBySort.get(firstEv.versionNr) : undefined;

    let currentLifecycle = rse.currentLifecycle;
    let removalVersion = rse.removalVersion;
    let removalVersionNr = rse.removalVersionNr;

    if (lastEv) {
      if (lastEv.statusCode === 'REM') {
        removalVersion = lastVer?.phaseName ?? lastEv.version;
        removalVersionNr = lastEv.versionNr;
        if (!currentLifecycle.toLowerCase().includes('ersetzt')) {
          currentLifecycle = 'Entfernt';
        }
      } else {
        removalVersion = '';
        removalVersionNr = null;
        currentLifecycle =
          rse.currentKombiIds.length > 0 ? 'Aktiv (Integriert)' : 'Aktiv';
      }
    }

    return {
      ...rse,
      firstVersion: firstVer?.phaseName ?? rse.firstVersion,
      firstVersionNr: firstEv?.versionNr ?? rse.firstVersionNr,
      removalVersion,
      removalVersionNr,
      currentLifecycle,
      versionEventsCount: rEvents.length,
      microIterationsCount: microCountByRse.get(rse.rseId) ?? 0,
    };
  });

  // Recompute 48x7 RSE_Phasenmatrix strictly from RSE_Stammdaten + RSE_Phasenwechsel
  const matrix: RseMatrixRow[] = rseList.map((rse, idx) => {
    const rEvents = eventsByRse.get(rse.rseId) ?? [];
    const byVerNr = new Map<number, RsePhaseEvent>();
    for (const ev of rEvents) byVerNr.set(ev.versionNr, ev);

    const statusByVersionKey: Record<string, StatusCode | ''> = {};
    let active = false;
    for (const v of dataset.versions) {
      const ev = byVerNr.get(v.sortOrder);
      if (ev) {
        statusByVersionKey[v.versionKey] = ev.statusCode;
        active = ev.statusCode !== 'REM';
      } else if (active) {
        statusByVersionKey[v.versionKey] = 'CV';
      } else {
        statusByVersionKey[v.versionKey] = '';
      }
    }

    return {
      rseId: rse.rseId,
      spur: rse.spur,
      name: rse.name,
      kombiIdRaw: rse.currentKombiIdRaw,
      kombiIds: rse.currentKombiIds,
      statusByVersionKey,
      rowIndex: idx + 2,
    };
  });

  // Reconcile dashboard rollups
  const lastVerKey = dataset.versions[dataset.versions.length - 1]?.versionKey ?? '';
  const matrixByRse = new Map(matrix.map((m) => [m.rseId, m]));

  const dashboard: SpurDashboardRow[] = dataset.dashboard.map((d) => {
    const laneRses = rseList.filter((r) => r.spur === d.spurId);
    const activeCount = laneRses.filter((r) => {
      const st = matrixByRse.get(r.rseId)?.statusByVersionKey[lastVerKey] ?? '';
      return Boolean(st) && st !== 'REM';
    }).length;
    const removedCount = laneRses.length - activeCount;
    const integratedCount = laneRses.filter((r) => r.currentKombiIds.length > 0).length;
    const evCount = laneRses.reduce((sum, r) => sum + r.versionEventsCount, 0);
    const microCount = laneRses.reduce((sum, r) => sum + r.microIterationsCount, 0);

    return {
      ...d,
      totalRse: laneRses.length,
      activeRseV22: activeCount,
      removedOrReplaced: removedCount,
      integratedRse: integratedCount,
      versionEventsCount: evCount,
      microIterationsCount: microCount,
    };
  });

  const dashboardTotal: SpurDashboardRow | null = dataset.dashboardTotal
    ? {
        ...dataset.dashboardTotal,
        totalRse: rseList.length,
        activeRseV22: dashboard.reduce((s, d) => s + d.activeRseV22, 0),
        removedOrReplaced: dashboard.reduce((s, d) => s + d.removedOrReplaced, 0),
        integratedRse: dashboard.reduce((s, d) => s + d.integratedRse, 0),
        versionEventsCount: dataset.events.length,
        microIterationsCount: dataset.microIterations.length,
      }
    : null;

  return {
    ...dataset,
    rseList,
    matrix,
    dashboard,
    dashboardTotal,
  };
}

/** Generate next sequential ID like EV166, P_51, U26, M17, E50, KOMBI-07 */
export function generateNextId(existingIds: string[], prefix: string, pad = 2): string {
  let maxNum = 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`, 'i');
  for (const id of existingIds) {
    const m = id.trim().match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(pad, '0')}`;
}

/** Generate next RSE ID inside a lane, e.g. R2.9 */
export function generateNextRseId(existingRseIds: string[], spurId: string): string {
  const laneMatch = spurId.match(/^S(\d+)/i);
  const laneNum = laneMatch ? laneMatch[1] : '1';
  const re = new RegExp(`^R${laneNum}\\.(\\d+)$`, 'i');
  let maxIdx = 0;
  for (const id of existingRseIds) {
    const m = id.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxIdx) maxIdx = n;
    }
  }
  return `R${laneNum}.${maxIdx + 1}`;
}

// --- SPUR CRUD ---
export function updateSpur(
  dataset: SgeDataset,
  spurId: string,
  patch: Partial<Pick<SpurDashboardRow, 'name' | 'role' | 'maturitySummary'>>
): SgeDataset {
  const exists = dataset.dashboard.some((d) => d.spurId === spurId);
  const dashboard = exists
    ? dataset.dashboard.map((d) => (d.spurId === spurId ? { ...d, ...patch } : d))
    : [
        ...dataset.dashboard,
        {
          spurId,
          name: patch.name ?? spurId,
          role: patch.role ?? '',
          totalRse: 0,
          activeRseV22: 0,
          removedOrReplaced: 0,
          integratedRse: 0,
          versionEventsCount: 0,
          microIterationsCount: 0,
          eventsChecked: '',
          maturitySummary: patch.maturitySummary ?? '',
          rowIndex: dataset.dashboard.length + 2,
        },
      ];
  return { ...dataset, dashboard };
}

// --- VERSION / MILESTONE CRUD ---
export function updateVersionConfig(
  dataset: SgeDataset,
  versionKey: string,
  patch: Partial<Pick<PhaseVersionConfig, 'phaseName' | 'milestoneBadge' | 'systemStateSummary'>>
): SgeDataset {
  const versions = dataset.versions.map((v) => {
    if (v.versionKey !== versionKey) return v;
    const badge = patch.milestoneBadge !== undefined ? patch.milestoneBadge.trim() : v.milestoneBadge;
    return {
      ...v,
      phaseName: patch.phaseName ?? v.phaseName,
      milestoneBadge: badge === '-' ? '' : badge,
      isMilestone: /^M\d+/i.test(badge),
      systemStateSummary: patch.systemStateSummary ?? v.systemStateSummary,
    };
  });
  return { ...dataset, versions };
}

// --- RSE CRUD ---
export function addRse(
  dataset: SgeDataset,
  input: {
    rseId?: string;
    spur: string;
    name: string;
    origin: string;
    firstVersionKey: string;
    initialStatus: StatusCode;
    functionSummary: string;
    predecessorOrReplacement?: string;
  }
): { dataset: SgeDataset; createdRseId: string } {
  const rseId = (input.rseId?.trim() || generateNextRseId(dataset.rseList.map((r) => r.rseId), input.spur));
  const version =
    dataset.versions.find((v) => v.versionKey === input.firstVersionKey) ?? dataset.versions[0];
  const eventId = generateNextId(dataset.events.map((e) => e.eventId), 'EV', 3);

  const newRse: RseMaster = {
    rseId,
    spur: input.spur,
    name: input.name.trim() || rseId,
    origin: input.origin || 'Neu / Extern',
    firstVersion: version?.phaseName ?? input.firstVersionKey,
    firstVersionNr: version?.sortOrder ?? 1,
    removalVersion: '',
    removalVersionNr: null,
    currentLifecycle: 'Aktiv',
    predecessorOrReplacement: input.predecessorOrReplacement ?? '',
    currentKombiIdRaw: '',
    currentKombiIds: [],
    rseCountInPart: 1,
    versionEventsCount: 1,
    microIterationsCount: 0,
    reviewStatus: 'Bearbeitet',
    functionSummary: input.functionSummary,
    rowIndex: dataset.rseList.length + 2,
  };

  const newEvent: RsePhaseEvent = {
    eventId,
    rseId,
    spur: input.spur,
    version: version?.phaseName ?? input.firstVersionKey,
    versionNr: version?.sortOrder ?? 1,
    lookupKey: `${rseId}|${version?.sortOrder ?? 1}`,
    statusCode: input.initialStatus,
    planningCategoryFig2: derivePlanningCategoryFromStatus(input.initialStatus),
    variationType: deriveVariationTypeFromStatus(input.initialStatus),
    kombiPartIdRaw: '',
    kombiPartIds: [],
    stateDescription: input.functionSummary || input.name,
    rationale: '',
    causeIdRaw: '',
    causeIds: [],
    stepIdRaw: '',
    stepIds: [],
    reviewStatus: 'Bearbeitet',
    mediaRef: '',
    rowIndex: dataset.events.length + 2,
  };

  const next = reconcileDerivedFields({
    ...dataset,
    rseList: [...dataset.rseList, newRse],
    events: [...dataset.events, newEvent],
  });
  return { dataset: next, createdRseId: rseId };
}

export function updateRse(
  dataset: SgeDataset,
  rseId: string,
  patch: Partial<
    Pick<
      RseMaster,
      'name' | 'spur' | 'origin' | 'currentLifecycle' | 'predecessorOrReplacement' | 'functionSummary' | 'currentKombiIdRaw'
    >
  >
): SgeDataset {
  const rseList = dataset.rseList.map((r) => {
    if (r.rseId !== rseId) return r;
    const kombiRaw = patch.currentKombiIdRaw !== undefined ? patch.currentKombiIdRaw : r.currentKombiIdRaw;
    return {
      ...r,
      ...patch,
      currentKombiIdRaw: kombiRaw,
      currentKombiIds: parseIdList(kombiRaw),
    };
  });
  // If lane changed, also update events & microIterations for consistency
  const events = patch.spur
    ? dataset.events.map((e) => (e.rseId === rseId ? { ...e, spur: patch.spur! } : e))
    : dataset.events;
  const microIterations = patch.spur
    ? dataset.microIterations.map((m) => (m.rseId === rseId ? { ...m, spur: patch.spur! } : m))
    : dataset.microIterations;

  return reconcileDerivedFields({ ...dataset, rseList, events, microIterations });
}

export function deleteRse(dataset: SgeDataset, rseId: string): SgeDataset {
  const rseList = dataset.rseList.filter((r) => r.rseId !== rseId);
  const events = dataset.events.filter((e) => e.rseId !== rseId);
  const microIterations = dataset.microIterations.filter((m) => m.rseId !== rseId);
  const kombis = dataset.kombis.map((k) => {
    if (!k.involvedRseIds.includes(rseId)) return k;
    const nextIds = k.involvedRseIds.filter((id) => id !== rseId);
    return {
      ...k,
      involvedRseIds: nextIds,
      involvedRseRaw: nextIds.join(', '),
      rseCountInPart: nextIds.length,
    };
  });
  return reconcileDerivedFields({ ...dataset, rseList, events, microIterations, kombis });
}

// --- RSE PHASE EVENT CRUD ---
export function upsertRseEvent(
  dataset: SgeDataset,
  input: {
    eventId?: string;
    rseId: string;
    versionKey: string;
    statusCode: StatusCode;
    stateDescription?: string;
    rationale?: string;
    causeIdRaw?: string;
    stepIdRaw?: string;
    kombiPartIdRaw?: string;
    mediaRef?: string;
  }
): SgeDataset {
  const rse = dataset.rseList.find((r) => r.rseId === input.rseId);
  const ver = dataset.versions.find((v) => v.versionKey === input.versionKey);
  if (!rse || !ver) return dataset;

  const existing =
    (input.eventId ? dataset.events.find((e) => e.eventId === input.eventId) : undefined) ??
    dataset.events.find((e) => e.rseId === input.rseId && e.versionNr === ver.sortOrder);

  if (existing) {
    const events = dataset.events.map((e) => {
      if (e.eventId !== existing.eventId) return e;
      const causeRaw = input.causeIdRaw !== undefined ? input.causeIdRaw : e.causeIdRaw;
      const stepRaw = input.stepIdRaw !== undefined ? input.stepIdRaw : e.stepIdRaw;
      const kombiRaw = input.kombiPartIdRaw !== undefined ? input.kombiPartIdRaw : e.kombiPartIdRaw;
      return {
        ...e,
        statusCode: input.statusCode,
        planningCategoryFig2: derivePlanningCategoryFromStatus(input.statusCode),
        variationType: deriveVariationTypeFromStatus(input.statusCode),
        stateDescription: input.stateDescription !== undefined ? input.stateDescription : e.stateDescription,
        rationale: input.rationale !== undefined ? input.rationale : e.rationale,
        causeIdRaw: causeRaw,
        causeIds: parseIdList(causeRaw),
        stepIdRaw: stepRaw,
        stepIds: parseIdList(stepRaw),
        kombiPartIdRaw: kombiRaw,
        kombiPartIds: parseIdList(kombiRaw),
        mediaRef: input.mediaRef !== undefined ? input.mediaRef : e.mediaRef,
      };
    });
    return reconcileDerivedFields({ ...dataset, events });
  }

  const newEventId = generateNextId(dataset.events.map((e) => e.eventId), 'EV', 3);
  const causeRaw = input.causeIdRaw ?? '';
  const stepRaw = input.stepIdRaw ?? '';
  const kombiRaw = input.kombiPartIdRaw ?? '';
  const newEv: RsePhaseEvent = {
    eventId: newEventId,
    rseId: rse.rseId,
    spur: rse.spur,
    version: ver.phaseName,
    versionNr: ver.sortOrder,
    lookupKey: `${rse.rseId}|${ver.sortOrder}`,
    statusCode: input.statusCode,
    planningCategoryFig2: derivePlanningCategoryFromStatus(input.statusCode),
    variationType: deriveVariationTypeFromStatus(input.statusCode),
    kombiPartIdRaw: kombiRaw,
    kombiPartIds: parseIdList(kombiRaw),
    stateDescription: input.stateDescription ?? `${rse.name} (${input.statusCode})`,
    rationale: input.rationale ?? '',
    causeIdRaw: causeRaw,
    causeIds: parseIdList(causeRaw),
    stepIdRaw: stepRaw,
    stepIds: parseIdList(stepRaw),
    reviewStatus: 'Bearbeitet',
    mediaRef: input.mediaRef ?? '',
    rowIndex: dataset.events.length + 2,
  };

  return reconcileDerivedFields({
    ...dataset,
    events: [...dataset.events, newEv],
  });
}

export function deleteRseEvent(dataset: SgeDataset, eventId: string): SgeDataset {
  const events = dataset.events.filter((e) => e.eventId !== eventId);
  return reconcileDerivedFields({ ...dataset, events });
}

// --- MICRO-ITERATION CRUD ---
export function addMicroIteration(
  dataset: SgeDataset,
  input: {
    rseId: string;
    versionKey: string;
    detailBox: string;
    subVersionId: string;
    parentStepId?: string;
    change: string;
    result: string;
    evaluation: string;
    mediaRef?: string;
  }
): SgeDataset {
  const rse = dataset.rseList.find((r) => r.rseId === input.rseId);
  const ver = dataset.versions.find((v) => v.versionKey === input.versionKey);
  const id = input.subVersionId.trim() || `MI_${Date.now()}`;
  const item: MicroIteration = {
    id,
    detailBox: input.detailBox.trim() || 'Box Manuell',
    rseId: input.rseId,
    spur: rse?.spur ?? 'S1_Rahmen_Peripherie',
    version: ver?.phaseName ?? input.versionKey,
    versionNr: ver?.sortOrder ?? null,
    parentStepId: input.parentStepId ?? '',
    subVersionId: id,
    change: input.change,
    result: input.result,
    evaluation: input.evaluation,
    mediaRef: input.mediaRef ?? '',
    isPlaceholder: false,
    rowIndex: dataset.microIterations.length + 2,
  };
  return reconcileDerivedFields({
    ...dataset,
    microIterations: [...dataset.microIterations, item],
  });
}

export function updateMicroIteration(
  dataset: SgeDataset,
  microId: string,
  patch: Partial<Pick<MicroIteration, 'detailBox' | 'subVersionId' | 'change' | 'result' | 'evaluation' | 'mediaRef'>>
): SgeDataset {
  const microIterations = dataset.microIterations.map((m) => {
    if (m.id !== microId) return m;
    const change = patch.change ?? m.change;
    const evaluation = patch.evaluation ?? m.evaluation;
    const isPlaceholder =
      (m.detailBox.toUpperCase().startsWith('BOX PH_') &&
        change.trim().startsWith('[Platzhalter')) ||
      evaluation.toLowerCase().includes('platzhalter');
    return { ...m, ...patch, isPlaceholder };
  });
  return { ...dataset, microIterations };
}

export function deleteMicroIteration(dataset: SgeDataset, microId: string): SgeDataset {
  return reconcileDerivedFields({
    ...dataset,
    microIterations: dataset.microIterations.filter((m) => m.id !== microId),
  });
}

// --- KOMBI CRUD ---
export function upsertKombi(
  dataset: SgeDataset,
  input: {
    kombiId?: string;
    partName: string;
    integratedFromPhase: string;
    involvedRseIds: string[];
    involvedLanes: string;
    variationType: string;
    rationale: string;
    mediaRef?: string;
  }
): SgeDataset {
  const kombiId =
    input.kombiId?.trim() || generateNextId(dataset.kombis.map((k) => k.kombiId), 'KOMBI-', 2);
  const exists = dataset.kombis.some((k) => k.kombiId === kombiId);
  const entry: KombiIntegration = {
    kombiId,
    partName: input.partName,
    integratedFromPhase: input.integratedFromPhase,
    rseCountInPart: input.involvedRseIds.length,
    involvedRseRaw: input.involvedRseIds.join(', '),
    involvedRseIds: input.involvedRseIds,
    involvedLanes: input.involvedLanes,
    variationType: input.variationType,
    rationale: input.rationale,
    mediaRef: input.mediaRef ?? '',
    rowIndex: dataset.kombis.length + 2,
  };

  const kombis = exists
    ? dataset.kombis.map((k) => (k.kombiId === kombiId ? { ...k, ...entry, rowIndex: k.rowIndex } : k))
    : [...dataset.kombis, entry];

  // Sync currentKombiIds on involved RSEs
  const rseList = dataset.rseList.map((r) => {
    const isInvolved = input.involvedRseIds.includes(r.rseId);
    const hasKombi = r.currentKombiIds.includes(kombiId);
    if (isInvolved && !hasKombi) {
      const nextIds = [...r.currentKombiIds, kombiId];
      return { ...r, currentKombiIds: nextIds, currentKombiIdRaw: nextIds.join(', ') };
    }
    if (!isInvolved && hasKombi) {
      const nextIds = r.currentKombiIds.filter((id) => id !== kombiId);
      return { ...r, currentKombiIds: nextIds, currentKombiIdRaw: nextIds.join(', ') };
    }
    return r;
  });

  return reconcileDerivedFields({ ...dataset, kombis, rseList });
}

export function deleteKombi(dataset: SgeDataset, kombiId: string): SgeDataset {
  const kombis = dataset.kombis.filter((k) => k.kombiId !== kombiId);
  const rseList = dataset.rseList.map((r) => {
    if (!r.currentKombiIds.includes(kombiId)) return r;
    const nextIds = r.currentKombiIds.filter((id) => id !== kombiId);
    return { ...r, currentKombiIds: nextIds, currentKombiIdRaw: nextIds.join(', ') };
  });
  const events = dataset.events.map((e) => {
    if (!e.kombiPartIds.includes(kombiId)) return e;
    const nextIds = e.kombiPartIds.filter((id) => id !== kombiId);
    return { ...e, kombiPartIds: nextIds, kombiPartIdRaw: nextIds.join(', ') };
  });
  return reconcileDerivedFields({ ...dataset, kombis, rseList, events });
}

// --- CAUSAL ARROW (Verbindungen_Pfeile) CRUD ---
export function upsertArrow(
  dataset: SgeDataset,
  input: {
    id?: string;
    fromRseId: string;
    fromVersionKey: string;
    toRseId: string;
    toVersionKey: string;
    arrowType: string;
    causeIdRaw: string;
    rationale: string;
  }
): SgeDataset {
  const fromVer = dataset.versions.find((v) => v.versionKey === input.fromVersionKey);
  const toVer = dataset.versions.find((v) => v.versionKey === input.toVersionKey);
  const fromRse = dataset.rseList.find((r) => r.rseId === input.fromRseId);
  const toRse = dataset.rseList.find((r) => r.rseId === input.toRseId);

  // Find or create matching Entwicklungsschritte so Excel foreign keys stay 100% valid!
  let steps = [...dataset.steps];
  const findOrCreateStep = (rseId: string, ver: PhaseVersionConfig | undefined, spur: string): string => {
    const existingStep = steps.find(
      (s) => s.rseIds.includes(rseId) && (ver ? s.versionNr === ver.sortOrder : true)
    );
    if (existingStep) return existingStep.id;
    const newStepId = generateNextId(steps.map((s) => s.id), 'E', 2);
    const rseName = dataset.rseList.find((r) => r.rseId === rseId)?.name ?? rseId;
    const newStep: DevelopmentStep = {
      id: newStepId,
      spur,
      rseIdRaw: rseId,
      rseIds: [rseId],
      version: ver?.phaseName ?? '',
      versionNr: ver?.sortOrder ?? 1,
      stepType: 'Bearbeitet',
      title: `${rseId}: ${rseName}`,
      implementation: '',
      stand: 'Zwischenstand',
      detailBox: '',
      learnings: [],
      rowIndex: steps.length + 2,
    };
    steps = [...steps, newStep];
    return newStepId;
  };

  const fromStepId = findOrCreateStep(input.fromRseId, fromVer, fromRse?.spur ?? 'S1_Rahmen_Peripherie');
  const toStepId = findOrCreateStep(input.toRseId, toVer, toRse?.spur ?? 'S1_Rahmen_Peripherie');

  const arrowId = input.id?.trim() || generateNextId(dataset.arrows.map((a) => a.id), 'P_', 2);
  const exists = dataset.arrows.some((a) => a.id === arrowId);
  const laneFromCode = (fromRse?.spur ?? '').split('_')[0] || 'S1';
  const laneToCode = (toRse?.spur ?? '').split('_')[0] || 'S1';

  const nextArrow: ConnectionArrow = {
    id: arrowId,
    from: fromStepId,
    to: toStepId,
    fromRseId: input.fromRseId,
    fromVersionKey: input.fromVersionKey,
    toRseId: input.toRseId,
    toVersionKey: input.toVersionKey,
    arrowType: input.arrowType,
    category: classifyArrowType(input.arrowType),
    causeIdRaw: input.causeIdRaw,
    causeIds: parseIdList(input.causeIdRaw),
    laneRef: `${laneFromCode} -> ${laneToCode}`,
    rationale: input.rationale,
    layoutDirection:
      input.fromVersionKey === input.toVersionKey
        ? 'Versionsintern: S-Kurve'
        : 'Versionsübergreifend: Links -> Rechts',
    rowIndex: dataset.arrows.length + 2,
  };

  const arrows = exists
    ? dataset.arrows.map((a) => (a.id === arrowId ? { ...nextArrow, rowIndex: a.rowIndex } : a))
    : [...dataset.arrows, nextArrow];

  return { ...dataset, steps, arrows };
}

export function deleteArrow(dataset: SgeDataset, arrowId: string): SgeDataset {
  return {
    ...dataset,
    arrows: dataset.arrows.filter((a) => a.id !== arrowId),
  };
}

// --- CAUSE (Ursachen_Tests_Befunde) CRUD ---
export function upsertCause(
  dataset: SgeDataset,
  input: {
    id?: string;
    category: string;
    laneRef: string;
    affectedStepId: string;
    triggeredStepId: string;
    title: string;
    observation: string;
    hypothesis: string;
    learningsRaw: string;
  },
  attachToEventId?: string
): SgeDataset {
  const id = input.id?.trim() || generateNextId(dataset.causes.map((c) => c.id), 'U', 2);
  const exists = dataset.causes.some((c) => c.id === id);
  const item: CauseFinding = {
    id,
    category: input.category,
    laneRef: input.laneRef,
    affectedStepId: input.affectedStepId,
    triggeredStepId: input.triggeredStepId,
    title: input.title,
    observation: input.observation,
    hypothesis: input.hypothesis,
    learnings: parseIdList(input.learningsRaw),
    rowIndex: dataset.causes.length + 2,
  };
  const causes = exists
    ? dataset.causes.map((c) => (c.id === id ? { ...item, rowIndex: c.rowIndex } : c))
    : [...dataset.causes, item];

  let events = dataset.events;
  if (attachToEventId) {
    events = dataset.events.map((e) => {
      if (e.eventId !== attachToEventId) return e;
      if (e.causeIds.includes(id)) return e;
      const nextIds = [...e.causeIds, id];
      return { ...e, causeIds: nextIds, causeIdRaw: nextIds.join(', ') };
    });
  }

  return { ...dataset, causes, events };
}

export function deleteCause(dataset: SgeDataset, causeId: string): SgeDataset {
  const causes = dataset.causes.filter((c) => c.id !== causeId);
  const events = dataset.events.map((e) => {
    if (!e.causeIds.includes(causeId)) return e;
    const nextIds = e.causeIds.filter((id) => id !== causeId);
    return { ...e, causeIds: nextIds, causeIdRaw: nextIds.join(', ') };
  });
  const arrows = dataset.arrows.map((a) => {
    if (!a.causeIds.includes(causeId)) return a;
    const nextIds = a.causeIds.filter((id) => id !== causeId);
    return { ...a, causeIds: nextIds, causeIdRaw: nextIds.join(', ') };
  });
  return { ...dataset, causes, events, arrows };
}

// --- METHODIK LEARNINGS CRUD ---
export function upsertLearning(
  dataset: SgeDataset,
  input: {
    id?: string;
    topic: string;
    title: string;
    principle: string;
    projectExample: string;
    linkedStepsRaw: string;
    linkedCausesRaw: string;
    scientificContext: string;
  }
): SgeDataset {
  const id = input.id?.trim() || generateNextId(dataset.learnings.map((l) => l.id), 'M', 2);
  const exists = dataset.learnings.some((l) => l.id === id);
  const item: MethodikLearning = {
    id,
    topic: input.topic,
    title: input.title,
    principle: input.principle,
    projectExample: input.projectExample,
    linkedStepIds: parseIdList(input.linkedStepsRaw),
    linkedCauseIds: parseIdList(input.linkedCausesRaw),
    scientificContext: input.scientificContext,
    rowIndex: dataset.learnings.length + 2,
  };
  const learnings = exists
    ? dataset.learnings.map((l) => (l.id === id ? { ...item, rowIndex: l.rowIndex } : l))
    : [...dataset.learnings, item];
  return { ...dataset, learnings };
}

export function deleteLearning(dataset: SgeDataset, learningId: string): SgeDataset {
  return {
    ...dataset,
    learnings: dataset.learnings.filter((l) => l.id !== learningId),
  };
}
