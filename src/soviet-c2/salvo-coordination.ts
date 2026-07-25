import * as THREE from "three";
import type { SovietFleetStrikeOrder } from "./fleet-command.js";

export interface SovietSalvoParticipant {
  id: string;
  formationId: string;
  position: THREE.Vector3;
  alive: boolean;
  weaponReady: boolean;
}

export interface SovietSalvoTargetArea {
  reportTrackId: string;
  estimatedPosition: THREE.Vector3;
}

export interface SovietSalvoReleasePlan {
  id: string;
  waveId: string;
  participantId: string;
  sourceOrderId: string;
  sourceReportTrackId: string;
  searchPoint: THREE.Vector3;
  sequence: number;
  total: number;
  releaseAt: number;
  plannedArrivalAt: number;
  estimatedFlightTime: number;
  expiresAt: number;
}

export interface SovietSalvoDiagnostics {
  wavesPlanned: number;
  assignments: number;
  activeAssignments: number;
  meanArrivalSpread: number;
}

export class SovietSalvoCoordinator {
  private plans = new Map<string, SovietSalvoReleasePlan>();
  private plannedOrders = new Set<string>();
  private waveSerial = 0;
  private wavesPlanned = 0;
  private assignmentsIssued = 0;
  private totalArrivalSpread = 0;

  reset() {
    this.plans.clear();
    this.plannedOrders.clear();
    this.waveSerial = 0;
    this.wavesPlanned = 0;
    this.assignmentsIssued = 0;
    this.totalArrivalSpread = 0;
  }

  update(input: {
    time: number;
    order: SovietFleetStrikeOrder | undefined;
    participants: readonly SovietSalvoParticipant[];
    targetArea: SovietSalvoTargetArea | undefined;
    weaponSpeed: number;
  }) {
    for (const [participantId, plan] of this.plans) {
      if (input.time > plan.expiresAt ||
        !input.participants.some((participant) => participant.id === participantId && participant.alive && participant.weaponReady))
        this.plans.delete(participantId);
    }
    const order = input.order;
    if (!order || !input.targetArea || this.plannedOrders.has(order.id)) return;
    const eligible = input.participants
      .filter((participant) => participant.alive && participant.weaponReady)
      .sort((left, right) => left.id.localeCompare(right.id));
    if (!eligible.length) return;
    const speed = Math.max(1, input.weaponSpeed);
    const flightTimes = eligible.map((participant) =>
      participant.position.distanceTo(input.targetArea!.estimatedPosition) / speed);
    const maximumFlightTime = Math.max(...flightTimes);
    const desiredArrival = Math.max(
      order.attackWindowStart + maximumFlightTime + 1,
      input.time + maximumFlightTime + 1,
    );
    const waveId = `SOVIET-SALVO-${++this.waveSerial}`;
    const plannedArrivals: number[] = [];
    for (let index = 0; index < eligible.length; index++) {
      const participant = eligible[index];
      const flightTime = flightTimes[index];
      const releaseAt = THREE.MathUtils.clamp(
        desiredArrival - flightTime,
        order.attackWindowStart,
        Math.max(order.attackWindowStart, order.attackWindowEnd - 0.75),
      );
      const plannedArrivalAt = releaseAt + flightTime;
      plannedArrivals.push(plannedArrivalAt);
      this.plans.set(participant.id, {
        id: `${waveId}-${index + 1}`,
        waveId,
        participantId: participant.id,
        sourceOrderId: order.id,
        sourceReportTrackId: input.targetArea.reportTrackId,
        searchPoint: input.targetArea.estimatedPosition.clone(),
        sequence: index + 1,
        total: eligible.length,
        releaseAt,
        plannedArrivalAt,
        estimatedFlightTime: flightTime,
        expiresAt: order.attackWindowEnd + 3,
      });
    }
    this.plannedOrders.add(order.id);
    this.wavesPlanned++;
    this.assignmentsIssued += eligible.length;
    this.totalArrivalSpread += Math.max(...plannedArrivals) - Math.min(...plannedArrivals);
  }

  planFor(participantId: string, time: number) {
    const plan = this.plans.get(participantId);
    return plan && time <= plan.expiresAt ? plan : undefined;
  }

  diagnostics(time: number): SovietSalvoDiagnostics {
    return {
      wavesPlanned: this.wavesPlanned,
      assignments: this.assignmentsIssued,
      activeAssignments: [...this.plans.values()].filter((plan) => plan.expiresAt >= time).length,
      meanArrivalSpread: this.wavesPlanned ? this.totalArrivalSpread / this.wavesPlanned : 0,
    };
  }
}
