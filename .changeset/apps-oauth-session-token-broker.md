---
"@voyant-travel/apps": minor
"@voyant-travel/schema-kit": patch
---

Add the iframe admin session-token broker (RFC Phase 3): HKDF-signed,
context-separated short-lived session tokens carrying issuer, app audience,
installation, deployment, viewer, entity/slot context, iat/exp, and a unique
token id. Issuance records the token id and audits it; the backend exchange
verifies audience/deployment binding, consumes the token id once (rejecting
replay, expiry, and context mismatch), and swaps it for online actor access via
the existing OAuth actor-token-exchange primitive bounded by viewer ∩ app
grants. Adds the `app_session_tokens` table (migration idx 4) and its TypeID
prefix.
