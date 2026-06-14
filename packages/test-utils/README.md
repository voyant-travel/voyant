# @voyant-travel/voyant-test-utils

Shared testing helpers for Voyant packages. Extracts duplicated patterns across integration tests: db bootstrap, Hono app mounting, sequential ID factories, and CLI command-context mocks.

## Install

```bash
pnpm add -D @voyant-travel/voyant-test-utils
```

## Usage

```typescript
import { describeIfDb, createTestDb, cleanupTestDb } from "@voyant-travel/voyant-test-utils/db"
import { mountTestApp, jsonRequest } from "@voyant-travel/voyant-test-utils/http"
import { createSequence, createNameFactory } from "@voyant-travel/voyant-test-utils/seq"
import { makeCliCtx } from "@voyant-travel/voyant-test-utils/cli"

describeIfDb("my integration tests", () => {
  // runs only when TEST_DATABASE_URL is set
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./db` | `createTestDb`, `cleanupTestDb`, `describeIfDb`, `probeTestDb` |
| `./http` | `mountTestApp`, `jsonRequest`, `json(body)` |
| `./seq` | `createCounter`, `createSequence`, `createNameFactory` |
| `./cli` | `makeCliCtx(argv)` for CLI handler tests |

## License

Apache-2.0
