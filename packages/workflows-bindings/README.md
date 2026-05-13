# @voyantjs/workflows/bindings

Deprecated workspace compatibility wrapper. Use `@voyantjs/workflows/bindings`.

Runtime binding shim for KV, R2, D1, Queues. Identical surface on both
Voyant Workflows runtimes:

- **Edge** — passes through to the tenant worker's native CF bindings.
- **Container** — makes authenticated HTTPS calls to CF's per-binding
  APIs with a short-lived scoped token injected by the orchestrator.

See [`docs/sdk-surface.md`](../../docs/sdk-surface.md) §9 and
[`docs/design.md`](../../docs/design.md) §5.2.

```ts
import { env } from "@voyantjs/workflows/bindings";

const row = await env.CUSTOMERS_DB.prepare("SELECT * FROM customers WHERE id = ?")
  .bind(id)
  .first();
```

Runtime behavior is provided by the platform — bindings are injected
into the workflow context by the edge runtime or the container
runtime. This package ships the shared type surface; importing `env`
directly throws with guidance.
