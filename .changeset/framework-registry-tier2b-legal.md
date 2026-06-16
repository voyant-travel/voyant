---
"@voyant-travel/framework": minor
---

Relocate the **legal** module factory into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains the legal provider fields — `resolveDb`, `createOperatorDocumentStorage`, `resolveContractDocumentGenerator`, `createBookingPiiService`, `autoGenerateContractOnConfirmed` — each typed by `CreateLegalHonoModuleOptions` indexed access (drift-proof). All are `unknown`/`Record<string,unknown>`-bindings adapters, so the `OperatorCapabilities extends FrameworkProviders` guard passes cleanly.
