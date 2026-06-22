---
"@voyant-travel/notifications": patch
---

Bump `@voyant-travel/cloud-sdk` to `^0.11.0` (from `^0.9.0`). The `0.x` caret previously capped the SDK below `0.10`, so this picks up the standardized JSON error envelope (`{ error, code?, requestId? }`) and the re-exported `VoyantApiError` / `CloudErrorCode`. Backward compatible — the email/SMS providers' usage is unchanged.
