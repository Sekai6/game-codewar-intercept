# Scenario Platform

Scenarios use a data-only JSON document, TypeScript validation/normalization, compilation and runtime layers. The lifecycle is `load → normalize → validate → compile → runtime`.

Invalid IDs, duplicate entities, illegal routes and broken references are rejected before startup. Legacy scenarios enter through adapters, while `main.ts` only assembles dependencies and owns the frame/UI lifecycle.
