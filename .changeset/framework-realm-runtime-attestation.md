---
"@voyant-travel/framework": patch
---

Share framework runtime ownership and activation attestation across bundled module copies via Symbol.for registries on globalThis, so MCP no longer fail-closes with NOT_FRAMEWORK_OWNED when Vite SSR duplicates the framework package.
