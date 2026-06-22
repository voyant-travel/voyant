/**
 * Mirror of the ambient shim in `@voyant-travel/hono`. This package imports
 * types from `@voyant-travel/hono/observability`, whose source transitively
 * pulls in `request-context.ts` (`import "node:async_hooks"`). Because that
 * source is compiled under this package's tsconfig — which, like hono's,
 * restricts `types` to `@cloudflare/workers-types` and takes no `@types/node`
 * dependency — the `node:async_hooks` module must be declared locally. We only
 * declare the `AsyncLocalStorage` slice hono consumes.
 */
declare module "node:async_hooks" {
  export class AsyncLocalStorage<T> {
    getStore(): T | undefined
    run<R>(store: T, callback: () => R): R
  }
}
