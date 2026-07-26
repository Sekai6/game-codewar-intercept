import assert from "node:assert/strict";
import * as THREE from "three";
import { collectShipDefenseContacts } from "../dist-test/air/ship-defense-bridge.js";

function entity(id, kind, side = "blue") {
  return { id, kind, side, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
    radarCrossSection: 1, infraredSignature: 1, alive: true, applyDamage() {} };
}
const flagship = entity("flagship", "ship"), escort = entity("escort", "ship");
const carrier = entity("carrier", "aircraft", "red"), inboundFlag = entity("asm-flag", "missile", "red"),
  inboundEscort = entity("asm-escort", "missile", "red");
const calls = [];
const contacts = collectShipDefenseContacts([flagship, escort], (defender) => {
  calls.push(defender.id);
  const missile = defender.id === "flagship" ? inboundFlag : inboundEscort;
  return [carrier, missile].map((contact) => ({ entity: contact, name: contact.id,
    model: new THREE.Group(), template: "RGM-84 Harpoon", phase: "terminal" }));
});
assert.deepEqual(calls, ["flagship", "escort"], "every live friendly ship must be queried as a defender");
assert.deepEqual(contacts.map((contact) => contact.entity.id).sort(), ["asm-escort", "asm-flag", "carrier"],
  "force intake must retain weapons assigned to either ship while deduplicating shared aircraft");
console.log(JSON.stringify({ defenders: calls.length, uniqueContacts: contacts.length, escortWeaponRegistered: true }));
