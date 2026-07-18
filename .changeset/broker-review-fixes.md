---
"@voyant-travel/admin-extension-sdk": patch
"@voyant-travel/admin": patch
---

Harden the admin session-token broker: drop grant replies once the requesting frame has navigated or unmounted, time out pending `requestToken()` promises instead of hanging, and expose page fetchers from the installation-backed extensions client so full-page app extensions are reachable.
