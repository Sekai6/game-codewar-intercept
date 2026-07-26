import type { ShipPhysicalLaunch } from "../ships/launcher-adapter.js";

export interface FleetPhysicalLaunchObservation {
  shipId: string;
  launcherLabel: string;
  launchPoint: string;
  weapon: string;
  time: number;
}

/** Keeps a bounded, entity-level record for UI/camera/AAR consumers. */
export class FleetLaunchObservability {
  private readonly events: FleetPhysicalLaunchObservation[] = [];

  record(event: ShipPhysicalLaunch, time: number): void {
    this.events.push({
      shipId: event.ship.id,
      launcherLabel: event.launcherLabel,
      launchPoint: event.launchPoint,
      weapon: event.order.weapon,
      time,
    });
    if (this.events.length > 32) this.events.splice(0, this.events.length - 32);
  }

  recent(maxAge: number, now: number): readonly FleetPhysicalLaunchObservation[] {
    return this.events.filter((event) => now - event.time <= maxAge);
  }

  all(): readonly FleetPhysicalLaunchObservation[] {
    return this.events;
  }
}
