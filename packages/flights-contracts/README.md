# @voyantjs/flights-contracts

Pure flight `SourceAdapter` contracts, schemas, and reference-data shapes for
adapter implementers and external consumers that need to integrate flight
providers without the flights runtime.

Use this package for the `FlightConnectorAdapter` contract, the flight contract
types (offers, orders, segments, search, booking, post-book operations), the
matching Zod schemas, and the `ReferenceDataProvider` reference-data shapes
(plus the static-bundle provider). Use `@voyantjs/flights` when you also need
the orchestration fan-out, snapshot capture, local-Postgres reference provider,
or other runtime integration with the catalog plane.

## Install

```bash
pnpm add @voyantjs/flights-contracts zod
```

## Exports

- `./contract/types` — flight contract types (offers, orders, segments,
  search, booking, ancillaries, seat maps, capability ids).
- `./contract/adapter` — the `FlightConnectorAdapter` contract + adapter
  context/capabilities and the `CAPABILITY_NOT_SUPPORTED` helpers.
- `./contract/schemas` — Zod schemas mirroring the contract types.
- `./contract/post-book-types` — post-book operation types (seat selection,
  check-in, modify, refund, void, SSR).
- `./reference/contract` — the `ReferenceDataProvider` contract + reference
  data shapes (airline, airport, aircraft).
- `./reference/static-bundle` — the in-memory static-bundle reference provider.

## Usage

```ts
import {
  flightSearchRequestSchema,
  type FlightConnectorAdapter,
} from "@voyantjs/flights-contracts"
```

`@voyantjs/flights` re-exports this contract surface, so existing
`@voyantjs/flights/contract/*` and `@voyantjs/flights/reference/*` import paths
remain unchanged for applications that already depend on the full runtime
package.
