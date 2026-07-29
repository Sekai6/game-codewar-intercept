# Wiki Versioning

This version note and the platform catalog target package version `1.15.0`. Mechanic, weapon, and ship pages unaffected by v1.15.0 may retain their latest data snapshot; a page-header version marks its last material update, not feature removal. Values are deterministic game-scaled parameters, not deployment data. Update the data snapshot, `CHANGELOG.md`, and both language pages when fields or mechanisms change.

## v1.15.0 documentation boundary

v1.15.0 applies a second refinement pass to the six procedural air assets: it corrects shared loft-fuselage normals, improves nozzles, the arresting hook, tail guns, markings, lights, and AEW animation, unifies model and runtime station definitions, and moves F-14 wing sweep to a model-declared 20°–68° geometry contract. The six aircraft retain the common 2 m/unit display scale and separately constructed Ultra, High, and Low geometry.

Platform-page model sections describe this asset release; flight, radar, weapon, and AI values remain game-scaled and do not become real-world performance data because the silhouettes are more detailed. Structural model tests and 63 serial static captures can establish relative dimensions, independent LOD ownership, identifying features, and store contact. They do not replace joint-scenario regression for flight, combat, damage, or AAR behavior.

## v1.1.0 historical boundary

v1.1.0 first placed the six aircraft on one 2 m/unit visual scale and introduced independently constructed Ultra, High, and Low geometry. The v1.0.0 runtime/catalog release must not be described retrospectively as containing those refined assets; v1.15.0 is a later refinement and does not rewrite the historical tag.

Stable means part of the standard entity and telemetry loop; Optional requires a scenario/settings switch; Experimental may change output or performance. Unimplemented CEC, carrier operations and towed decoys must remain explicitly marked.

## Future target (not implemented)

**Passive sensing / emission-control chain**: fleet and asset platforms will gain IRST, passive electromagnetic detection, emitter tracks and EMCON states. Planned verification covers silent search, emission exposure, passive-track quality, active/passive sensor switching, and EMCON constraints on data links and engagement authorization. The current release does not provide this runtime capability.

**CEC (Cooperative Engagement Capability)**: planned cross-platform track fusion, remote fire-control engagement, authorization and coordinated missile mid-course updates. Current Link exchange is not CEC.

**Anti-radiation operations and missiles**: planned emitter classification, passive direction finding, radar shutdown/relocation, decoy-emitter competition and dedicated anti-radiation missile acquisition/loss/reacquisition. These entity loops are not available in the current release.
