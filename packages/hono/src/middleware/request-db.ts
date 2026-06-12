import {
  type DbFactory,
  resolveDbFactoryResult,
  type VoyantBindings,
  type VoyantDb,
} from "../types.js"

/** See db middleware: structural shape avoids a hard `@cloudflare/workers-types` dep. */
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Minimal structural slice of a Hono `Context` that the request-db
 * helpers need. Typed structurally so unit tests can pass a stub and so
 * this module doesn't constrain the app's `Variables` generic.
 */
export interface RequestDbContextLike<TBindings extends VoyantBindings = VoyantBindings> {
  req: { raw: Request }
  env: TBindings
  /**
   * Hono throws on `executionCtx` access in runtimes without one (Node
   * tests, some adapters) — callers of {@link acquireRequestDb} never
   * touch it directly; we read it defensively inside `release`.
   */
  executionCtx?: unknown
}

export interface RequestDbLease {
  db: VoyantDb
  /**
   * Whether this lease created the underlying client. Only the creator's
   * `release()` disposes; reuse leases are no-ops, so the client stays
   * alive until the outermost (creating) middleware's `finally` runs —
   * which is after the entire downstream pipeline has completed.
   */
  isCreator: boolean
  /**
   * Settle the lease. For the creating lease this schedules `dispose()`
   * via `executionCtx.waitUntil` (or awaits inline outside Workers).
   * Idempotent; reuse leases resolve immediately.
   */
  release: () => Promise<void>
}

interface RequestDbHolder {
  db: VoyantDb
  dispose?: () => Promise<void>
  disposed: boolean
}

/**
 * Per-request db holders, keyed by the raw `Request` then by factory
 * identity. One `createApp` instance passes the same `config.db` factory
 * to the auth, permission, and db middlewares — so all of them resolve
 * the same holder and the request opens a single client instead of one
 * per middleware (previously 2–3 Neon WebSocket pools per authenticated
 * request). The WeakMap keeps holders from outliving their request.
 */
const requestDbHolders = new WeakMap<Request, Map<unknown, RequestDbHolder>>()

function readExecutionCtx(c: RequestDbContextLike): ExecutionContextLike | undefined {
  try {
    const ctx = c.executionCtx as ExecutionContextLike | undefined
    if (ctx && typeof ctx.waitUntil === "function") return ctx
  } catch {
    // Hono throws when the adapter provides no ExecutionContext.
  }
  return undefined
}

/**
 * Resolve the shared per-request db client for `factory`, creating it on
 * first acquisition. The creating caller MUST call `lease.release()` in
 * a `finally` after its `next()` completes; later acquirers within the
 * same request reuse the client and their `release()` is a no-op.
 */
export function acquireRequestDb<TBindings extends VoyantBindings>(
  c: RequestDbContextLike<TBindings>,
  factory: DbFactory<TBindings>,
): RequestDbLease {
  let byFactory = requestDbHolders.get(c.req.raw)
  if (!byFactory) {
    byFactory = new Map()
    requestDbHolders.set(c.req.raw, byFactory)
  }

  const existing = byFactory.get(factory)
  if (existing && !existing.disposed) {
    return { db: existing.db, isCreator: false, release: async () => {} }
  }

  const { db, dispose } = resolveDbFactoryResult(factory(c.env))
  const holder: RequestDbHolder = { db, dispose, disposed: false }
  byFactory.set(factory, holder)

  return {
    db,
    isCreator: true,
    release: async () => {
      if (holder.disposed) return
      holder.disposed = true
      if (!holder.dispose) return
      // `waitUntil` keeps the Workers isolate alive for the close
      // handshake without delaying the response; outside Workers we
      // await inline so tests and Node deployments clean up too.
      const ctx = readExecutionCtx(c)
      if (ctx) {
        ctx.waitUntil(holder.dispose())
      } else {
        await holder.dispose()
      }
    },
  }
}
