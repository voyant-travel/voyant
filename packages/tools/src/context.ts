/**
 * Per-request context passed to every tool handler.
 *
 * A deployment constructs this once per agent request (derived from the
 * request's auth grant) and the transport passes the same context to every
 * tool dispatch. Domain packages that need injected services extend this by
 * intersection — e.g. `ToolContext & { trips: TripsToolServices }` — so the
 * `tools` package itself stays free of any domain dependency.
 */
export interface ToolContext {
  /**
   * The leased DB client for this request. Typed `unknown` here so the tools
   * package takes no `@voyant-travel/db` dependency; domain handlers cast it to
   * their expected client type.
   */
  db: unknown
  /** The actor making the request. Drives visibility filtering. */
  actor: Visibility
  /**
   * The audience this grant represents. Carried on the key grant, not inferred
   * from scopes. Usually equal to `actor`; kept distinct so a staff key can act
   * on behalf of a customer audience.
   */
  audience: Visibility
  /** Tenant / operator identifier — usually synthesized into provenance. */
  tenantId: string
  /** Default resolver scope for tools that need locale / audience / market. */
  resolverScope: ResolverScope
  /** Optional runtime hook to keep the isolate alive for background work. */
  waitUntil?(promise: Promise<unknown>): void
}

/**
 * Who a request represents. Mirrors the `Actor`/`Visibility` unions in
 * `@voyant-travel/core` / `@voyant-travel/catalog-contracts`, defined locally so
 * the `tools` package has no cross-package dependency. Structurally assignable
 * to/from those types.
 */
export type Visibility = "staff" | "customer" | "partner" | "supplier"

/**
 * Structural mirror of `@voyant-travel/catalog`'s `ResolverScope`. Declared here
 * (rather than imported) to avoid a runtime dependency on the heavy catalog
 * package; the operator-built scope is structurally assignable.
 */
export interface ResolverScope {
  locale: string
  audience: Visibility
  market: string
  actor: Visibility
}
