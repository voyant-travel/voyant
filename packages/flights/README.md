# @voyantjs/voyant-flights

Phase 3 of the catalog plane. The flights vertical — a partial-adoption module
for live-API flight search and booking.

See [`docs/architecture/catalog-flights-architecture.md`](../../docs/architecture/catalog-flights-architecture.md)
for the full design.

## Install

```bash
pnpm add @voyantjs/voyant-flights
```

## What's in the box

- **`./contract/types`** — `FlightOffer`, `FlightOrder`, `FlightSegment`,
  `FlightSearchRequest`, `FlightBookRequest`, capability ids, `paymentIntent`
  discriminated union. Shapes mirror voyant-cloud's `connect-flight-contract`
  so adapters are portable across `voyant-cloud` and Voyant Catalog.
- **`./contract/adapter`** — `FlightConnectorAdapter` interface (5 core methods
  + capability declarations). Provider-agnostic; implementations come from
  Voyant Connect, third-party providers, or operator-built adapters.
- **`./orchestration/fingerprint`** — Itinerary fingerprint helper. Two
  providers selling the same flight produce identical fingerprints.
- **`./orchestration/fan-out`** — Multi-connection fan-out search:
  parallel `searchFlights` across all of an operator's flight connections,
  per-provider timeout + circuit breaker, dedupe by itinerary fingerprint,
  merged result with `cheapest` + `alternates[]`.
- **`./snapshot`** — Booking-time snapshot capture. Builds a
  `CaptureSnapshotInput` for the catalog plane's `captureSnapshot` /
  `captureSnapshotGraph` from a flight `FlightOffer` + `FlightOrder` pair.
- **`./reference/contract`** — `ReferenceDataProvider` contract (airlines,
  airports, aircraft). Implementable at any layer.
- **`./reference/local-postgres`** — Reference data from plain Postgres
  tables in the operator's own database. **No external service, no network
  call.** The simplest deployment option.
- **`./reference/static-bundle`** — Reference data from a bundled JSON / CSV.

## Phase relationship

Phase 3 is independent of Phase 2 (RAG). Either can ship first; both build on
Phase 1 (`@voyantjs/catalog`).

Flights opt **in** to:
- Booking snapshot graph (the most important participation)
- Provenance shape
- Webhook events
- Source disconnection lifecycle

Flights opt **out** of:
- Search index projection (live fan-out replaces it)
- Editorial overlays (no marketing copy on a flight)
- Embeddings / RAG (Phase 2 explicitly excludes flights)
- Pricing tiers (built into the multi-connection fan-out itself)
- Drift detection (live by definition)

## Usage

### Multi-connection search

```typescript
import { fanOutFlightSearch } from "@voyantjs/voyant-flights/orchestration/fan-out"

const result = await fanOutFlightSearch({
  adapters: [hiskyAdapter, amadeusAdapter, charterConsolidatorAdapter],
  request: {
    slices: [
      { origin: "LHR", destination: "JFK", departureDate: "2026-10-15" },
      { origin: "JFK", destination: "LHR", departureDate: "2026-10-22" },
    ],
    passengers: { adults: 2 },
    cabin: "economy",
  },
  perConnectionTimeoutMs: 5000,
})

// result.offers — merged offers across all connections, deduped by
// itinerary fingerprint, sorted by cheapest price ascending.
// result.perConnection — status + latency per connection.
```

### Reference data — operator's own Postgres tables

```typescript
import {
  createLocalPostgresReferenceProvider,
  createReferenceDataTables,
} from "@voyantjs/voyant-flights/reference/local-postgres"

// Schema lives in the operator's own DB. No external service required.
const reference = createLocalPostgresReferenceProvider({ db })

const ba = await reference.getAirline("BA")
// → { iataCode: "BA", icaoCode: "BAW", name: "British Airways", country: "GB" }
```

See `docs/architecture/catalog-flights-architecture.md` for the full design.
