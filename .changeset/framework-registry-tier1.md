---
"@voyant-travel/framework": minor
---

The framework now owns the **standard runtime composition registry**, not just the BOM + manifest. New exports:

- `frameworkComposition` — a `CompositionRegistry` of the package-owned standard factories a deployment spreads into its own registry (`{ ...frameworkComposition.modules }`), so `composeFromManifest` sees one complete registry while the deployment shrinks.
- `FrameworkProviders` — the typed, injected provider surface the standard factories read off `ctx.capabilities` (the deployment's capability container is a structural superset).

This first slice (Workstream B, Tier 1) relocates the pure singleton module factories — action-ledger, relationships, quotes, operations, identity, distribution, commerce, inventory — which take no providers. Capability-shaped factories and the lazy `operator/*` route loaders follow in later tiers.
