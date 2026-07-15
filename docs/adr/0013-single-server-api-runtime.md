# ADR-0013: Hono is the sole server API runtime

- **Status:** Accepted (2026-07-15)
- **Relates to:** [ADR-0002](./0002-contract-packages.md),
  [ADR-0012](./0012-application-authoring-and-product-defaults.md),
  [API route authoring](../architecture/api-route-authoring.md), and
  [API route ownership and composition](../architecture/api-route-ownership-and-composition.md)

## Context

Voyant has standardized every package-owned server route and composed application
on Hono. No second server router is supported or planned. The existing public
vocabulary still called `@voyant-travel/hono` a default transport adapter and
named deployment contributions `HonoModule`, `HonoExtension`, and `HonoBundle`.
Core comments even cited a hypothetical Next.js adapter.

That language creates a seam with only one implementation. It also leaks the
implementation name into package manifests and domain interfaces even though
callers are selecting API capabilities, not choosing a router.

The concrete package remains useful. Domain runtime packages depend on its route
composition types and helpers, while `@voyant-travel/framework` depends on the
domain packages. Folding the implementation into the framework would invert that
dependency direction or create cycles.

## Decision

1. Hono is the sole server API runtime implementation. Voyant does not define or
   advertise a replaceable server-router adapter seam.
2. `@voyant-travel/hono` remains a separate infrastructure package and keeps its
   implementation-specific name. Hono-specific route construction, middleware,
   context, and host integration live there or in concrete route implementations.
3. Product and deployment interfaces use role-based vocabulary:
   `ApiModule`, `ApiExtension`, `ApiBundle`, `LazyApiBundle`, and related API
   names.
4. Package runtime entry points use `./api-runtime`; they do not use `./hono` or
   `./hono-module`.
5. The repository is beta. The old names and entry points are removed directly;
   no deprecated aliases, compatibility exports, or duplicate runtime paths are
   retained.

## Consequences

- Package manifests describe API contributions without implying router choice.
- Hono remains visible where it is concrete and useful: imports, route builders,
  middleware, typed contexts, and the `@voyant-travel/hono` implementation package.
- Domain packages and the generated deployment graph have one vocabulary for API
  composition.
- Consumers must update imports and exported factory names in the same release.
- Replacing Hono would require a new architecture decision and a repository-wide
  migration; it is not an extension point preserved in advance.

## Alternatives considered

### Keep the Hono-prefixed public vocabulary

Rejected. It describes implementation mechanics at every call site and preserves
a hypothetical adapter seam with no second implementation.

### Rename `@voyant-travel/hono` to a framework-neutral package

Rejected. Its interface and implementation deliberately expose Hono primitives.
A neutral package name would hide a concrete dependency without creating real
substitutability.

### Fold the Hono implementation into `@voyant-travel/framework`

Rejected. Domain packages need API composition interfaces, while the framework
depends on those domain packages. Keeping the lower-level implementation package
preserves the dependency graph and concentrates server API behavior.
