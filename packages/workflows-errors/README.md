# @voyantjs/workflows/errors

Deprecated workspace compatibility wrapper. Use `@voyantjs/workflows/errors`.

Typed error classes used across the Voyant Workflows SDK.

See [`docs/sdk-surface.md`](../../docs/sdk-surface.md) §7 for the contract.

```ts
import { FatalError, RetryableError } from "@voyantjs/workflows/errors";

throw new FatalError("card declined — do not retry");

throw new RetryableError("rate limited", { retryAfter: "30s" });
```
