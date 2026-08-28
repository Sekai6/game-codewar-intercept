import type { AarEvent, AarSnapshot } from "../combat-types";

export type AcmiExportOptions = {
  title: string;
  referenceTime: Date;
  referenceLatitude?: number;
  referenceLongitude?: number;
  blueShipName: string;
};

type AcmiObject = {
  key: string;
  name: string;
  type: string;
  coalition: "Blue" | "Red" | "Neutral";
  x: number;
  y: number;
  z: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  speed?: number;
  verticalSpeed?: number;
  health?: number;
  state?: string;
  disabled?: boolean;
  parent?: string;
  target?: string | number;
  properties?: Record<string, string | number>;
};

function isTerminal(object: AcmiObject): boolean {
  return object.disabled === true || object.state === "destroyed";
}

const WORLD_METERS = 100;
const ALTITUDE_METERS = 50;

function clean(value: string): string {
  return value.replace(/[\r\n,=]/g, " ").trim();
}

function coordinates(
  object: AcmiObject,
  latitude: number,
  longitude: number,
): string {
  const north = -object.z * WORLD_METERS;
  const east = object.x * WORLD_METERS;
  const lat = latitude + north / 111_320;
  const lon = longitude + east / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const altitude = Math.max(0, object.y * ALTITUDE_METERS);
  const heading = (((object.heading ?? 0) * 180) / Math.PI + 360) % 360;
  const pitch = ((object.pitch ?? 0) * 180) / Math.PI;
  const roll = ((object.roll ?? 0) * 180) / Math.PI;
  return `${lon.toFixed(7)}|${lat.toFixed(7)}|${altitude.toFixed(1)}|${roll.toFixed(2)}|${pitch.toFixed(2)}|${heading.toFixed(2)}`;
}

function frameObjects(snapshot: AarSnapshot, blueShipName: string): AcmiObject[] {
  const objects: AcmiObject[] = [
    {
      key: "ship:blue",
      name: blueShipName,
      type: "Sea+Warship",
      coalition: "Blue",
      health: snapshot.ship.hull,
      state: "surface-combatant",
      ...snapshot.ship,
    },
  ];
  if (snapshot.spaceWeather) objects.push({
    key: "environment:space-weather", name: "Space Weather", type: "Misc+Waypoint",
    coalition: "Neutral", x: 0, y: 0, z: 0, state: snapshot.spaceWeather.phase,
    properties: {
      Intensity: snapshot.spaceWeather.intensity.toFixed(3),
      HFAvailability: snapshot.spaceWeather.hfAvailability.toFixed(3),
      VhfUhfReliability: snapshot.spaceWeather.vhfUhfReliability.toFixed(3),
      SatelliteReliability: snapshot.spaceWeather.satelliteReliability.toFixed(3),
      GnssQuality: snapshot.spaceWeather.gnssQuality.toFixed(3),
      RadarNoise: snapshot.spaceWeather.radarNoise.toFixed(3),
      MagneticDisturbance: snapshot.spaceWeather.magneticDisturbance.toFixed(3),
      CommunicationWindowOpen: snapshot.spaceWeather.communicationWindowOpen ? 1 : 0,
      CommunicationWindowStrength: snapshot.spaceWeather.communicationWindowStrength.toFixed(3),
    },
  });
  if (snapshot.fleet) {
    objects.splice(0, 1);
    for (const member of snapshot.fleet.members) {
      const audit = snapshot.decisions?.find((decision) => decision.platformId === member.id);
      objects.push({
        key: `fleet-ship:${member.id}`,
        name: `${member.name} ${member.hullNumber}`,
        type: "Sea+Warship",
        coalition: member.side === "blue" ? "Blue" : "Red",
        x: member.x, y: member.y, z: member.z,
        heading: member.heading,
        speed: member.speedKnots,
        health: member.hull,
        state: member.alive ? "operational" : "destroyed",
        disabled: !member.alive,
        properties: {
          ForceId: snapshot.fleet.id,
          FormationRole: member.formationRole,
          CommandRoles: member.commandRoles.join("|"),
          StationStatus: member.stationStatus,
          StationError: member.stationError.toFixed(1),
          SAM_RIM67: member.magazines.rim67,
          SAM_SM2MR: member.magazines.sm2mr,
          SAM_SM2ER: member.magazines.sm2er,
          LocalTracks: member.localTracks,
          NetworkTracks: member.networkTracks,
          CommsConnected: member.commsConnected === false ? 0 : 1,
          LostCommsDoctrine: member.lostCommsDoctrine ?? "networked",
          DecisionAction: audit?.action ?? "unknown",
          DecisionReason: audit?.reason ?? "not-recorded",
          DecisionTarget: audit?.targetId ?? "none",
          DecisionTrackSource: audit?.trackSource ?? "none",
          DecisionBestTrack: audit?.bestTrackId ?? "none",
          DecisionTrackClassification: audit?.trackClassification ?? "unknown",
          DecisionTrackUncertainty: (audit?.trackUncertainty ?? 0).toFixed(1),
          DecisionTrackAge: (audit?.trackAge ?? 0).toFixed(2),
          DecisionWeaponAuthority: String(audit?.weaponAuthority ?? false),
          DecisionTrackQuality: (audit?.trackQuality ?? 0).toFixed(3),
        },
      });
    }
    for (const track of snapshot.fleet.tracks) {
      objects.push({
        key: `fleet-track:${track.id}`,
        name: `FLEET CUE ${track.classification} ${track.id}`,
        type: "Misc+Bullseye", coalition: "Neutral", x: 0, y: 0, z: 0,
        state: "cue-only",
        properties: { ForceId: snapshot.fleet.id, Contributors: track.contributors.join("|"), TrackQuality: track.quality.toFixed(3), Uncertainty: track.uncertainty.toFixed(1), TrackAge: track.age.toFixed(2), EngagementQuality: "Cue", WeaponAuthority: "No" },
      });
    }
  }
  if (snapshot.enemyPlatform)
    objects.push({
      key: "ship:red",
      name: snapshot.enemyPlatform.name,
      type: "Sea+Warship",
      coalition: "Red",
      x: snapshot.enemyPlatform.x,
      y: snapshot.enemyPlatform.y,
      z: snapshot.enemyPlatform.z,
      heading: snapshot.enemyPlatform.heading,
      pitch: snapshot.enemyPlatform.pitch,
      roll: snapshot.enemyPlatform.roll,
      speed: snapshot.enemyPlatform.speed,
      verticalSpeed: snapshot.enemyPlatform.verticalSpeed,
      health: snapshot.enemyPlatform.hull,
      state: snapshot.enemyPlatform.destroyed ? "destroyed" : "operational",
      disabled: snapshot.enemyPlatform.destroyed,
    });
  for (const item of snapshot.missiles)
    objects.push({ key: `threat:${item.id}`, name: item.threatType, type: "Weapon+Missile", coalition: "Red", state: item.phase, parent: item.parentId, ...item });
  for (const item of snapshot.interceptors)
    objects.push({ key: `sam:${item.id}`, name: item.weapon, type: "Weapon+Missile", coalition: "Blue", target: item.targetId, parent: item.shooterId ?? "blue-surface-ship", state: "engaged", ...item });
  for (const item of snapshot.surfaceStrikes)
    objects.push({ key: `surface:${item.id}`, name: "RGM-84 Harpoon", type: "Weapon+Missile", coalition: "Blue", target: item.targetId ?? "red-surface-ship", parent: "blue-surface-ship", state: item.phase, ...item });
  for (const item of snapshot.aircraft) {
    const audit = snapshot.decisions?.find((decision) => decision.platformId === item.id);
    objects.push({ key: `aircraft:${item.id}`, type: "Air+FixedWing", coalition: item.side === "blue" ? "Blue" : "Red", health: item.structure, disabled: !item.alive, ...item, state: `${item.mission}/${item.state}`, properties:{DecisionAction:audit?.action??item.state,DecisionReason:audit?.reason??"not-recorded",DecisionTarget:audit?.targetId??item.targetId??"none",DecisionTrackSource:audit?.trackSource??item.bestTrackSource??"none",DecisionTrackQuality:(audit?.trackQuality??item.bestTrackQuality??0).toFixed(3),DecisionBestTrack:audit?.bestTrackId??"none",DecisionTrackClassification:audit?.trackClassification??"unknown",DecisionTrackUncertainty:(audit?.trackUncertainty??0).toFixed(1),DecisionTrackAge:(audit?.trackAge??0).toFixed(2),DecisionWeaponAuthority:String(audit?.weaponAuthority??false),LocalTracks:item.localTracks??0,NetworkTracks:item.networkTracks??0,BestTrackSource:item.bestTrackSource??"none",BestTrackQuality:(item.bestTrackQuality??0).toFixed(3),CommsState:audit?.commsState??"connected",LostCommsDoctrine:item.lostCommsDoctrine??"networked",TacticalState:item.tacticalState??"unknown",SovietSeadConcept:item.mission === "sead" ? "LATE_SOVIET_CONCEPT" : "none",SovietSeadMissionState:item.sovietSeadState??"none",SeadShooterRole:item.sovietSeadRole??"none",ArmTargetEmitter:item.sovietSeadEmitter??"none",GciEmitterCueQuality:(item.sovietSeadCueQuality??0).toFixed(3)} });
  }
  for (const item of snapshot.airWeapons)
    objects.push({ key: `airweapon:${item.id}`, type: "Weapon+Missile", coalition: item.side === "blue" ? "Blue" : "Red", target: item.targetId, parent: item.shooterId, ...item, state: item.phase, properties:{SeekerAcquired:item.seekerAcquired?1:0,ArmSeekerMode:item.armSeekerMode??"none",ArmTargetEmitter:item.targetEmitterId??"none",ArmMemoryExpires:(item.armMemoryExpiresAt??0).toFixed(2),MidcourseLastUpdate:(item.midcourseLastUpdateAt??0).toFixed(2),MidcourseTrackQuality:(item.midcourseTrackQuality??0).toFixed(3),MidcourseUncertainty:(item.midcourseUncertainty??0).toFixed(1),MidcourseLinkLostSeconds:(item.midcourseLinkLostSeconds??0).toFixed(2),InertialContinuation:item.inertialContinuation?1:0,AutonomousSearchAuthorized:item.autonomousSearchAuthorized?1:0,MidcourseSource:item.midcourseSource??"none"} });
  for (const item of snapshot.chaff)
    objects.push({ key: `chaff:${item.id}`, name: "Chaff", type: "Misc+Decoy", coalition: item.side === "platform" || item.side === "threat" ? "Red" : "Blue", ...item });
  for (const item of snapshot.airDecoys)
    objects.push({ key: `airdecoy:${item.id}`, name: item.type, coalition: item.side === "blue" ? "Blue" : "Red", ...item, type: "Misc+Decoy", state: item.alive ? "active" : "expired" });
  for (const node of snapshot.datalink?.nodes ?? [])
    objects.push({
      key: `network-node:${node.network}:${node.id}`,
      name: `${node.network.toUpperCase()} ${node.id}${node.role === "ncs" ? " NCS" : ""}`,
      type: "Misc+Waypoint",
      coalition: "Blue",
      x: node.x, y: node.y, z: node.z,
      state: node.transmitEnabled && node.receiveEnabled ? "online" : "degraded",
      properties: { Network: node.network, Role: node.role, TerminalHealth: node.terminalHealth.toFixed(1) },
    });
  for (const track of snapshot.datalink?.tracks ?? [])
    objects.push({
      // Network estimates deliberately never share aliases with truth objects.
      key: `network-track:${track.network}:${track.id}`,
      name: `${track.network.toUpperCase()} EST ${track.id}`,
      type: "Misc+Bullseye",
      coalition: "Neutral",
      x: track.x, y: track.y, z: track.z,
      state: "cue-only",
      properties: {
        Network: track.network,
        Classification: track.classification,
        TrackQuality: track.quality.toFixed(3),
        TrackAge: track.age.toFixed(2),
        Uncertainty: track.uncertainty.toFixed(1),
        EngagementQuality: "Cue",
        Source: track.senderId ?? "unknown",
      },
    });
  for (const node of snapshot.sovietC2?.nodes ?? [])
    objects.push({
      key: `soviet-c2-node:${node.id}`,
      name: `SOVIET C2 ${node.label}`,
      type: "Misc+Waypoint",
      coalition: "Red",
      x: node.x, y: node.y, z: node.z,
      state: node.operational ? "operational" : "offline",
      properties: { C2Layer: node.kind, Era: snapshot.sovietC2?.era ?? "unknown" },
    });
  for (const command of snapshot.sovietC2?.gciCommands ?? [])
    objects.push({
      key: `soviet-gci-command:${command.id}`,
      name: `GCI INTERCEPT ${command.controllerTrackId}`,
      type: "Misc+Waypoint",
      coalition: "Neutral",
      x: command.x, y: command.y, z: command.z,
      state: "command-cue-only",
      properties: { C2Layer: "GCI", Participant: command.participantId, CommandMode: command.commandMode, CommandedSpeed: command.commandedSpeed.toFixed(1), RadarActivationRange: command.radarActivationRange.toFixed(0), TrackQuality: command.quality.toFixed(3), Uncertainty: command.uncertainty.toFixed(1), WeaponAuthority: "No" },
    });
  for(const command of snapshot.aewCommands??[])
    objects.push({
      key:`aew-command:${command.id}`,
      name:`AEW ${command.mode.toUpperCase()} ${command.controllerTrackId}`,
      type:"Misc+Waypoint",coalition:"Neutral",x:command.x,y:command.y,z:command.z,
      state:"command-cue-only",
      properties:{C2Layer:"AEWInterceptControl",Controller:command.controllerId,Participant:command.participantId,CommandMode:command.mode,ControllerTrack:command.controllerTrackId,TrackQuality:command.quality.toFixed(3),Uncertainty:command.uncertainty.toFixed(1),CommandedSpeed:command.commandedSpeed.toFixed(1),RadarActivationRange:command.radarActivationRange.toFixed(0),WeaponAuthority:"No"},
    });
  for (const area of snapshot.sovietC2?.maritimeAreas ?? [])
    objects.push({
      key: `soviet-target-area:${area.id}`,
      name: `${area.source.toUpperCase()} EST ${area.reportTrackId}`,
      type: "Misc+Bullseye",
      coalition: "Neutral",
      x: area.x, y: area.y, z: area.z,
      state: "strategic-target-area-cue",
      properties: { C2Layer: "MaritimeTargetIndication", Participant: area.participantId, Report: area.reportTrackId, TrackQuality: area.quality.toFixed(3), UncertaintyMajor: area.uncertaintyMajor.toFixed(1), UncertaintyMinor: area.uncertaintyMinor.toFixed(1), UncertaintyBearing: area.uncertaintyBearing.toFixed(3), WeaponAuthority: "No" },
    });
  for (const order of snapshot.sovietC2?.fleetOrders ?? [])
    objects.push({
      key: `soviet-fleet-order:${order.id}`,
      name: `FLEET ORDER ${order.id}`,
      type: "Misc+Waypoint",
      coalition: "Neutral",
      x: order.x, y: order.y, z: order.z,
      state: "mission-order-no-weapon-authority",
      properties: { C2Layer: "FleetCommand", Participant: order.participantId, CommandNode: order.commandNodeId, SourceReport: order.sourceReportTrackId, AttackWindowStart: order.attackWindowStart.toFixed(2), AttackWindowEnd: order.attackWindowEnd.toFixed(2), WeaponAuthority: "No" },
    });
  for (const assignment of snapshot.sovietC2?.salvoAssignments ?? [])
    objects.push({
      key: `soviet-salvo:${assignment.id}`,
      name: `${assignment.waveId} ${assignment.sequence}/${assignment.total}`,
      type: "Misc+Waypoint",
      coalition: "Neutral",
      x: assignment.x, y: assignment.y, z: assignment.z,
      state: "planned-release",
      properties: { C2Layer: "SalvoCoordination", Participant: assignment.participantId, SourceOrder: assignment.sourceOrderId, SourceReport: assignment.sourceReportTrackId, ReleaseAt: assignment.releaseAt.toFixed(2), PlannedArrivalAt: assignment.plannedArrivalAt.toFixed(2), WeaponAuthority: "OrganicTrackRequired" },
    });
  return objects;
}

export function exportTacviewAcmi(
  snapshots: readonly AarSnapshot[],
  events: readonly AarEvent[],
  options: AcmiExportOptions,
): string {
  const latitude = options.referenceLatitude ?? 31.2;
  const longitude = options.referenceLongitude ?? 121.5;
  const ids = new Map<string, number>();
  const aliases = new Map<string, string>([
    ["blue-surface-ship", "ship:blue"],
    ["red-surface-ship", "ship:red"],
  ]);
  for (const snapshot of snapshots) {
    for (const member of snapshot.fleet?.members ?? []) {
      aliases.set(member.id, `fleet-ship:${member.id}`);
      if (member.commandRoles.includes("otc")) aliases.set("blue-surface-ship", `fleet-ship:${member.id}`);
    }
  }
  for (const snapshot of snapshots) {
    for (const aircraft of snapshot.aircraft)
      aliases.set(aircraft.id, `aircraft:${aircraft.id}`);
    for (const weapon of snapshot.airWeapons)
      aliases.set(weapon.id, `airweapon:${weapon.id}`);
    for (const missile of snapshot.missiles)
      aliases.set(String(missile.id), `threat:${missile.id}`);
  }
  let nextId = 100;
  const idFor = (key: string) => {
    if (!ids.has(key)) ids.set(key, nextId++);
    return ids.get(key)!;
  };
  const referenceKey = (reference: string | number): string | undefined => {
    const value = String(reference);
    if (aliases.has(value)) return aliases.get(value);
    if (value === "ship:blue" || value === "ship:red") return value;
    if (value.startsWith("air-weapon-")) return `airweapon:${value}`;
    if (value.startsWith("airweapon:")) return value;
    if (value.startsWith("aircraft:")) return value;
    if (/^(blue|red)-/.test(value)) return `aircraft:${value}`;
    if (/^\d+$/.test(value)) return `threat:${value}`;
    return undefined;
  };
  const lines = [
    "FileType=text/acmi/tacview",
    "FileVersion=2.2",
    `0,ReferenceTime=${options.referenceTime.toISOString()}`,
    `0,Title=${clean(options.title)}`,
    `0,DataLink=${clean(snapshots[0]?.datalink?.era ?? "none")}`,
    `0,DataLinkEnabled=${snapshots[0]?.datalink?.enabled ? 1 : 0}`,
    `0,SovietCommandEra=${clean(snapshots[0]?.sovietC2?.era ?? "none")}`,
    `0,SovietCommandEnabled=${snapshots[0]?.sovietC2?.enabled ? 1 : 0}`,
    `0,ReferenceLatitude=${latitude.toFixed(7)}`,
    `0,ReferenceLongitude=${longitude.toFixed(7)}`,
  ];
  let previous = new Set<string>();
  const terminated = new Set<string>();
  let eventIndex = 0;
  for (const snapshot of snapshots) {
    lines.push(`#${snapshot.time.toFixed(2)}`);
    const objects = frameObjects(snapshot, options.blueShipName).filter(
      (object) => !terminated.has(object.key),
    );
    const current = new Set(objects.map((object) => object.key));
    for (const key of previous)
      if (!current.has(key)) {
        lines.push(`-${idFor(key)}`);
      }
    for (const object of objects) {
      const id = idFor(object.key);
      const properties = [`T=${coordinates(object, latitude, longitude)}`];
      let firedBy: number | undefined;
      if (object.speed !== undefined) properties.push(`Speed=${object.speed.toFixed(2)}`);
      if (object.verticalSpeed !== undefined)
        properties.push(`VerticalSpeed=${object.verticalSpeed.toFixed(2)}`);
      if (object.health !== undefined)
        properties.push(`Health=${Math.max(0, object.health).toFixed(1)}`);
      if (object.state) properties.push(`State=${clean(object.state)}`);
      if (object.disabled !== undefined)
        properties.push(`Disabled=${object.disabled ? 1 : 0}`);
      for (const [key, value] of Object.entries(object.properties ?? {}))
        properties.push(`${clean(key)}=${clean(String(value))}`);
      if (!previous.has(object.key)) {
        properties.push(`Type=${object.type}`, `Name=${clean(object.name)}`, `Coalition=${object.coalition}`);
        const targetKey = object.target === undefined ? undefined : referenceKey(object.target);
        const parentKey = object.parent === undefined ? undefined : referenceKey(object.parent);
        if (targetKey) properties.push(`Target=${idFor(targetKey)}`);
        if (parentKey) properties.push(`Parent=${idFor(parentKey)}`);
        if (parentKey && object.type.includes("Weapon")) firedBy = idFor(parentKey);
      }
      lines.push(`${id},${properties.join(",")}`);
      if (firedBy !== undefined) lines.push(`0,Event=HasFired|${firedBy}|${id}`);
      if (isTerminal(object)) {
        lines.push(`0,Event=Destroyed|${id}`);
        lines.push(`-${id}`);
        terminated.add(object.key);
        current.delete(object.key);
      }
    }
    while (eventIndex < events.length && events[eventIndex].time <= snapshot.time + 0.001) {
      lines.push(`0,Event=Message|${clean(events[eventIndex].text)}`);
      eventIndex++;
    }
    previous = current;
  }
  for (const key of previous) lines.push(`-${idFor(key)}`);
  return `${lines.join("\n")}\n`;
}
