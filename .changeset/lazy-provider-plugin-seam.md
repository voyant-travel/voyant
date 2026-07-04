---
"@voyant-travel/hono": patch
"@voyant-travel/framework": patch
---

Add lazy provider and lazy Hono bundle helpers so deployments can keep heavy
provider/plugin service graphs out of the eager app closure while preserving
request-time route, bootstrap, subscriber, and anonymous webhook behavior.
Lazy bundles can also declare eager transactional module/path metadata so the
first request selects the transaction-capable DB before the bundle is imported.

Narrow the framework relationships provider surface to the async methods the
framework consumes, so lazy provider call sites do not proxy query-builder or
plain-property service members.
