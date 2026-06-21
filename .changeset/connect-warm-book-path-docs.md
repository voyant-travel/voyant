---
"@voyant-travel/plugin-voyant-connect": patch
---

Document the async-warm book-path pattern in the README (#2044).

The "book-path vs sync-path connection scoping" section now shows the recommended way to make the live booking-engine registry route per-connection: register the un-scoped default synchronously as the cold-window fallback, then warm the per-connection adapters via `prepareVoyantConnectSources(env, { enumerate: true })` onto the same registry instance (tied to the request with `ctx.waitUntil` on Workers). No API change — the operator starter implements this pattern.
