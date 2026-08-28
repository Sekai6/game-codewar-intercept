# Anti-Radiation Missiles and SEAD

The ARM foundation adds independent emitter records, ESM emitter tracks and two seeker profiles: `AGM-45A Shrike` has limited memory, while `AGM-88A HARM` supports longer memory and bounded reacquisition. The missile targets an `EmitterInstance`, never hidden ship truth.

The state chain is `emitter-search → emitter-acquired → terminal-home → memory-track → reacquisition → lost/impact`. When a radar shuts down, ESM updates stop; seeker behavior follows the weapon profile. Decoys, emitter switching, band mismatch and stale tracks can all cause a miss.

The catalog, independent search/fire-control emitters, ESM/IRST passive tracks, A-6E SEAD task orchestration, physical hardpoint launch path, and deterministic AGM-45/AGM-88 memory/loss/reacquisition lifecycle are implemented. AAR/Tacview records seeker state, target emitter binding, and emitter activation changes. The ARM runtime, SEAD authorization, seeker lifecycle, and browser SEAD preset checks are part of the verification suite.
