import {
  CauseFinding,
  ConnectionArrow,
  DevelopmentStep,
  DuckomatDataset,
  MethodikLearning,
  MicroIteration,
  PhaseConfig,
} from '../types/duckomat';

export interface FocusSubgraph {
  focusedStepId: string;
  upstreamStepIds: Set<string>;
  downstreamStepIds: Set<string>;
  activeStepIds: Set<string>;
  activeArrowIds: Set<string>;
  upstreamArrowIds: Set<string>;
  downstreamArrowIds: Set<string>;
}

export interface LearningHighlight {
  learning: MethodikLearning;
  directStepIds: Set<string>;
  chainStepIds: Set<string>;
  activeStepIds: Set<string>;
  activeArrowIds: Set<string>;
  activeCauseIds: Set<string>;
}

/**
 * Computes transitive upstream (predecessors) and downstream (successors)
 * subgraph for a focused development step.
 */
export function computeDependencyFocus(
  stepId: string,
  arrows: ConnectionArrow[],
  visibleStepIds: Set<string>
): FocusSubgraph {
  const incoming = new Map<string, ConnectionArrow[]>();
  const outgoing = new Map<string, ConnectionArrow[]>();

  for (const arrow of arrows) {
    if (!visibleStepIds.has(arrow.from) || !visibleStepIds.has(arrow.to)) continue;
    const outList = outgoing.get(arrow.from) ?? [];
    outList.push(arrow);
    outgoing.set(arrow.from, outList);

    const inList = incoming.get(arrow.to) ?? [];
    inList.push(arrow);
    incoming.set(arrow.to, inList);
  }

  const upstreamStepIds = new Set<string>();
  const upstreamArrowIds = new Set<string>();
  const backQueue: string[] = [stepId];
  const visitedBack = new Set<string>([stepId]);

  while (backQueue.length > 0) {
    const curr = backQueue.shift()!;
    const inArrows = incoming.get(curr) ?? [];
    for (const arrow of inArrows) {
      upstreamArrowIds.add(arrow.id);
      if (!visitedBack.has(arrow.from)) {
        visitedBack.add(arrow.from);
        upstreamStepIds.add(arrow.from);
        backQueue.push(arrow.from);
      }
    }
  }

  const downstreamStepIds = new Set<string>();
  const downstreamArrowIds = new Set<string>();
  const fwdQueue: string[] = [stepId];
  const visitedFwd = new Set<string>([stepId]);

  while (fwdQueue.length > 0) {
    const curr = fwdQueue.shift()!;
    const outArrows = outgoing.get(curr) ?? [];
    for (const arrow of outArrows) {
      downstreamArrowIds.add(arrow.id);
      if (!visitedFwd.has(arrow.to)) {
        visitedFwd.add(arrow.to);
        downstreamStepIds.add(arrow.to);
        fwdQueue.push(arrow.to);
      }
    }
  }

  const activeStepIds = new Set<string>([
    stepId,
    ...upstreamStepIds,
    ...downstreamStepIds,
  ]);
  const activeArrowIds = new Set<string>([...upstreamArrowIds, ...downstreamArrowIds]);

  return {
    focusedStepId: stepId,
    upstreamStepIds,
    downstreamStepIds,
    activeStepIds,
    activeArrowIds,
    upstreamArrowIds,
    downstreamArrowIds,
  };
}

/**
 * Computes the complete highlighted subgraph for a selected Methodik-Learning:
 * - Direct steps (from Verknuepfte_Schritte + step.learnings)
 * - Linked causes (from Verknuepfte_Ursachen + cause.learnings)
 * - Intermediate causal chains (nodes & arrows on directed paths between linked steps,
 *   plus arrows substantiated by any linked cause)
 */
export function computeLearningHighlight(
  learning: MethodikLearning,
  steps: DevelopmentStep[],
  arrows: ConnectionArrow[],
  causes: CauseFinding[]
): LearningHighlight {
  const visibleStepIds = new Set(steps.map((s) => s.id));
  const directStepIds = new Set<string>();
  const activeCauseIds = new Set<string>();

  for (const id of learning.linkedStepIds) {
    if (visibleStepIds.has(id)) directStepIds.add(id);
  }
  for (const step of steps) {
    if (step.learnings.includes(learning.id)) {
      directStepIds.add(step.id);
    }
  }

  for (const cId of learning.linkedCauseIds) {
    activeCauseIds.add(cId);
  }
  for (const cause of causes) {
    if (cause.learnings.includes(learning.id)) {
      activeCauseIds.add(cause.id);
    }
  }

  // Also include steps directly affected/triggered by linked causes if visible
  for (const cause of causes) {
    if (!activeCauseIds.has(cause.id)) continue;
    if (cause.affectedStepId && visibleStepIds.has(cause.affectedStepId)) {
      directStepIds.add(cause.affectedStepId);
    }
    if (cause.triggeredStepId && visibleStepIds.has(cause.triggeredStepId)) {
      directStepIds.add(cause.triggeredStepId);
    }
  }

  // Build adjacency lists on visible steps
  const outgoing = new Map<string, ConnectionArrow[]>();
  const incoming = new Map<string, ConnectionArrow[]>();
  for (const arrow of arrows) {
    if (!visibleStepIds.has(arrow.from) || !visibleStepIds.has(arrow.to)) continue;
    const outList = outgoing.get(arrow.from) ?? [];
    outList.push(arrow);
    outgoing.set(arrow.from, outList);

    const inList = incoming.get(arrow.to) ?? [];
    inList.push(arrow);
    incoming.set(arrow.to, inList);
  }

  // Forward reachable from any direct step
  const fwdReachable = new Set<string>(directStepIds);
  const fwdQueue = Array.from(directStepIds);
  while (fwdQueue.length > 0) {
    const curr = fwdQueue.shift()!;
    for (const arrow of outgoing.get(curr) ?? []) {
      if (!fwdReachable.has(arrow.to)) {
        fwdReachable.add(arrow.to);
        fwdQueue.push(arrow.to);
      }
    }
  }

  // Backward reachable from any direct step
  const bwdReachable = new Set<string>(directStepIds);
  const bwdQueue = Array.from(directStepIds);
  while (bwdQueue.length > 0) {
    const curr = bwdQueue.shift()!;
    for (const arrow of incoming.get(curr) ?? []) {
      if (!bwdReachable.has(arrow.from)) {
        bwdReachable.add(arrow.from);
        bwdQueue.push(arrow.from);
      }
    }
  }

  // Intermediate causal chain steps: nodes lying on any directed path between direct learning steps
  const chainStepIds = new Set<string>();
  for (const id of fwdReachable) {
    if (bwdReachable.has(id) && !directStepIds.has(id)) {
      chainStepIds.add(id);
    }
  }

  const activeStepIds = new Set<string>([...directStepIds, ...chainStepIds]);
  const activeArrowIds = new Set<string>();

  for (const arrow of arrows) {
    if (!visibleStepIds.has(arrow.from) || !visibleStepIds.has(arrow.to)) continue;
    const connectsActive = activeStepIds.has(arrow.from) && activeStepIds.has(arrow.to);
    const hasLinkedCause = arrow.causeIds.some((cId) => activeCauseIds.has(cId));
    if (connectsActive || hasLinkedCause) {
      activeArrowIds.add(arrow.id);
      if (hasLinkedCause) {
        activeStepIds.add(arrow.from);
        activeStepIds.add(arrow.to);
      }
    }
  }

  return {
    learning,
    directStepIds,
    chainStepIds,
    activeStepIds,
    activeArrowIds,
    activeCauseIds,
  };
}

/**
 * Computes topological sub-columns (subStep = 0, 1, 2, ...) inside each phase
 * whenever directed arrows connect two steps within the SAME phase (e.g. P_21: E27 -> E28 in P06).
 * Returns each step's subStep index and the total sub-column count per phase.
 */
export function computeIntraPhaseSubSteps(
  phases: PhaseConfig[],
  steps: DevelopmentStep[],
  arrows: ConnectionArrow[]
): {
  subStepByStepId: Map<string, number>;
  subColCountByPhaseKey: Map<string, number>;
} {
  const subStepByStepId = new Map<string, number>();
  const subColCountByPhaseKey = new Map<string, number>();

  const stepById = new Map(steps.map((s) => [s.id, s]));
  const stepsByPhase = new Map<string, DevelopmentStep[]>();
  for (const step of steps) {
    const list = stepsByPhase.get(step.phase) ?? [];
    list.push(step);
    stepsByPhase.set(step.phase, list);
  }

  // Group intra-phase arrows by phaseKey
  const intraArrowsByPhase = new Map<string, ConnectionArrow[]>();
  for (const arrow of arrows) {
    const s = stepById.get(arrow.from);
    const t = stepById.get(arrow.to);
    if (!s || !t || s.id === t.id) continue;
    if (s.phase === t.phase) {
      const list = intraArrowsByPhase.get(s.phase) ?? [];
      list.push(arrow);
      intraArrowsByPhase.set(s.phase, list);
    }
  }

  for (const phase of phases) {
    const phaseSteps = stepsByPhase.get(phase.phaseKey) ?? [];
    const phaseArrows = intraArrowsByPhase.get(phase.phaseKey) ?? [];

    for (const s of phaseSteps) {
      subStepByStepId.set(s.id, 0);
    }

    if (phaseArrows.length === 0 || phaseSteps.length <= 1) {
      subColCountByPhaseKey.set(phase.phaseKey, 1);
      continue;
    }

    // Cycle-safe longest-path relaxation (Bellman-Ford style, bounded by |V|-1)
    const maxAllowedDepth = Math.max(1, phaseSteps.length - 1);
    for (let iter = 0; iter < phaseSteps.length; iter++) {
      let changed = false;
      for (const arrow of phaseArrows) {
        const fromDepth = subStepByStepId.get(arrow.from) ?? 0;
        const toDepth = subStepByStepId.get(arrow.to) ?? 0;
        const candidate = Math.min(fromDepth + 1, maxAllowedDepth);
        if (candidate > toDepth) {
          subStepByStepId.set(arrow.to, candidate);
          changed = true;
        }
      }
      if (!changed) break;
    }

    let maxDepth = 0;
    for (const s of phaseSteps) {
      const d = subStepByStepId.get(s.id) ?? 0;
      if (d > maxDepth) maxDepth = d;
    }
    subColCountByPhaseKey.set(phase.phaseKey, maxDepth + 1);
  }

  return { subStepByStepId, subColCountByPhaseKey };
}

/**
 * Orders steps by Phase Sortier_Nr -> Intra-phase subStep -> Lane order -> Schritt_ID
 * for step-by-step storytelling.
 */
export function getOrderedStepsForStepper(dataset: DuckomatDataset): DevelopmentStep[] {
  const phaseOrder = new Map(dataset.phases.map((p, idx) => [p.phaseKey, idx]));
  const laneOrder = new Map(dataset.lanes.map((l, idx) => [l, idx]));
  const { subStepByStepId } = computeIntraPhaseSubSteps(
    dataset.phases,
    dataset.steps,
    dataset.arrows
  );

  return [...dataset.steps].sort((a, b) => {
    const pDiff = (phaseOrder.get(a.phase) ?? 999) - (phaseOrder.get(b.phase) ?? 999);
    if (pDiff !== 0) return pDiff;
    const subDiff = (subStepByStepId.get(a.id) ?? 0) - (subStepByStepId.get(b.id) ?? 0);
    if (subDiff !== 0) return subDiff;
    const lDiff = (laneOrder.get(a.spur) ?? 999) - (laneOrder.get(b.spur) ?? 999);
    if (lDiff !== 0) return lDiff;
    return a.id.localeCompare(b.id, 'de', { numeric: true });
  });
}

/**
 * Computes the latest reached non-milestone step per lane up to the current stepper point
 * (used only when stepping through intermediate phases to indicate current interim state).
 */
export function getInterimLatestStepIdsPerLane(
  visibleSteps: DevelopmentStep[],
  phases: PhaseConfig[]
): Set<string> {
  const phaseRank = new Map(phases.map((p, idx) => [p.phaseKey, idx]));
  const latestByLane = new Map<string, { id: string; rank: number }>();

  for (const step of visibleSteps) {
    if (step.standCategory === 'milestone') continue;
    const rank = phaseRank.get(step.phase) ?? -1;
    const existing = latestByLane.get(step.spur);
    if (!existing || rank >= existing.rank) {
      latestByLane.set(step.spur, { id: step.id, rank });
    }
  }

  return new Set(Array.from(latestByLane.values()).map((entry) => entry.id));
}

/**
 * Finds all micro-iterations linked to a development step via Detail_Box or Gehört_zu_Schritt.
 */
export function getMicroIterationsForStep(
  step: DevelopmentStep,
  allIterations: MicroIteration[]
): MicroIteration[] {
  return allIterations
    .filter((m) => {
      if (step.detailBox && m.detailBox && m.detailBox === step.detailBox) {
        return true;
      }
      if (m.parentStepId && m.parentStepId === step.id) {
        return true;
      }
      return false;
    })
    .sort((a, b) => a.stepNumber.localeCompare(b.stepNumber, 'de', { numeric: true }));
}

export interface LinkedCauseItem {
  cause: CauseFinding;
  relation: 'Betroffener Schritt' | 'Ausgelöster Schritt' | 'Pfeil-Begründung';
}

export function getCausesForStep(
  stepId: string,
  allCauses: CauseFinding[],
  allArrows: ConnectionArrow[]
): LinkedCauseItem[] {
  const results: LinkedCauseItem[] = [];
  const seen = new Set<string>();

  for (const cause of allCauses) {
    if (cause.affectedStepId === stepId) {
      results.push({ cause, relation: 'Betroffener Schritt' });
      seen.add(cause.id);
    } else if (cause.triggeredStepId === stepId) {
      results.push({ cause, relation: 'Ausgelöster Schritt' });
      seen.add(cause.id);
    }
  }

  const causeById = new Map(allCauses.map((c) => [c.id, c]));
  for (const arrow of allArrows) {
    if (arrow.from === stepId || arrow.to === stepId) {
      for (const cId of arrow.causeIds) {
        if (!seen.has(cId)) {
          const found = causeById.get(cId);
          if (found) {
            results.push({ cause: found, relation: 'Pfeil-Begründung' });
            seen.add(cId);
          }
        }
      }
    }
  }

  return results;
}

export function getCausesForArrow(
  arrow: ConnectionArrow,
  allCauses: CauseFinding[]
): CauseFinding[] {
  const causeById = new Map(allCauses.map((c) => [c.id, c]));
  const result: CauseFinding[] = [];
  const seen = new Set<string>();

  for (const cId of arrow.causeIds) {
    const found = causeById.get(cId);
    if (found && !seen.has(found.id)) {
      result.push(found);
      seen.add(found.id);
    }
  }

  if (result.length === 0) {
    for (const c of allCauses) {
      if (
        c.affectedStepId === arrow.from &&
        c.triggeredStepId === arrow.to &&
        !seen.has(c.id)
      ) {
        result.push(c);
        seen.add(c.id);
      }
    }
  }

  return result;
}

/**
 * Returns all Learning IDs associated with a given step (combining step.learnings
 * and Methodik_Learnings.linkedStepIds), sorted naturally (M01..M12).
 */
export function getLearningIdsForStep(
  step: DevelopmentStep,
  allLearnings: MethodikLearning[]
): string[] {
  const ids = new Set<string>(step.learnings);
  for (const learning of allLearnings) {
    if (learning.linkedStepIds.includes(step.id)) {
      ids.add(learning.id);
    }
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}

/**
 * Returns all Learning IDs associated with a given cause (combining cause.learnings
 * and Methodik_Learnings.linkedCauseIds), sorted naturally.
 */
export function getLearningIdsForCause(
  cause: CauseFinding,
  allLearnings: MethodikLearning[]
): string[] {
  const ids = new Set<string>(cause.learnings);
  for (const learning of allLearnings) {
    if (learning.linkedCauseIds.includes(cause.id)) {
      ids.add(learning.id);
    }
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}
