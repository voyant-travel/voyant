---
"@voyantjs/notifications": minor
---

Retired `@voyantjs/voyant-cloud`. SDK v0.6.0 ships the env-bindings helpers natively (`getVoyantCloudClient` / `tryGetVoyantCloudClient` / `VoyantCloudConfigError` / `VoyantCloudEnv`) — consumers import directly from `@voyantjs/cloud-sdk`. `@voyantjs/notifications` cloud providers now type-import `VoyantCloudClient` from `@voyantjs/cloud-sdk`.
