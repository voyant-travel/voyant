# @voyantjs/types

Shared TypeScript types and Zod schemas for Voyant. Cross-package contracts that don't belong to any single domain module.

## Install

```bash
pnpm add @voyantjs/types
```

## Usage

```typescript
import type { ApiKey } from "@voyantjs/types/api-keys"
import { apiErrorSchema } from "@voyantjs/types/schemas/api-error"
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./api-keys` | API key types + envelope |
| `./schemas/*` | Individual Zod schemas (API error, KMS codec/envelope, etc.) |

## License

Apache-2.0
