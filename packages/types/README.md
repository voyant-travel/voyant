# @voyant-travel/types

Shared TypeScript types and Zod schemas for Voyant. Cross-package contracts that don't belong to any single domain module.

## Install

```bash
pnpm add @voyant-travel/types
```

## Usage

```typescript
import type { ApiKey } from "@voyant-travel/types/api-keys"
import { apiErrorSchema } from "@voyant-travel/types/schemas/api-error"
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./api-keys` | API key types + envelope |
| `./schemas/*` | Individual Zod schemas (API error, KMS codec/envelope, etc.) |

## License

Apache-2.0
