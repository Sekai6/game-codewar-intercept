# Anti-Radiation Missiles and SEAD

The ARM foundation adds independent emitter records, ESM emitter tracks and two seeker profiles: `AGM-45A Shrike` has limited memory, while `AGM-88A HARM` supports longer memory and bounded reacquisition. The missile targets an `EmitterInstance`, never hidden ship truth.

The state chain is `emitter-search → emitter-acquired → terminal-home → memory-track → reacquisition → lost/impact`. When a radar shuts down, ESM updates stop; seeker behavior follows the weapon profile. Decoys, emitter switching, band mismatch and stale tracks can all cause a miss.

The catalog, seeker state machine and deterministic logic verification are complete. A-6E SEAD task orchestration, physical launch integration and HUD/AAR/Tacview expansion remain the next integration stage.
