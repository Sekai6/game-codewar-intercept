# Wiki Versioning

This version note and the platform catalog target package version `1.1.0`. Mechanic, weapon, and ship pages unaffected by v1.1.0 may retain their latest data snapshot; a page-header version marks its last material update, not feature removal. Values are deterministic game-scaled parameters, not deployment data. Update the data snapshot, `CHANGELOG.md`, and both language pages when fields or mechanisms change.

## v1.1.0 documentation boundary

The main v1.1.0 change is the visual rebuild of six procedural air assets. They use one 2 m/unit display scale and separately constructed Ultra, High, and Low geometry. Platform-page model sections describe this asset release; flight, radar, weapon, and AI values remain game-scaled and do not become real-world performance data because the silhouettes are more detailed.

Structural model tests and static captures can establish relative dimensions, independent LOD ownership, identifying features, and store contact. They do not replace joint-scenario regression for flight, combat, damage, or AAR behavior. The v1.0.0 runtime/catalog release must not be described retrospectively as containing the refined v1.1.0 asset set.

Stable means part of the standard entity and telemetry loop; Optional requires a scenario/settings switch; Experimental may change output or performance. Unimplemented CEC, carrier operations and towed decoys must remain explicitly marked.

## Future target (not implemented)

**Passive sensing / emission-control chain**: fleet and asset platforms will gain IRST, passive electromagnetic detection, emitter tracks and EMCON states. Planned verification covers silent search, emission exposure, passive-track quality, active/passive sensor switching, and EMCON constraints on data links and engagement authorization. The current release does not provide this runtime capability.

**CEC (Cooperative Engagement Capability)**: planned cross-platform track fusion, remote fire-control engagement, authorization and coordinated missile mid-course updates. Current Link exchange is not CEC.

**Anti-radiation operations and missiles**: planned emitter classification, passive direction finding, radar shutdown/relocation, decoy-emitter competition and dedicated anti-radiation missile acquisition/loss/reacquisition. These entity loops are not available in the current release.
