---
"@voyant-travel/framework": minor
"@voyant-travel/openapi": patch
"@voyant-travel/hono": patch
---

Delete the framework-owned compatibility composition catalog. Standard modules and extensions now compose exclusively from admitted package manifests and the generated graph runtime, including local `src/extensions/*/index.ts` conventions. Keep `createVoyantApp` as generic explicit Hono composition machinery, remove the Operator bindings registry, and generate framework OpenAPI from graph-owned factories. This cutover preserves the SmartBill `^0.140.0` package runtime and typed host-port integration from the governance rollup.
