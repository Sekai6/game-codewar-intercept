# NTU Intercept

NTU Intercept is a Cold War naval and joint-air combat sandbox built with TypeScript, Three.js, and Vite. Real platform, radar, and weapon names establish the historical setting; all performance values are game-scaled and must not be treated as engineering, training, or real-world capability data.

[中文](README.md) | [Simulation (Chinese)](docs/zh/SIMULATION.md) | [Architecture](ARCHITECTURE.md) | [Operations (Chinese)](docs/zh/OPERATIONS.md) | [Verification (Chinese)](docs/zh/VERIFICATION.md)

![Fleet physical-launch verification](verification-fleet-launch-cycle.png)

## Current Capabilities

- Independent ship entities: USS Long Beach (CGN-9), USS Lake Champlain (CG-57), and Moskva.
- Independent air entities: F-14A, A-6E, Tu-16K, MiG-29A, E-2C, and Tu-126.
- Three-dimensional ship, aircraft, missile, and decoy motion.
- Radar horizon, RCS range scaling, scan intervals, measurement error, track aging, and weapon-quality authorization.
- NTU-era Link 11, optional later Link 16 era settings, and separate Soviet C2 models.
- ECM, burn-through, chaff, flares, SRBOC, CIWS, and system-level damage.
- Multi-ship formations with independent magazines, sensors, launchers, and damage state.
- Advanced flight AI, aerodynamic envelopes, throttle regimes, fuel, and damage management.
- WebGL high-quality rendering and an experimental WebGPU Ultra path.
- After Action Review and Tacview ACMI export.

## Simulation Invariants

1. Weapons use observed tracks until their own seekers acquire; they do not read target truth directly.
2. Link 11/16 cues do not automatically grant shipboard weapon authority.
3. Fleet coordinators assign tasks but cannot consume ammunition or spawn weapons.
4. Shipboard SAMs must pass through the firing ship's track, fire control, magazine, channels, and Mk 10/Mk 41 state machine.
5. `weapons-away`, AAR, and ACMI launch records are created only after physical departure.
6. Every ship, aircraft, missile, and decoy is an independently owned entity.

## Quick Start

Node.js 20.19+ or 22.12+ is required.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

Production build:

```bash
npm run build
```

## Documentation Map

| Topic | Document |
|---|---|
| Simulation loop, sensors, guidance, EW, and damage | [Simulation manual (Chinese)](docs/zh/SIMULATION.md) |
| Source ownership, module boundaries, and extension points | [Architecture](ARCHITECTURE.md) and [architecture guide (Chinese)](docs/zh/ARCHITECTURE.md) |
| Controls, cameras, AAR, and Tacview | [Operations guide (Chinese)](docs/zh/OPERATIONS.md) |
| Test matrix and v1.0 release gates | [Verification guide (Chinese)](docs/zh/VERIFICATION.md) |
| WebGPU Ultra implementation status | [WebGPU Ultra](docs/WEBGPU_ULTRA.md) |
| WebGPU renderer migration | [Renderer migration](docs/WEBGPU_RENDERER_MIGRATION.md) |
| v1.0 feature boundaries and evidence | [CHANGELOG.md](CHANGELOG.md) |

The English source-level architecture document is maintained alongside the code. The new detailed operator and simulation manuals currently use Chinese as their authoritative language; translations should preserve the same file boundaries rather than rebuilding a monolithic README.

## Source Map

```text
src/air/          air platforms, flight, AI, sensors, weapons, and AEW
src/fleet/        force runtime, formations, Link 11, command, and tasking
src/ships/        independent ship execution, EW, CIWS, and damage control
src/ship-defense/ shared ship-defense target, engagement, launcher, and visual runtimes
src/datalink/     Link 11/16 protocols, era configuration, and observability
src/soviet-c2/    Soviet GCI, maritime targeting, and salvo coordination
src/threats/      incoming-weapon catalog and models
src/scenarios/    scenario-owned initial state and settings
src/aar/          AAR and ACMI recording/export
src/visual/       ocean, atmosphere, clouds, lighting, and WebGPU experiments
src/models/       procedural ship, aircraft, and weapon models
src/main.ts       composition root, frame scheduling, UI, and compatibility bridges
scripts/          logic, browser, screenshot, and regression verification
```

## Project Status

The repository is released as `v1.0.0`. Feature boundaries and verification evidence are listed in [CHANGELOG.md](CHANGELOG.md).

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Learning, research, and noncommercial use are allowed; commercial use requires separate permission.
