# @voyant-travel/relationships-contracts

Pure validation schemas for people, organizations, relationship activities,
customer signals, custom fields, and relationship-facing enums, zod-only, for
consumers that validate relationship payloads without depending on a runtime
package.

## Install

```bash
pnpm add @voyant-travel/relationships-contracts zod
```

## Usage

```ts
import {
  entityTypeSchema,
  insertPersonSchema,
  personRelationshipKindSchema,
} from "@voyant-travel/relationships-contracts"
```

Runtime validation barrels are exposed from
`@voyant-travel/relationships/validation`.
