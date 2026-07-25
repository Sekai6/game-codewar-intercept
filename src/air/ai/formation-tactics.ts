export type FormationTacticalRole =
  | "lead"
  | "shooter"
  | "supporter"
  | "cover"
  | "defensive"
  | "rejoin";

export interface FormationMemberObservation {
  slot: number;
  alive: boolean;
  threatened: boolean;
  joined: boolean;
  weaponReady: boolean;
  supportingWeapon: boolean;
  supportedTrackNumber: string | null;
  visibleTrackNumbers: readonly string[];
}

export interface FormationContactObservation {
  trackNumber: string;
  quality: number;
  uncertainty: number;
  threat: number;
  observerSlots: readonly number[];
}

export interface FormationAssignment {
  slot: number;
  commandSlot: number;
  role: FormationTacticalRole;
  assignedTrackNumber: string | null;
}

export interface FormationTacticalPlan {
  commandSlot: number | null;
  assignments: FormationAssignment[];
}

export function planFormationTactics(input: {
  members: readonly FormationMemberObservation[];
  contacts: readonly FormationContactObservation[];
  allowCoordinatedSalvo?: boolean;
}): FormationTacticalPlan {
  const living = input.members.filter((member) => member.alive)
    .sort((left, right) => left.slot - right.slot);
  const commandSlot = living[0]?.slot ?? null;
  if (commandSlot === null) return { commandSlot, assignments: [] };

  const contacts = [...input.contacts].sort((left, right) =>
    right.threat * right.quality - left.threat * left.quality ||
    left.uncertainty - right.uncertainty ||
    left.trackNumber.localeCompare(right.trackNumber)
  );
  let nextTarget = 0;
  let shooterAssigned = false;
  const assignments = living.map((member): FormationAssignment => {
    if (member.threatened)
      return {
        slot: member.slot,
        commandSlot,
        role: "defensive",
        assignedTrackNumber: null,
      };
    if (!member.joined)
      return {
        slot: member.slot,
        commandSlot,
        role: "rejoin",
        assignedTrackNumber: null,
      };
    if (member.supportingWeapon) {
      shooterAssigned = true;
      const supportedTrackNumber = member.supportedTrackNumber ??
        contacts[0]?.trackNumber ?? null;
      const supportedIndex = contacts.findIndex((contact) =>
        contact.trackNumber === supportedTrackNumber);
      if (supportedIndex >= nextTarget) nextTarget = supportedIndex + 1;
      return {
        slot: member.slot,
        commandSlot,
        role: "supporter",
        assignedTrackNumber: supportedTrackNumber,
      };
    }
    const visibleContacts = contacts.filter((contact) =>
      member.visibleTrackNumbers.includes(contact.trackNumber));
    if (member.weaponReady && visibleContacts.length > 0 &&
        (!shooterAssigned || input.allowCoordinatedSalvo ||
          nextTarget < visibleContacts.length)) {
      shooterAssigned = true;
      const assigned = visibleContacts[input.allowCoordinatedSalvo
        ? 0
        : nextTarget++ % visibleContacts.length];
      return {
        slot: member.slot,
        commandSlot,
        role: "shooter",
        assignedTrackNumber: assigned.trackNumber,
      };
    }
    return {
      slot: member.slot,
      commandSlot,
      role: member.slot === commandSlot ? "lead" : "cover",
      assignedTrackNumber: null,
    };
  });
  return { commandSlot, assignments };
}
