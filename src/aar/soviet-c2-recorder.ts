import type { AarEvent, AarSovietC2Snapshot } from "../combat-types.js";
import type { SovietC2Observation } from "../soviet-c2/observability.js";

export interface SovietC2AarSample {
  snapshot: AarSovietC2Snapshot;
  events: AarEvent[];
}

export class SovietC2AarRecorder {
  private seen = new Set<string>();
  private configuration = "";

  reset() {
    this.seen.clear();
    this.configuration = "";
  }

  sample(observation: SovietC2Observation, time: number): SovietC2AarSample {
    const events: AarEvent[] = [];
    const configuration = `${observation.era}|${observation.enabled}`;
    if (configuration !== this.configuration) {
      events.push({
        time,
        category: "network",
        text: `SOVIET C2 / ERA ${observation.era.toUpperCase()} / ${observation.enabled ? "ENABLED" : "DISCONNECTED"}`,
      });
      this.configuration = configuration;
    }
    const emitOnce = (key: string, eventTime: number, text: string) => {
      if (this.seen.has(key)) return;
      this.seen.add(key);
      events.push({ time: eventTime, category: "network", text });
    };
    for (const command of observation.gciCommands)
      emitOnce(`gci:${command.id}`, command.deliveredAt,
        `SOVIET GCI COMMAND / ${command.participantId} / CONTROLLER TRACK ${command.controllerTrackId} / ${command.commandMode.toUpperCase()} / SPEED ${command.commandedSpeed.toFixed(1)} / RADAR ${command.radarActivationRange.toFixed(0)} / CUE ONLY`);
    for (const area of observation.maritimeAreas)
      emitOnce(`area:${area.id}`, area.deliveredAt,
        `SOVIET STRATEGIC TARGET-AREA CUE / ${area.source.toUpperCase()} / REPORT ${area.reportTrackId} / ${area.participantId} / NO WEAPON AUTHORITY`);
    for (const order of observation.fleetOrders)
      emitOnce(`order:${order.id}`, order.deliveredAt,
        `SOVIET FLEET MISSION ORDER / ${order.id} / ${order.participantId} / SOURCE ${order.sourceReportTrackId} / NO WEAPON AUTHORITY`);
    for (const assignment of observation.salvoAssignments)
      emitOnce(`salvo:${assignment.id}`, time,
        `SOVIET SALVO RELEASE PLAN / ${assignment.waveId} / ${assignment.participantId} / ROUND ${assignment.sequence}/${assignment.total} / RELEASE ${assignment.releaseAt.toFixed(1)} / ARRIVAL ${assignment.plannedArrivalAt.toFixed(1)}`);
    return {
      events: events.sort((left, right) => left.time - right.time),
      snapshot: {
        era: observation.era,
        enabled: observation.enabled,
        nodes: observation.nodes.map((node) => ({ id: node.id, kind: node.kind, label: node.label, x: node.position.x, y: node.position.y, z: node.position.z, operational: node.operational })),
        gciCommands: observation.gciCommands.map((command) => ({ id: command.id, participantId: command.participantId, controllerTrackId: command.controllerTrackId, x: command.interceptPoint.x, y: command.interceptPoint.y, z: command.interceptPoint.z, quality: command.quality, uncertainty: command.uncertainty, commandedSpeed: command.commandedSpeed, radarActivationRange: command.radarActivationRange, commandMode: command.commandMode, expiresAt: command.expiresAt })),
        maritimeAreas: observation.maritimeAreas.map((area) => ({ id: area.id, participantId: area.participantId, reportTrackId: area.reportTrackId, source: area.source, x: area.estimatedPosition.x, y: area.estimatedPosition.y, z: area.estimatedPosition.z, uncertaintyMajor: area.uncertaintyMajor, uncertaintyMinor: area.uncertaintyMinor, uncertaintyBearing: area.uncertaintyBearing, quality: area.quality, expiresAt: area.expiresAt })),
        fleetOrders: observation.fleetOrders.map((order) => ({ id: order.id, participantId: order.participantId, commandNodeId: order.commandNodeId, sourceReportTrackId: order.sourceReportTrackId, x: order.approachPoint.x, y: order.approachPoint.y, z: order.approachPoint.z, attackWindowStart: order.attackWindowStart, attackWindowEnd: order.attackWindowEnd, expiresAt: order.expiresAt })),
        salvoAssignments: observation.salvoAssignments.map((assignment) => ({ id: assignment.id, waveId: assignment.waveId, participantId: assignment.participantId, sourceOrderId: assignment.sourceOrderId, sourceReportTrackId: assignment.sourceReportTrackId, sequence: assignment.sequence, total: assignment.total, releaseAt: assignment.releaseAt, plannedArrivalAt: assignment.plannedArrivalAt, x: assignment.participantPosition.x, y: assignment.participantPosition.y, z: assignment.participantPosition.z, expiresAt: assignment.expiresAt })),
      },
    };
  }
}
