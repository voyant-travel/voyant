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
- `resolveVoyantConnectEnv(env)` / `prepareVoyantConnectSources(env, opts)` —
  map `VOYANT_CONNECT_*` env into source registrations in one call (key
  fallback, operator id, market, sync limit, incomplete-config warning). Use
  these so the live booking-engine registry and the discovery-sync CLI share
  one configuration path and can't drift.
- Cruise sourcing keeps canonical geography, resolves geo names when configured,
  and fills departure-window facets from sailings.
- TUI package-product sourcing enriches destination labels and accommodation
  star ratings for package search projections.

## Supported Connect Package Pairing

This package is tested against:

- `@voyant-travel/connect-adapter@0.3.0`
- `@voyant-travel/connect-cruises@0.5.0`
- `@voyant-travel/connect-sdk@0.9.0`

Keep those three packages in lockstep with this plugin version. The structured
cruise adapter is intentionally wrapped here so deployments do not need to
reimplement the generic-vs-cruise split. `connect-cruises@0.5.0` aligned the
price-component `kind` union; the wrapper still maps `fetchShip`'s deck plan
field (`imageUrl` → `planImageUrl`) and nullable deck/cabin fields so deck plans
survive into cruise content. Remaining ship-shape alignment is tracked in
[connect-sdk#81](https://github.com/voyant-travel/connect-sdk/issues/81).

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

## Env-driven wiring

`prepareVoyantConnectSources` resolves `VOYANT_CONNECT_*` env and returns the
registrations directly, so both registries share one configuration path:

```ts
// discovery-sync CLI — enumerate connections, register one set per connection
registerVoyantConnectSources(
  registry,
  await prepareVoyantConnectSources(process.env, {
    enumerate: true,
    warn: (m) => console.warn(`[sync-sources] ${m}`),
  }),
)

// live booking-engine registry — synchronous, so register the un-scoped default
registerVoyantConnectSources(
  registry,
  createVoyantConnectSources(resolveVoyantConnectEnv(env) ?? { operatorId: "" }),
)
```

### Book-path vs sync-path connection scoping

The discovery sync enumerates connections and registers one connection-scoped
adapter set per connection (`enumerate: true`), so sourced rows are keyed by
their `connection.id`. The live booking-engine registry is initialized
synchronously and registers the **un-scoped default** adapter pair instead —
`bookEntity` resolves by `source_connection_id` first and falls back to the
by-kind adapter, so sourced bookings still dispatch. Making the live registry
also register per-connection requires an async-warmed (e.g. `ctx.waitUntil`)
registry; that's tracked as a follow-up to issue #1976.
