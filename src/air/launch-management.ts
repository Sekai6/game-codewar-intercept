import type {
  AirGuidance,
  AirMissileInstance,
  AirPlatformInstance,
  AirTrack,
  AirWeaponDefinition,
  AirWeaponId,
} from "./types";
import {
  calculateDynamicLaunchZone,
  dynamicShotAllowed,
} from "./ai/weapon-employment.js";

const usesDatalink = (guidance: AirGuidance) =>
  guidance === "active-radar" || guidance === "anti-ship-radar";

export function calculateFireControlUsage(input: {
  liveWeapons: readonly { guidance: AirGuidance; seekerAcquired: boolean }[];
  pendingWeapons: readonly { guidance: AirGuidance }[];
}) {
  return {
    datalink:
      input.liveWeapons.filter(
        (weapon) => usesDatalink(weapon.guidance) && !weapon.seekerAcquired,
      ).length + input.pendingWeapons.filter((weapon) => usesDatalink(weapon.guidance)).length,
    illumination:
      input.liveWeapons.filter((weapon) => weapon.guidance === "semi-active-radar").length +
      input.pendingWeapons.filter((weapon) => weapon.guidance === "semi-active-radar").length,
  };
}

export function fireControlAvailable(input: {
  aircraft: AirPlatformInstance;
  missiles: readonly AirMissileInstance[];
  weapon: AirWeaponDefinition;
  weaponCatalog: Readonly<Record<AirWeaponId, AirWeaponDefinition>>;
}) {
  const liveWeapons = input.missiles
    .filter((missile) => missile.alive && missile.shooterId === input.aircraft.id)
    .map((missile) => ({ guidance: missile.definition.guidance, seekerAcquired: missile.seekerAcquired }));
  const pendingWeapons = input.aircraft.hardpoints
    .filter((hardpoint) => hardpoint.state === "reserved" || hardpoint.state === "releasing")
    .flatMap((hardpoint) =>
      hardpoint.weaponId ? [{ guidance: input.weaponCatalog[hardpoint.weaponId].guidance }] : [],
    );
  const usage = calculateFireControlUsage({ liveWeapons, pendingWeapons });
  if (input.weapon.guidance === "semi-active-radar")
    return usage.illumination < input.aircraft.definition.fireControlChannels.illumination;
  if (usesDatalink(input.weapon.guidance))
    return usage.datalink < input.aircraft.definition.fireControlChannels.datalink;
  return true;
}

export function chooseAirWeapon(input: {
  aircraft: AirPlatformInstance;
  missiles: readonly AirMissileInstance[];
  classification: AirTrack["classification"];
  range: number;
  track?: AirTrack;
  advancedAi?: boolean;
  defensive?: boolean;
  weaponCatalog: Readonly<Record<AirWeaponId, AirWeaponDefinition>>;
}) {
  if (input.classification === "unknown") return undefined;
  const targetId = input.track?.targetId;
  if (input.classification === "aircraft" && targetId) {
    const weaponsInFlight = input.missiles.filter((missile) =>
      missile.alive && missile.targetId === targetId).length +
      input.aircraft.hardpoints.filter((hardpoint) =>
        (hardpoint.state === "reserved" || hardpoint.state === "releasing") &&
        hardpoint.targetId === targetId).length;
    if (weaponsInFlight >= 2) return undefined;
  }
  const isTomcat = input.aircraft.definition.id === "F-14A";
  const priorityLongRangeTarget = input.track?.targetRole === "bomber" ||
    input.track?.targetRole === "aew";
  const sparrowAvailable = (input.aircraft.ammo.get("AIM-7F") ?? 0) > 0;
  const phoenixRemaining = input.aircraft.ammo.get("AIM-54A") ?? 0;
  return ([...input.aircraft.ammo] as [AirWeaponId, number][])
    .filter(([, count]) => count > 0)
    .map(([id]) => input.weaponCatalog[id])
    .filter((weapon) => {
      if (isTomcat && input.classification === "aircraft") {
        if (weapon.id === "AIM-54A") {
          if (input.range < 350 && (sparrowAvailable || !priorityLongRangeTarget)) return false;
          if (input.range < 500 && !priorityLongRangeTarget) return false;
          if (phoenixRemaining <= 2 && !priorityLongRangeTarget) return false;
        }
        if (weapon.id === "AIM-7F" && (input.range < 120 || input.range > 550)) return false;
        if (weapon.id === "AIM-9L" && (input.range < 15 || input.range > 180)) return false;
      }
      const rangeAllowed = input.advancedAi && input.track
        ? dynamicShotAllowed({
            zone: calculateDynamicLaunchZone({
              weapon,
              shooterPosition: input.aircraft.position,
              shooterVelocity: input.aircraft.velocity,
              shooterMaximumSpeed: input.aircraft.definition.flight.maxSpeed,
              track: input.track,
            }),
            defensive: input.defensive ?? false,
          })
        : input.range >= weapon.minRange && input.range <= weapon.maxRange;
      return weapon.targets.includes(input.classification as "aircraft" | "ship") &&
        rangeAllowed &&
        fireControlAvailable({ ...input, weapon }) &&
        input.aircraft.hardpoints.some(
          (hardpoint) => hardpoint.state === "ready" && hardpoint.weaponId === weapon.id,
        );
    })
    .sort((left, right) => {
      if (input.advancedAi && input.classification === "aircraft" &&
          input.range <= 350) {
        const leftCloseWeapon = left.guidance === "infrared" ? 2 :
          left.guidance === "semi-active-radar" ? 1 : 0;
        const rightCloseWeapon = right.guidance === "infrared" ? 2 :
          right.guidance === "semi-active-radar" ? 1 : 0;
        if (leftCloseWeapon !== rightCloseWeapon)
          return rightCloseWeapon - leftCloseWeapon;
      }
      if (isTomcat && input.classification === "aircraft") {
        const rank = (weapon: AirWeaponDefinition) =>
          input.range >= 500 && input.range <= 1500
            ? (weapon.id === "AIM-54A" ? 3 : weapon.id === "AIM-7F" ? 2 : 1)
            : input.range >= 120
              ? (weapon.id === "AIM-7F" ? 3 : weapon.id === "AIM-9L" ? 2 : 1)
              : (weapon.id === "AIM-9L" ? 3 : weapon.id === "AIM-7F" ? 2 : 1);
        const difference = rank(right) - rank(left);
        if (difference) return difference;
      }
      if (input.defensive) {
        const leftFireAndForget = left.guidance === "infrared" ? 1 : 0;
        const rightFireAndForget = right.guidance === "infrared" ? 1 : 0;
        if (leftFireAndForget !== rightFireAndForget)
          return rightFireAndForget - leftFireAndForget;
      }
      return right.maxRange - left.maxRange;
    })[0];
}
