# ADR-0006: Live availability-search as a capability-gated source-adapter extension

- **Status:** Accepted (2026-06-22)
- **Relates to:** [ADR-0002](./0002-contract-packages.md) (contract packages), [dynamic-packaging-rfc](../architecture/dynamic-packaging-rfc.md), [catalog-architecture](../architecture/catalog-architecture.md)
- **Implemented by:** voyant#2081 (PR #2084); first keystone of the dynamic-packaging RFC (#1600)

## Context

Dynamic packaging needs to turn a customer brief into an itinerary assembled
from components sourced **live across multiple suppliers**. Before this change
the only live multi-supplier search in the platform was **flights**
(`fanOutFlightSearch` → `MergedFlightOffer`), on a flights-specific connector
contract. The catalog `SourceAdapter` was resolve-then-book
(`discover`/`liveResolve`/`reserve`/`cancel`) — it could re-price an
already-selected entity but could not *search an inventory space*
(destination + dates + pax → ranked options) for non-flight verticals. There was
also no normalized result type a cross-vertical composer could rank.

Two shapes were candidates for "the search result": reuse the flights
`MergedFlightOffer`, or invent a new vertical-agnostic one. And two homes for the
search capability: a new method on the existing `SourceAdapter`, or a separate
adapter interface.

## Decision

1. **Extend the existing `SourceAdapter` contract** with an optional
   `searchAvailability(ctx, request)` method, **capability-gated** by a new
   `AdapterCapabilities.supportsAvailabilitySearch` flag — mirroring how every
   other adapter method is presence/flag gated. No new adapter interface; an
   adapter that can both resolve and search declares both.

2. **A new normalized `AvailabilityCandidate`** (with `AvailabilitySearchRequest`
   / `AvailabilitySearchResult`) in `@voyant-travel/catalog-contracts`, not a
   reuse of `MergedFlightOffer`. Flights are bridged in via
   `mergedFlightOfferToCandidate` — a mapping, **not** proof the generic contract
   already fits flights. The candidate carries a non-replay-safe `candidateRef`,
   the `selection` needed to re-resolve at reserve, a public `price`, an
   `expiresAt`, an origin (`source`), and internal-only `providerData`.

3. **A vertical-agnostic `fanOutAvailabilitySearch`** in `@voyant-travel/catalog`
   mirrors the flights fan-out's partial-success semantics (per-source timeout,
   per-connection status map, ranked merge) and adds: vertical gating (skip
   adapters that don't feed the requested vertical), per-candidate origin
   stamping (so a selection routes back to the right `connectionId` at reserve),
   and per-source pagination cursors.

4. **Owned inventory is a first-class search source** via an
   `OwnedAvailabilitySearchHandlerRegistry`, mirroring the owned-booking-handler
   vs source-adapter split — not modeled as a fake external provider. Owned and
   sourced supply merge into one ranked list.

5. **Net/margin/provenance stay internal.** `providerData` is opaque round-trip
   and must never be serialized into a public DTO; the public surface sees only
   `price`.

## Consequences

- **Contract-first / BYO connector.** The integration point is a public contract;
  Voyant Connect is one (non-privileged) provider, and any deployment can
  implement `searchAvailability` (sourced) or an owned search handler (owned).
  Neither `catalog` nor `catalog-contracts` depends on a provider plugin.
- **Additive / non-breaking.** The method and capability are optional; existing
  adapters are unaffected and the fan-out flags non-search adapters as
  `capability_missing` rather than failing.
- **`candidateRef` is not replay-safe.** Callers (the trips requirement/candidate
  model, voyant#2082) persist candidates as resumable state and re-resolve the
  `selection` before reserve.
- **Validated against two shapes so far** — the flights bridge and an in-test
  mock adapter. A real third-party validation (the Voyant Connect
  `searchAvailability` adapter, in the `connect-sdk` repo) is the follow-up that
  confirms the generic shape fits an external supplier API; if it doesn't fit
  cleanly the contract may need a minor revision before it's BYO-stable.
- **No catalog-plane caching of live fields** — adapter-internal short-TTL only;
  persisted Trip Candidates are resumable trip state, re-validated before commit.

## Alternatives considered

- **Reuse `MergedFlightOffer` as the cross-vertical result.** Rejected: it is
  flights-shaped (itineraries, fare bundles, validating carrier) and would leak
  flight concepts into stays/extras/activities. A normalized candidate keeps the
  composer vertical-agnostic; flights map *into* it.
- **A separate `SearchAdapter` interface.** Rejected: it would split connection
  lifecycle, capabilities, and registration across two contracts for the same
  upstream connection. One adapter with an optional method keeps a connection's
  capabilities in one place.
