import type {
  ForceEngagementAssignment,
  ForceEngagementRecord,
  NavalForceRuntime,
} from "./types.js";

const ASSESSMENT_OBSERVATION_SECONDS = 6;

function assignment(force: NavalForceRuntime, assignmentId: string) {
  return force.assignments.get(assignmentId);
}

function recordForAssignment(force: NavalForceRuntime, item: ForceEngagementAssignment) {
  return force.engagements.get(item.forceTrackId);
}

export function registerForceAssignment(
  force: NavalForceRuntime,
  item: ForceEngagementAssignment,
) {
  force.assignments.set(item.id, item);
  const existing = force.engagements.get(item.forceTrackId);
  const record: ForceEngagementRecord = existing ?? {
    targetId: item.forceTrackId,
    assignmentIds: [],
    assignedShooters: [],
    weaponsCommitted: 0,
    estimatedPk: 0,
    expectedInterceptTimes: [],
    assessmentDueAt: Number.POSITIVE_INFINITY,
    lastUpdatedAt: item.assignedAt,
    status: "assigned",
  };
  if (!record.assignmentIds.includes(item.id)) record.assignmentIds.push(item.id);
  if (!record.assignedShooters.includes(item.shooterId)) record.assignedShooters.push(item.shooterId);
  record.status = "assigned";
  record.lastUpdatedAt = item.assignedAt;
  record.resolvedAt = undefined;
  force.engagements.set(item.forceTrackId, record);
  return record;
}

export function acceptForceAssignment(
  force: NavalForceRuntime,
  assignmentId: string,
  shooterId: string,
  now: number,
) {
  const item = assignment(force, assignmentId);
  if (!item || item.shooterId !== shooterId || item.status !== "assigned" || now >= item.expiresAt)
    return false;
  item.status = "accepted";
  item.updatedAt = now;
  const record = recordForAssignment(force, item);
  if (record) record.lastUpdatedAt = now;
  return true;
}

export function rejectForceAssignment(
  force: NavalForceRuntime,
  assignmentId: string,
  shooterId: string,
  reason: string,
  now: number,
) {
  const item = assignment(force, assignmentId);
  if (!item || item.shooterId !== shooterId
    || (item.status !== "assigned" && item.status !== "accepted")) return false;
  item.status = "rejected";
  item.rejectionReason = reason;
  item.updatedAt = now;
  const record = recordForAssignment(force, item);
  if (record && record.weaponsCommitted === 0) {
    record.status = "leaker";
    record.lastUpdatedAt = now;
  }
  return true;
}

export interface WeaponsAwayReport {
  assignmentId: string;
  shooterId: string;
  count: number;
  estimatedSingleShotPk: number;
  expectedInterceptTimes: readonly number[];
  now: number;
}

export function reportForceWeaponsAway(force: NavalForceRuntime, report: WeaponsAwayReport) {
  const item = assignment(force, report.assignmentId);
  if (!item || item.shooterId !== report.shooterId
    || item.status !== "accepted" || report.count <= 0) return false;
  const record = recordForAssignment(force, item);
  if (!record) return false;
  item.status = "weapons-away";
  item.updatedAt = report.now;
  const count = Math.min(item.requestedShots, Math.max(0, Math.floor(report.count)));
  const singlePk = Math.max(0, Math.min(0.99, report.estimatedSingleShotPk));
  const salvoPk = 1 - Math.pow(1 - singlePk, count);
  record.weaponsCommitted += count;
  record.estimatedPk = 1 - (1 - record.estimatedPk) * (1 - salvoPk);
  record.expectedInterceptTimes.push(...report.expectedInterceptTimes.slice(0, count));
  record.expectedInterceptTimes.sort((a, b) => a - b);
  record.assessmentDueAt = Math.max(
    report.now,
    ...record.expectedInterceptTimes,
  );
  record.status = "weapons-away";
  record.lastUpdatedAt = report.now;
  return true;
}

export function reportForceAssessment(
  force: NavalForceRuntime,
  targetId: string,
  result: "kill" | "miss" | "partial",
  now: number,
) {
  const record = force.engagements.get(targetId);
  if (!record || record.status === "resolved") return false;
  record.status = result === "kill" ? "resolved" : "leaker";
  record.lastUpdatedAt = now;
  if (result === "kill") record.resolvedAt = now;
  return true;
}

export function forceEngagementSuppressesAssignment(
  record: ForceEngagementRecord | undefined,
) {
  return !!record && (
    record.status === "assigned"
    || record.status === "weapons-away"
    || record.status === "assessing"
    || record.status === "resolved"
  );
}

export function updateForceEngagements(force: NavalForceRuntime, now: number) {
  for (const item of force.assignments.values()) {
    if ((item.status !== "assigned" && item.status !== "accepted") || now < item.expiresAt) continue;
    item.status = "expired";
    item.updatedAt = now;
    const record = recordForAssignment(force, item);
    if (record?.status === "assigned" && record.weaponsCommitted === 0) {
      record.status = "leaker";
      record.lastUpdatedAt = now;
    }
  }
  for (const record of force.engagements.values()) {
    if (record.status === "weapons-away" && now >= record.assessmentDueAt) {
      record.status = "assessing";
      record.lastUpdatedAt = now;
    } else if (record.status === "assessing"
      && now >= record.assessmentDueAt + ASSESSMENT_OBSERVATION_SECONDS) {
      record.status = "leaker";
      record.lastUpdatedAt = now;
    }
  }
}

export function resetForceEngagements(force: NavalForceRuntime) {
  force.assignments.clear();
  force.engagements.clear();
}
