# Passive Sensors and EMCON

IRST produces bearing-dominant tracks from infrared signature, aspect and engine state. ESM produces emitter bearings only when radar, communications or jamming emissions are present. Neither sensor reads hidden target truth.

`ACTIVE` permits radar; `EMCON` keeps IRST/ESM and datalink reception available while suppressing active emissions; `PASSIVE_ONLY` forbids active search. Shared passive tracks remain cues until confirmed by the receiving platform's own sensor.
