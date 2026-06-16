---
"@voyant-travel/framework": minor
---

Relocate the **public-document-delivery** and **notifications** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains `resolvePublicCheckoutBaseUrl` and `readDocumentContentBase64` (notifications); public-document-delivery reuses the `createOperatorDocumentStorage` provider added with legal.

This resolves the public-document-delivery deferral from Tier 2a: routing its `resolveStorage` through the uniform `unknown`-bindings `createOperatorDocumentStorage` adapter (rather than the narrow-`CloudflareBindings` `createDocumentStorage`) keeps the provider contract uniform and lets the deployment retire `createDocumentStorage` entirely.
