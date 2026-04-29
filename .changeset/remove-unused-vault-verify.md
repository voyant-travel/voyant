---
"@voyantjs/notifications": patch
---

Removed the unused `@voyantjs/vault` and `@voyantjs/verify` wrapper packages. They were thin abstractions over `@voyantjs/cloud-sdk` calls (`vault.getSecret`, `verify.start`/`check`) with zero source-code importers anywhere. Templates that need vault or verify primitives now call the SDK directly via `getVoyantCloudClient(env).vault.getSecret(...)` etc.
