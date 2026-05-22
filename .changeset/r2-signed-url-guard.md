---
"@voyantjs/storage": patch
---

Throw from the R2 provider's `signedUrl` when neither a signer nor public base URL is configured instead of returning the raw storage key.
