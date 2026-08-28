import type { AirCombatSystem } from "./runtime.js";

/** Keeps platform-specific diagnostic formatting out of the application assembly loop. */
export function writeSovietAirDiagnostics(
  dataset: DOMStringMap,
  airCombat: AirCombatSystem,
  elapsed: number,
  commandEra: string,
  commandEnabled: boolean,
) {
  const fighters = airCombat.aircraft.filter((aircraft) => aircraft.definition.id === "MIG-29A" || aircraft.definition.id === "MIG-29A-SEAD");
  const events = (pattern: RegExp) => airCombat.events
    .filter((event) => pattern.test(event.text))
    .map((event) => `${event.time.toFixed(2)}:${event.text}`).join("|");
  const seadAssignments = airCombat.sovietSeadAssignments(elapsed);
  dataset.sovietSeadAssignments = seadAssignments.map((assignment) => `${assignment.shooterId}:${assignment.role}:${assignment.emitterId}:${assignment.cueQuality.toFixed(2)}:${(assignment.expiresAt - elapsed).toFixed(1)}`).join("|");
  dataset.sovietSeadCapability = commandEra === "late-soviet" ? "ACTIVE" : "OFF";
  dataset.sovietSeadEventLog = events(/SEAD (?:PRIMARY|BACKUP|PASSIVE CUE)|SEAD RELEASE REJECTED|Kh-31P-C/);
  const bombers = airCombat.aircraft.filter((aircraft) => aircraft.definition.id === "TU-16K");
  const gci = airCombat.sovietGciDiagnostics(elapsed);
  dataset.sovietCommandEra = commandEra;
  dataset.sovietCommandEnabled = String(commandEnabled);
  dataset.gciOperational = String(gci.enabled);
  dataset.gciTransmitted = String(gci.transmitted);
  dataset.gciDelivered = String(gci.delivered);
  dataset.gciDropped = String(gci.dropped);
  dataset.gciActiveCommands = String(gci.activeCommands);
  dataset.gciMeanDelay = gci.meanDelay.toFixed(3);
  dataset.gciCommandStates = fighters.map((aircraft) => {
    const command = airCombat.gciCommandFor(aircraft.id, elapsed);
    return `${aircraft.id}:${command ? `${command.controllerTrackId}:${command.commandMode}:${command.quality.toFixed(2)}:${command.commandedSpeed.toFixed(1)}:${command.radarActivationRange.toFixed(0)}:${aircraft.position.distanceTo(command.interceptPoint).toFixed(1)}` : "none"}`;
  }).join("|");
  const standby = new Set(airCombat.sovietRadarStandbyParticipants());
  dataset.gciRadarStates = fighters.map((aircraft) => `${aircraft.id}:${standby.has(aircraft.id) ? "standby" : "search"}`).join("|");
  dataset.gciAirLocalTracks = fighters.map((aircraft) => `${aircraft.id}:${aircraft.tracks.size}`).join("|");
  dataset.gciTrackStates = fighters.flatMap((aircraft) => [...aircraft.tracks.values()].map((track) =>
    `${aircraft.id}:${track.targetId}:${track.classification}:${aircraft.position.distanceTo(track.position).toFixed(1)}:${track.quality.toFixed(2)}:${(elapsed - track.lastUpdate).toFixed(1)}`)).join("|");
  dataset.gciEventLog = events(/GCI COMMAND|MiG-29A Fulcrum-A DETECT|MiG-29A Fulcrum-A LAUNCH/);

  const maritime = airCombat.sovietMaritimeTargetingDiagnostics(elapsed);
  dataset.sovietMaritimeOperational = String(maritime.enabled);
  dataset.sovietMaritimeSource = maritime.sourceAvailable;
  dataset.sovietLegendaPassActive = String(maritime.passActive);
  dataset.sovietMaritimeTransmitted = String(maritime.transmitted);
  dataset.sovietMaritimeDelivered = String(maritime.delivered);
  dataset.sovietMaritimeDropped = String(maritime.dropped);
  dataset.sovietMaritimeActiveCues = String(maritime.activeCues);
  dataset.sovietMaritimeMeanDelay = maritime.meanDelay.toFixed(3);
  dataset.sovietMaritimeEmconObserved = [...standby].join("|");
  dataset.sovietMaritimeCueStates = bombers.map((aircraft) => {
    const cue = airCombat.maritimeTargetAreaCueFor(aircraft.id, elapsed);
    return `${aircraft.id}:${cue ? `${cue.source}:${cue.reportTrackId}:${cue.quality.toFixed(2)}:${cue.uncertaintyMajor.toFixed(1)}:${aircraft.position.distanceTo(cue.launchRegionCenter).toFixed(1)}` : "none"}`;
  }).join("|");
  dataset.sovietMaritimeRadarStates = bombers.map((aircraft) => {
    const cue = airCombat.maritimeTargetAreaCueFor(aircraft.id, elapsed);
    const radarStandby = aircraft.mission === "anti-ship" && !!cue && aircraft.tracks.size === 0 && aircraft.position.distanceTo(cue.launchRegionCenter) > 160;
    return `${aircraft.id}:${radarStandby ? "standby" : "search"}`;
  }).join("|");
  dataset.sovietMaritimeEventLog = events(/TARGET AREA RECEIVED|Tu-16K Badger-G DETECT|Tu-16K Badger-G LAUNCH KSR-5/);

  const command = airCombat.sovietFleetCommandDiagnostics(elapsed);
  dataset.sovietFleetCommandOperational = String(command.enabled);
  dataset.sovietFleetCommandNode = `${command.nodeId}:${command.nodeLabel}`;
  dataset.sovietFleetCommandNodeAlive = String(command.nodeAlive);
  dataset.sovietFleetCommandTransmitted = String(command.transmitted);
  dataset.sovietFleetCommandDelivered = String(command.delivered);
  dataset.sovietFleetCommandDropped = String(command.dropped);
  dataset.sovietFleetCommandActiveOrders = String(command.activeOrders);
  dataset.sovietFleetCommandMeanDelay = command.meanDelay.toFixed(3);
  dataset.sovietFleetCommandOrders = bombers.filter((aircraft) => aircraft.formationIndex === 0).map((aircraft) => {
    const order = airCombat.sovietFleetOrderFor(aircraft.id, elapsed);
    return `${aircraft.id}:${order ? `${order.id}:${order.sourceReportTrackId}:${order.attackWindowStart.toFixed(2)}:${order.attackWindowEnd.toFixed(2)}:${order.commandNodeId}` : "none"}`;
  }).join("|");
  dataset.sovietFleetCommandEventLog = events(/TARGET AREA RECEIVED|FLEET STRIKE ORDER|Tu-16K Badger-G DETECT|Tu-16K Badger-G LAUNCH KSR-5/);

  const salvo = airCombat.sovietSalvoDiagnostics(elapsed);
  dataset.sovietSalvoWavesPlanned = String(salvo.wavesPlanned);
  dataset.sovietSalvoAssignments = String(salvo.assignments);
  dataset.sovietSalvoActiveAssignments = String(salvo.activeAssignments);
  dataset.sovietSalvoArrivalSpread = salvo.meanArrivalSpread.toFixed(3);
  dataset.sovietSalvoPlanStates = bombers.map((aircraft) => {
    const plan = airCombat.sovietSalvoPlanFor(aircraft.id, elapsed);
    return `${aircraft.id}:${plan ? `${plan.waveId}:${plan.sequence}/${plan.total}:${plan.releaseAt.toFixed(2)}:${plan.plannedArrivalAt.toFixed(2)}:${plan.sourceReportTrackId}` : "none"}`;
  }).join("|");
  dataset.sovietSalvoEventLog = events(/TARGET AREA RECEIVED|FLEET STRIKE ORDER|SALVO ASSIGNMENT|Tu-16K Badger-G DETECT|Tu-16K Badger-G LAUNCH KSR-5/);
}
