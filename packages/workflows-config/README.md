# @voyantjs/workflows/config

Deprecated workspace compatibility wrapper. Use `@voyantjs/workflows/config`.

Types and `defineConfig` helper for `voyant.config.ts` at the root of a
Voyant Cloud project.

See [`docs/sdk-surface.md`](../../docs/sdk-surface.md) §10 and
[`docs/design.md`](../../docs/design.md) §5.4.3 for the contract.

```ts
// voyant.config.ts
import { defineConfig } from "@voyantjs/workflows/config";

export default defineConfig({
  projectId: "prj_01HQZ...",
  entry: { worker: "./src/index.ts" },
  environments: {
    production:  {},
    preview:     {},
    development: {},
  },
  bindings: {
    CUSTOMERS_DB: { type: "d1", name: "customers" },
  },
});
```
