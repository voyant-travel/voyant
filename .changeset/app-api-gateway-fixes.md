---
"@voyant-travel/apps": patch
---

Mount the App API under `/v1/app/*` so its endpoints are reachable, enforce the token's own (possibly narrowed) scope set on every App API call, and treat resource/action `remoteSafe` flags as grantable during OAuth consent.
