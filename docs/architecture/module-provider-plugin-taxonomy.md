# Voyant Module, Provider, Extension, And Plugin Taxonomy

This guide defines how Voyant should classify reusable packages and extension
surfaces.

The goal is straightforward:

- keep the architecture vocabulary small
- avoid turning every package into a “plugin”
- make the primary customization seams obvious
- keep distribution concerns separate from runtime concerns

Voyant should prefer a few explicit categories over a large generic extension
system.

## Core Rules

### 1. Modules are the main architecture unit

Modules are the primary way Voyant packages business and infrastructure
capabilities.

Examples:

- `bookings`
- `inventory`
- `commerce`
- `operations`
- `finance`
- `legal`
- `notifications`

Modules should own:

- their core services
- their data model
- their route surfaces
- their local domain logic

Rule:

If a package defines a real capability with its own records and behavior, it is
usually a module first.

### 2. Travel modules and infrastructure modules are different

Voyant modules fall into two broad categories:

- travel/domain modules
- infrastructure modules

Travel modules define the travel language of the framework:

- bookings
- departures
- pricing
- suppliers
- finance
- legal

Infrastructure modules provide technical support capabilities:

- notifications
- auth/identity
- storage
- verification

Rule:

Business capabilities should be treated as travel modules. Technical support
capabilities should be treated as infrastructure modules.

### 3. Providers are the main swap point

Providers are the primary way to make concrete implementations replaceable.

Examples:

- payment providers
- notification providers
- storage providers
- bank-transfer instruction resolvers

Providers should:

- implement a narrow contract
- stay focused on one execution seam
- hide vendor-specific details behind that contract

Rule:

If the question is “how do I swap one implementation for another?”, the answer
should usually be a provider, not a plugin.

### 4. Adapters connect Voyant to external systems

Adapters are integration packages that connect Voyant capabilities to external
vendors or services.

Examples:

- Netopia
- SmartBill
- CMS sync packages

An adapter may expose:

- one or more providers
- a small extension
- route or webhook wiring
- workflow helpers

Rule:

If a package exists primarily to talk to an external system, treat it as an
adapter package even if it also exports a plugin bundle.

In federated operating mode, an adapter may connect Voyant to a system that
remains authoritative for selected data or operations. See
[`federated-operating-mode.md`](./federated-operating-mode.md) for the
source-of-truth modes, source connection expectations, and when an adapter needs
a provider, extension, module, or plugin bundle around it.

### 5. Extensions customize existing module behavior

Extensions add or modify behavior around existing module surfaces.

Examples:

- finance sync hooks
- supplier-specific booking logic
- custom link/query hydration
- admin widgets for an existing module

Extensions should not be treated as new domain modules unless they introduce a
new bounded capability with its own records and lifecycle.

Rule:

If the package customizes an existing module rather than defining a new
capability, it is an extension.

### 6. Plugins are distribution bundles

Plugins are packaging and distribution units.

A plugin may bundle:

- modules
- extensions
- providers
- routes
- subscribers
- admin contributions

But that does not make “plugin” the main runtime abstraction.

Rule:

Use plugins when you want to ship a reusable bundle across projects. Do not use
plugins as the default answer to every customization problem.

## Decision Rules

### 7. Start with the narrowest category that fits

When introducing a new package or extension point, choose the narrowest correct
classification first.

Use this order:

1. provider
2. adapter
3. extension
4. module
5. plugin bundle

That keeps the architecture honest and avoids inflating simple seams into a
meta-framework.

Rule:

Do not start with “plugin”. Start with the smallest seam that actually matches
the job.

### 8. Keep distribution separate from runtime semantics

The runtime question is:

- module?
- provider?
- extension?
- adapter?

The packaging question is:

- should this ship as a plugin bundle?

Those are not the same decision.

Rule:

A package can be distributed as a plugin bundle while still being, at runtime,
primarily a provider or extension package.

### 9. Avoid leaking internal implementation structure as public API

Packages may contain many internal helpers and supporting services.

That does not mean every internal part should become part of the supported
cross-package surface.

Modules should expose one main public service surface where possible.
Providers should expose one narrow contract.
Extensions should expose the specific registration points they need.

Rule:

Keep the public package surface smaller than the internal implementation
surface.

## Packaging Guidance

### 9a. Keep provider and plugin runtime graphs lazy when they are request-owned

Provider and plugin seams are also performance boundaries. If a provider or
plugin imports a large service graph but is only used by request handlers,
webhooks, subscribers, or bootstrap work, register it lazily instead of
constructing the concrete value in the deployment's app module.

Rules:

- Provider containers may use `lazyProvider(() => import(...))` for service
  objects or async provider functions whose first real use happens inside a
  request/event path.
- `lazyProvider(...)` is only valid for async functions or object surfaces whose
  consumed members are async methods. Do not use it for plain properties,
  sync-returning methods, query builders, or mixed service objects; narrow the
  provider contract first.
- Hono plugin bundles that would import heavy adapter code may use
  `defineLazyHonoBundle(...)` with eager metadata (`name`, `anonymous`, and
  absolute route matchers) plus a lazy `load` factory.
- Anonymous webhook/callback paths must stay eager metadata on the lazy bundle,
  so the first inbound unauthenticated request is admitted before the bundle is
  imported.
- Transactional lazy bundle surfaces must declare eager
  `transactionalModules` or `transactionalPaths` metadata. The app selects the
  request DB before lazy route handlers run, so transaction ownership cannot be
  discovered from the loaded bundle on the first request.
- Lazy bundles that must register subscribers, workflow metadata, container
  services, or bootstrap work before a bundle-owned route is hit must opt into
  app bootstrap loading with `loadOnBootstrap`.

Rule:

Do not statically import a heavy provider/plugin implementation in the
deployment app closure when the framework can mount a lazy provider or lazy
bundle seam with the same runtime behavior.

Verification:

- After building a deployment, measure the static closure of the generated API
  app chunk with `node scripts/measure-static-import-closure.mjs <dist/server/assets/app-*.js>`.
  The script walks static imports and stops at dynamic `import(...)` boundaries.

### 10. Prefer clear names that reveal the package role

Prefer names that reveal whether the package is:

- a core module
- a provider/adapter
- a frontend runtime package
- a UI/block package

Examples:

- `@voyant-travel/bookings`
- `@voyant-travel/storefront-react`
- `@voyant-travel/admin`
- `@voyant-travel/plugin-netopia`

The package name does not have to carry the full taxonomy, but it should not
hide the package’s role either.

Rule:

Package naming should reinforce the architecture, not blur it.

### 11. Plugin authoring should stay lightweight

When a reusable bundle does need to ship as a plugin, Voyant should keep the
authoring model simple:

- clear exports
- clear allowed bundle contents
- lightweight scaffold path
- predictable registration shape

Do not turn plugin authoring into a second framework within the framework.

Rule:

Plugin packaging should be deliberate and ergonomic, not magical.

## Practical Checklist

When classifying a new reusable capability:

1. Ask whether it is defining a real capability or only swapping an
   implementation.
2. If it swaps an implementation, prefer a provider.
3. If it connects to an external vendor, treat it as an adapter package.
4. If it customizes existing module behavior, treat it as an extension.
5. If it introduces a new bounded capability, make it a module.
6. Only wrap the result as a plugin when you need to distribute a reusable
   bundle across projects.

## Non-Goals

This guide does not introduce:

- a universal plugin system
- a requirement that every reusable package ship as a plugin
- a ban on bundled packages that combine multiple seams

The point is clear package taxonomy, not extra ceremony.
