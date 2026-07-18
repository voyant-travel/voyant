---
"@voyant-travel/admin-extension-sdk": minor
---

Add the admin session-token protocol to the extension host contract: a
`voyant:ext:token` host→extension message answering the reserved
`request-token` request, a `requestToken()` author action, request/response
correlation ids, and resolved `appLocale` + text `direction` on the extension
context. Bumps the extension API to `1.1.0`.
