---
"@voyantjs/hono": minor
---

Add `@voyantjs/hono/composition` — manifest-driven runtime composition. `composeFromManifest(manifest, registry, capabilities)` derives a template's `createApp({ modules, extensions })` arrays from a registry keyed by manifest specifier, with factories receiving a typed capability container (the deployment's storage/FX/providers/document-download resolvers gathered in one place). `diffManifestRegistry` reports manifest↔registry drift for tooling. Lets a template stop hand-listing modules/extensions; the operator template now composes from its manifest. See voyant#1608 / #1620.
