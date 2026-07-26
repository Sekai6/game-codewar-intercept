# USS Long Beach (CGN-9)

> v1.0.0 · 2026-07-26 | [Platforms](README.md) | [中文](../../PLATFORMS/USS_LONG_BEACH_CGN9.md)

The default NTU flagship is an independent ship entity with search radar, local track store, fire-control channels, illuminators, RIM-67 magazine, forward/aft Mk 10 launchers, ECM, SRBOC, CIWS, maneuver, damage control, and subsystem health.

Mk 10 launch proceeds through ready, slew, fire, return, and loading phases. Assignment or queue state is not weapons-away; AAR records launch only after the round physically leaves the rail.

## Game definition

| Field | Value |
|---|---|
| Mobility | 30 kn max, 20 cruise, 10 patrol; 1.6 deg/s turn |
| Sensors/fire control | AN/SPS-48E, AN/SPS-49, AN/SPG-55; 3 SAM channels, 2 illuminators |
| SAM inventory | 6 RIM-67, 12 SM-2MR, 8 SM-2ER |
| Mk 10 | Forward/aft launchers; 55 deg/s azimuth, 25 deg/s elevation, 1.8 s reload |
| Surface strike | 8 RGM-84; range 35-680, quality 0.62, 2-4 round salvo |
| CIWS | Two mounts, 1200 rounds, range 15, 60-round burst, 0.6 s cooldown, PK 0.44/0.70 |
| EW | AN/SLQ-32 strength 0.62, burn-through 72; 12 SRBOC rounds, 2.4 s cooldown |

Fleet tasks enter a ship-owned queue. Organic track, channel/illuminator, magazine decrement, and the `ready -> slewing -> firing -> returning -> loading` state machine are mandatory before physical departure. Damage zones independently affect radar, SPG-55, launchers, CIWS, SLQ-32, SRBOC, and propulsion. AAR/ACMI must expose ship ID, launcher, point, ammunition, missile parentage, and the physical-launch event.
