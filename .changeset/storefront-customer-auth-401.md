---
"@voyant-travel/auth": patch
---

Return a clean 401/403 instead of a 500 when a storefront customer-auth request
presents a missing/invalid storefront access key or a missing/disallowed origin.
`StorefrontCustomerAuthResolutionError` now carries an HTTP status and a stable,
non-leaky code, and the auth handler's error boundary translates it to 401
(missing/invalid key or missing origin header) or 403 (a known key presented
from a disallowed origin). Genuine server faults still surface as 500.
