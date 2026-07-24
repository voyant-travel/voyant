# @voyant-travel/legal

Legal module for Voyant. Contracts and policies in a single package — templates with variable substitution, versioning, number series, signing workflow, structured cancellation/payment/T&C policies with rule evaluation, assignments, and acceptance tracking.

## Install

```bash
pnpm add @voyant-travel/legal
```

## Usage

```typescript
import { legalApiModule } from "@voyant-travel/legal"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [legalApiModule],
  // ...
})
```

## Entities

### Contracts

- **Contracts** (`cont`) — legal document instances with status lifecycle
- **Contract templates** (`ctpl`) — reusable templates with variable schemas,
  optional channel scope, and explicit storefront defaults
- **Contract template versions** (`ctpv`) — immutable version snapshots
- **Contract signatures** (`ctsi`) — signing records (who/when/method/ip)
- **Contract number series** (`ctns`) — series definitions with auto-increment
- **Contract attachments** (`ctat`) — rendered PDFs and appendices
- **Contract lifecycle command results** — immutable Tool result and delivery-intent
  snapshots keyed by the authoritative action-ledger claim

## Default Storefront Contract Templates

Contract templates can be marked with `isDefault: true`. At most one default
template can exist for a given `(scope, channelId, language)` selector. A
default with `channelId: null` is the global fallback for that scope/language;
a channel-specific default wins when callers pass `channelId`.

Storefronts can resolve the active customer-safe template through:

- `GET /v1/public/legal/contracts/templates/default`
- `GET /v1/admin/legal/contracts/templates/default`

Supported query parameters are `scope` (defaults to `customer`), `channelId`,
`language`, and comma-separated `fallbackLanguages`. Selection checks requested
and fallback languages in order, prefers channel-specific defaults over global
defaults, ignores inactive templates, and falls back to the newest active
matching template only when no explicit default exists for that selector.

## Contract Document Operations

The contracts route surface exposes stable operations for storefront previews
and stored document handling:

- `POST /v1/public/legal/contracts/templates/:id/render-preview`
- `POST /v1/public/legal/contracts/templates/by-slug/:slug/render-preview`
- `POST /v1/admin/legal/contracts/templates/:id/render-preview`
- `POST /v1/admin/legal/contracts/:id/attach-document`
- `POST /v1/admin/legal/contracts/:id/regenerate-pdf`

Preview routes accept `{ variables }` and return only the rendered text. Public
preview routes require the template to be active. `attach-document` expects a
multipart `file` field plus optional `name` and `kind`, uploads through the
configured `documentStorage`, and persists a contract attachment. `regenerate-pdf`
uses the configured contract document generator and replaces the canonical
generated document artifact.

## Contract Lifecycle

Contract lifecycle transitions are enforced by the contract service:

```text
draft -> issued -> sent -> signed -> executed
```

Contracts may be voided from any non-void stage. Each service transition appends
to `stageHistory` and emits a domain event when an event bus is configured:
`contract.issued`, `contract.sent`, `contract.signed`, `contract.executed`, or
`contract.voided`. Event payloads are intentionally minimal: contract IDs,
relationship IDs, stage names, and timestamps only; rendered bodies, variables,
metadata, and signature details stay out of the event payload.

The approved issue, send, and execute Tools use a stricter durable command path.
The action-ledger claim, locked transition, immutable result snapshot, and
deterministic lifecycle outbox event commit atomically. Exact retries return the
original snapshot without repeating the transition or event. Send snapshots keep
the original recipient, subject, and message in both the Legal command record and
the outbox event, so subscriber-owned delivery never depends on request memory.
Request-scoped event buses and lifecycle hooks are not part of Tool command
success; outbox subscribers own durable delivery and retry.
Lifecycle command records keep `contractId` as a soft immutable reference so
exact replay and audit history survive a later void and permitted contract
deletion.

## Agent Tools

The selected module publishes staff-only, typed Tools from `@voyant-travel/legal/tools` for:

- contract, template, policy, term, and attachment inspection;
- draft creation and guarded contract-template authoring;
- approved issue, send, and execute lifecycle transitions; and
- booking-contract preview, generation, and provider-authorized document delivery.

Lifecycle Tools never create signature evidence and do not expose void/delete operations. Signing
remains with the authoritative customer/provider workflow, while destructive lifecycle operations
remain unavailable until a deployment selects an explicit destructive-action policy. Generated
document delivery returns only an authorized URL and never exposes private storage keys.
Regeneration is separate from ordinary generation because it replaces the previous document record;
the graph marks it critical, irreversible, ledger-required, and approval-required under the named
`legal.contract-document.regeneration.v1` policy.

### Policies

- **Policies** (`pol`) — policy definitions by kind (cancellation, payment, T&C, etc.)
- **Policy versions** (`plvr`) — immutable version snapshots with publish/retire lifecycle
- **Policy rules** (`plrl`) — structured rules per version (cancellation windows, percentages)
- **Policy assignments** (`plas`) — scope-based assignment to products, channels, markets
- **Policy acceptances** (`plac`) — acceptance records per booking/order/person

## Exports

| Entry | Description |
| --- | --- |
| `.` | Combined module export + all linkable definitions |
| `./contracts` | Contract barrel (types, tables, service, validation) |
| `./contracts/schema` | Drizzle tables for contracts |
| `./contracts/validation` | Zod schemas for contracts |
| `./contracts/routes` | Hono routes for contracts (admin + public) |
| `./contracts/service` | Contract service functions |
| `./policies` | Policy barrel (types, tables, service, validation) |
| `./policies/schema` | Drizzle tables for policies |
| `./policies/validation` | Zod schemas for policies |
| `./policies/routes` | Hono routes for policies (admin + public) |
| `./policies/service` | Policy service functions |
| `./tools` | Tool definitions and per-request legal/document service contribution |

## License

Apache-2.0
