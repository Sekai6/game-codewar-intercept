import * as THREE from "three";
import type {
  Link16Delivery,
  Link16Diagnostics,
  Link16ParticipantState,
  Link16TrackReport,
  TacticalNetworkActivity,
} from "./types.js";

export interface Link16NetworkOptions {
  frameSeconds: number;
  slotsPerFrame: number;
  baseLatency: number;
  maximumRange: number;
  trackReportTtl: number;
}

const DEFAULT_OPTIONS: Link16NetworkOptions = {
  frameSeconds: 1,
  slotsPerFrame: 12,
  baseLatency: 0.18,
  maximumRange: 1800,
  trackReportTtl: 8,
};

type QueuedReport = { report: Link16TrackReport; queuedAt: number };
type PendingDelivery = Link16Delivery & { deliverAt: number };

function hash01(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function cloneReport(report: Link16TrackReport): Link16TrackReport {
  return {
    ...report,
    position: report.position.clone(),
    velocity: report.velocity.clone(),
    relayChain: [...report.relayChain],
  };
}

export class Link16Network {
  private readonly options: Link16NetworkOptions;
  private readonly participants = new Map<string, Link16ParticipantState>();
  private readonly queue: QueuedReport[] = [];
  private readonly pending: PendingDelivery[] = [];
  private readonly inboxes = new Map<string, Link16Delivery[]>();
  private readonly seenObservations = new Map<string, number>();
  private readonly activities: TacticalNetworkActivity[] = [];
  private nextFrameAt = 0;
  private serial = 0;
  private delayTotal = 0;
  private diagnosticsState: Link16Diagnostics = {
    queued: 0,
    transmitted: 0,
    delivered: 0,
    droppedCapacity: 0,
    droppedLink: 0,
    droppedDuplicate: 0,
    meanDelay: 0,
  };

  constructor(options: Partial<Link16NetworkOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  reset() {
    this.participants.clear();
    this.queue.length = 0;
    this.pending.length = 0;
    this.inboxes.clear();
    this.seenObservations.clear();
    this.activities.length = 0;
    this.nextFrameAt = 0;
    this.serial = 0;
    this.delayTotal = 0;
    this.diagnosticsState = {
      queued: 0,
      transmitted: 0,
      delivered: 0,
      droppedCapacity: 0,
      droppedLink: 0,
      droppedDuplicate: 0,
      meanDelay: 0,
    };
  }

  upsertParticipant(state: Link16ParticipantState) {
    this.participants.set(state.id, {
      ...state,
      position: state.position.clone(),
      terminalHealth: THREE.MathUtils.clamp(state.terminalHealth, 0, 1),
      timeSyncQuality: THREE.MathUtils.clamp(state.timeSyncQuality, 0, 1),
    });
  }

  publishTrack(
    senderId: string,
    input: Omit<Link16TrackReport, "messageId" | "senderId" | "side" | "transmittedAt">,
    time: number,
  ) {
    const sender = this.participants.get(senderId);
    if (!sender?.alive || !sender.transmitEnabled || sender.terminalHealth <= 0.05)
      return false;
    const report: Link16TrackReport = {
      ...input,
      messageId: `J3.2-${++this.serial}`,
      senderId,
      side: sender.side,
      transmittedAt: time,
      position: input.position.clone(),
      velocity: input.velocity.clone(),
      relayChain: [...input.relayChain, senderId],
    };
    this.queue.push({ report, queuedAt: time });
    this.diagnosticsState.queued++;
    return true;
  }

  update(time: number) {
    while (time >= this.nextFrameAt) {
      this.transmitFrame(this.nextFrameAt);
      this.nextFrameAt += this.options.frameSeconds;
    }
    for (let index = this.pending.length - 1; index >= 0; index--) {
      const delivery = this.pending[index];
      if (delivery.deliverAt > time) continue;
      this.pending.splice(index, 1);
      const duplicateKey = `${delivery.recipientId}:${delivery.report.observationId}`;
      if (this.seenObservations.has(duplicateKey)) {
        this.diagnosticsState.droppedDuplicate++;
        continue;
      }
      this.seenObservations.set(duplicateKey, time);
      const inbox = this.inboxes.get(delivery.recipientId) ?? [];
      inbox.push(delivery);
      this.inboxes.set(delivery.recipientId, inbox);
      this.diagnosticsState.delivered++;
      this.record({kind:"deliver",time,senderId:delivery.report.senderId,
        recipientId:delivery.recipientId,trackId:delivery.report.trackId,delay:delivery.networkDelay});
      this.delayTotal += delivery.networkDelay;
    }
    for (const [key, seenAt] of this.seenObservations)
      if (time - seenAt > this.options.trackReportTtl * 2)
        this.seenObservations.delete(key);
    this.diagnosticsState.meanDelay = this.diagnosticsState.delivered
      ? this.delayTotal / this.diagnosticsState.delivered
      : 0;
  }

  private transmitFrame(frameTime: number) {
    this.queue.sort(
      (left, right) =>
        ({ emergency: 0, threat: 1, routine: 2 }[left.report.priority] -
          { emergency: 0, threat: 1, routine: 2 }[right.report.priority]) ||
        left.queuedAt - right.queuedAt,
    );
    const selected = this.queue.splice(0, this.options.slotsPerFrame);
    if (this.queue.length > this.options.slotsPerFrame * 3) {
      const maximumQueued = this.options.slotsPerFrame * 3;
      const excess = this.queue.splice(maximumQueued);
      this.diagnosticsState.droppedCapacity += excess.length;
    }
    for (let slot = 0; slot < selected.length; slot++) {
      const { report } = selected[slot];
      const sender = this.participants.get(report.senderId);
      if (!sender) continue;
      this.diagnosticsState.transmitted++;
      this.record({kind:"transmit",time:frameTime,senderId:sender.id,trackId:report.trackId});
      for (const recipient of this.participants.values()) {
        if (
          recipient.id === sender.id ||
          recipient.side !== sender.side ||
          !recipient.alive ||
          !recipient.receiveEnabled ||
          recipient.terminalHealth <= 0.05 ||
          report.relayChain.includes(recipient.id)
        ) continue;
        const range = sender.position.distanceTo(recipient.position);
        if (range > this.options.maximumRange) {
          this.diagnosticsState.droppedLink++;
          continue;
        }
        const rangeFactor = range / this.options.maximumRange;
        const successProbability = THREE.MathUtils.clamp(
          0.995 * sender.terminalHealth * recipient.terminalHealth *
            Math.min(sender.timeSyncQuality, recipient.timeSyncQuality) -
            rangeFactor * rangeFactor * 0.14,
          0.05,
          0.995,
        );
        if (hash01(`${report.messageId}:${recipient.id}`) > successProbability) {
          this.diagnosticsState.droppedLink++;
          continue;
        }
        const slotDelay = (slot / this.options.slotsPerFrame) * this.options.frameSeconds;
        const networkDelay = this.options.baseLatency + slotDelay + rangeFactor * 0.12;
        this.pending.push({
          recipientId: recipient.id,
          report: cloneReport(report),
          receivedAt: frameTime + networkDelay,
          networkDelay,
          deliverAt: frameTime + networkDelay,
        });
        this.record({kind:"transmit",time:frameTime,senderId:sender.id,
          recipientId:recipient.id,trackId:report.trackId,delay:networkDelay});
      }
    }
  }

  drainInbox(participantId: string) {
    const deliveries = this.inboxes.get(participantId) ?? [];
    this.inboxes.delete(participantId);
    return deliveries;
  }

  diagnostics(): Readonly<Link16Diagnostics> {
    return { ...this.diagnosticsState };
  }

  participantStates(){return [...this.participants.values()].map(p=>({...p,position:p.position.clone()}));}
  recentActivities(time:number){return this.activities.filter(event=>time-event.time<=6).map(event=>({...event}));}
  private record(event:Omit<TacticalNetworkActivity,"id"|"network">){
    this.activities.push({...event,id:`L16-${this.serial}-${this.activities.length}`,network:"link16"});
    if(this.activities.length>160)this.activities.splice(0,this.activities.length-160);
  }
}
