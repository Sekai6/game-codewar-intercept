import { planFormationTactics } from "../dist-test/air/ai/formation-tactics.js";

const member = (slot, overrides = {}) => ({
  slot,
  alive: true,
  threatened: false,
  joined: true,
  weaponReady: true,
  supportingWeapon: false,
  supportedTrackNumber: null,
  visibleTrackNumbers: ["F-0001", "F-0002"],
  ...overrides,
});
const contacts = [
  { trackNumber: "F-0001", quality: 0.8, uncertainty: 3, threat: 0.9, observerSlots: [0, 1] },
  { trackNumber: "F-0002", quality: 0.7, uncertainty: 4, threat: 0.7, observerSlots: [0, 1] },
];
const initial = planFormationTactics({
  members: [member(0), member(1)],
  contacts,
});
const handoff = planFormationTactics({
  members: [member(0, { threatened: true }), member(1)],
  contacts,
});
const support = planFormationTactics({
  members: [
    member(0, { supportingWeapon: true, supportedTrackNumber: "F-0001" }),
    member(1),
  ],
  contacts,
});
const succession = planFormationTactics({
  members: [member(0, { alive: false }), member(1)],
  contacts,
});
const rejoin = planFormationTactics({
  members: [member(0), member(1, { joined: false })],
  contacts,
});
const result = { initial, handoff, support, succession, rejoin };
console.log(JSON.stringify(result, null, 2));
if (
  initial.assignments[0]?.role !== "shooter" ||
  initial.assignments[1]?.role !== "shooter" ||
  initial.assignments[0]?.assignedTrackNumber ===
    initial.assignments[1]?.assignedTrackNumber ||
  handoff.assignments[0]?.role !== "defensive" ||
  handoff.assignments[1]?.role !== "shooter" ||
  support.assignments[0]?.role !== "supporter" ||
  support.assignments[1]?.assignedTrackNumber !== "F-0002" ||
  succession.commandSlot !== 1 ||
  succession.assignments[0]?.commandSlot !== 1 ||
  rejoin.assignments[1]?.role !== "rejoin"
) process.exitCode = 1;
