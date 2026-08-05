import type { ScenarioDocument, ScenarioObjectiveDefinition } from "./types.js";

export type ScenarioObjectiveState = "pending" | "active" | "complete" | "failed";
export interface ScenarioRuntimeSnapshot {
  time: number;
  durationSeconds: number;
  phase: string;
  objectives: readonly { definition: ScenarioObjectiveDefinition; state: ScenarioObjectiveState }[];
  ended: boolean;
}

export class ScenarioRuntime {
  private time = 0;
  private phase = "quiet";
  private ended = false;
  private readonly objectiveStates = new Map<string, ScenarioObjectiveState>();
  constructor(readonly document: ScenarioDocument) { for (const objective of document.objectives) this.objectiveStates.set(objective.id,"active"); }
  update(time: number) {
    this.time=Math.max(this.time,time);
    for(const event of this.document.timeline) if(event.at<=this.time&&event.type==="space-weather-phase")this.phase=event.value;
    this.ended=this.time>=this.document.simulation.durationSeconds;
  }
  setObjective(id:string,state:ScenarioObjectiveState){if(!this.objectiveStates.has(id))throw new Error(`Unknown objective ${id}`);this.objectiveStates.set(id,state);}
  snapshot():ScenarioRuntimeSnapshot{return {time:this.time,durationSeconds:this.document.simulation.durationSeconds,phase:this.phase,objectives:this.document.objectives.map(definition=>({definition,state:this.objectiveStates.get(definition.id)!})),ended:this.ended};}
  reset(){this.time=0;this.phase="quiet";this.ended=false;for(const id of this.objectiveStates.keys())this.objectiveStates.set(id,"active");}
}
