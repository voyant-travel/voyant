# `@voyant-travel/plugin-voyant-connect`

Voyant Connect source-adapter bundle for the catalog booking engine.

This package is for deployments that use Voyant Connect. Deployments that use
their own source adapters can skip it and register adapters directly against
`@voyant-travel/catalog/booking-engine`.

## What it provides

- `createVoyantConnectSources(...)` — composes the generic Voyant Connect
  adapter with the structured cruise adapter.
- `registerVoyantConnectSources(registry, sources)` — registers the composed
  sources on a `SourceAdapterRegistry`.
- `listVoyantConnectSourceConnections(...)` — loads active Connect connections
  for discovery sync.
- Cruise sourcing keeps canonical geography, resolves geo names when configured,
  and fills departure-window facets from sailings.
- TUI package-product sourcing enriches destination labels and accommodation
  star ratings for package search projections.

## Supported Connect Package Pairing

This package is tested against:

- `@voyant-travel/connect-adapter@0.3.0`
- `@voyant-travel/connect-cruises@0.4.0`
- `@voyant-travel/connect-sdk@0.9.0`

Keep those three packages in lockstep with this plugin version. The structured
cruise adapter is intentionally wrapped here so deployments do not need to
reimplement the generic-vs-cruise split or bridge external cruise price-component
typing differences themselves.

## Usage

```ts
import { createSourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import {
  createVoyantConnectSources,
  registerVoyantConnectSources,
} from "@voyant-travel/plugin-voyant-connect"

const registry = createSourceAdapterRegistry()

registerVoyantConnectSources(
  registry,
  createVoyantConnectSources({
    apiKey: process.env.VOYANT_API_KEY,
    operatorId: process.env.VOYANT_CONNECT_OPERATOR_ID,
    market: process.env.VOYANT_CONNECT_MARKET,
    syncLimit: process.env.VOYANT_CONNECT_SYNC_LIMIT,
  }),
)
```

Discovery sync should call `listVoyantConnectSourceConnections(...)` first and
pass those connections into `createVoyantConnectSources(...)` so each upstream
connection is registered with its own connection id.
