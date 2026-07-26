import type { TargetableEntity } from "../combat-entity.js";
import type { AirShipDefenseContact } from "./types.js";

export function collectShipDefenseContacts(
  targets: readonly TargetableEntity[],
  contactsForDefender: (defender: TargetableEntity) => readonly AirShipDefenseContact[],
) {
  const contacts = new Map<string, AirShipDefenseContact>();
  for (const defender of targets) {
    if (defender.side !== "blue" || defender.kind !== "ship" || !defender.alive) continue;
    for (const contact of contactsForDefender(defender)) contacts.set(contact.entity.id, contact);
  }
  return [...contacts.values()];
}
