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
their `connection.id`. The live booking-engine registry should match that so
`bookEntity` (which resolves by `source_connection_id` first) routes a sourced
booking to its connection's adapter rather than a connection-agnostic fallback.

Because a synchronous registry can't await connection enumeration, the
recommended pattern is **register the un-scoped default synchronously, then warm
the per-connection adapters in the background**:

```ts
// synchronous: register the un-scoped default pair as the cold-window fallback
registerVoyantConnectSources(
  registry,
  createVoyantConnectSources(resolveVoyantConnectEnv(env) ?? { operatorId: "" }),
)

// then, per isolate, enumerate connections and register them onto the SAME
// registry instance — tie the promise to the request via ctx.waitUntil on
// Workers so it isn't torn down when the request ends
const sources = await prepareVoyantConnectSources(env, { enumerate: true })
registerVoyantConnectSources(registry, sources)
```

`register(connectionId, adapter)` entries coexist with `default:<kind>`, so
`resolveByConnection` routes precisely once warm while the by-kind fallback
covers the cold window. The operator starter implements this in
`booking-engine-runtime.ts` (`getBookingEngineRegistryFromContext` warms via
`ctx.waitUntil`; async batch jobs use `ensureBookingEngineRegistry`).
