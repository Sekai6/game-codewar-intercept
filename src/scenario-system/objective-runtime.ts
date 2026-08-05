import type { ScenarioObjectiveDefinition } from "./types.js";
import type { ScenarioObjectiveState } from "./runtime.js";

export interface ScenarioLaunchFact {
  time: number;
  side: "blue" | "red";
  platformId: string;
  formationId?: string;
  weaponId: string;
  targetTrackId?: string;
}

export interface ObjectiveEvaluationContext {
  time: number;
  ended: boolean;
  phase: string;
  entityAlive(id: string): boolean;
}

export interface ObjectiveTransition {
  objectiveId: string;
  previous: ScenarioObjectiveState;
  state: ScenarioObjectiveState;
  reason: string;
}

export class ScenarioObjectiveRuntime {
  private readonly states = new Map<string, ScenarioObjectiveState>();
  private readonly launches: ScenarioLaunchFact[] = [];
  private readonly observedPhases = new Set<string>();

  constructor(private readonly objectives: readonly ScenarioObjectiveDefinition[]) { this.reset(); }
  reset() { this.states.clear(); for (const objective of this.objectives) this.states.set(objective.id, "active"); this.launches.length=0; this.observedPhases.clear(); }
  recordLaunch(fact: ScenarioLaunchFact) { this.launches.push({ ...fact }); }
  state(id: string) { return this.states.get(id) ?? "pending"; }

  evaluate(context: ObjectiveEvaluationContext): ObjectiveTransition[] {
    this.observedPhases.add(context.phase);
    const transitions: ObjectiveTransition[] = [];
    for (const objective of this.objectives) {
      const previous = this.states.get(objective.id) ?? "pending";
      if (previous === "complete" || previous === "failed") continue;
      const alive = objective.targetIds.map(context.entityAlive);
      const criteria = objective.criteria;
      const relevantLaunches = this.launches.filter((launch) =>
        launch.side === objective.side &&
        (!criteria?.requiredLaunchByFormationIds?.length || criteria.requiredLaunchByFormationIds.includes(launch.formationId ?? launch.platformId)) &&
        (!criteria?.requiredWeaponIds?.length || criteria.requiredWeaponIds.includes(launch.weaponId)));
      const forbiddenLaunch = this.launches.find((launch) =>
        criteria?.forbiddenLaunchByFormationIds?.includes(launch.formationId ?? launch.platformId) &&
        (!criteria.requiredWeaponIds?.length || criteria.requiredWeaponIds.includes(launch.weaponId)));
      let state: ScenarioObjectiveState = previous;
      let reason = "";
      if ((objective.kind === "protect" || objective.kind === "survive") && !alive.some(Boolean)) {
        state="failed"; reason="all protected entities are no longer alive";
      } else if (objective.kind === "intercept" && forbiddenLaunch) {
        state="failed"; reason=`forbidden strike weapon ${forbiddenLaunch.weaponId} released by ${forbiddenLaunch.formationId ?? forbiddenLaunch.platformId}`;
      } else if (objective.kind === "intercept" && !alive.some(Boolean)) {
        state="complete"; reason="all designated raid formations neutralized before prohibited release";
      } else if (objective.kind === "strike" && relevantLaunches.length) {
        state="complete"; reason=`legal strike release recorded from ${relevantLaunches[0].formationId ?? relevantLaunches[0].platformId}`;
      } else if (objective.kind === "observe" && criteria?.requiredSpaceWeatherPhases?.every((phase) => this.observedPhases.has(phase))) {
        state="complete"; reason=`required phases observed: ${criteria.requiredSpaceWeatherPhases.join(", ")}`;
      } else if (context.ended && (objective.kind === "protect" || objective.kind === "survive")) {
        state=alive.some(Boolean)?"complete":"failed"; reason=alive.some(Boolean)?"protected force survived to scenario end":"protected force did not survive";
      } else if (context.ended && objective.kind === "intercept") {
        state=forbiddenLaunch?"failed":"complete"; reason=forbiddenLaunch?"prohibited strike release occurred":"no prohibited strike release occurred";
      } else if (context.ended && objective.kind === "strike") {
        state=relevantLaunches.length?"complete":"failed"; reason=relevantLaunches.length?"required strike release occurred":"required strike release did not occur";
      } else if (context.ended && objective.kind === "observe") {
        state="failed"; reason="required observation phases were not all reached";
      }
      if (state !== previous) { this.states.set(objective.id,state); transitions.push({objectiveId:objective.id,previous,state,reason}); }
    }
    return transitions;
  }
}
