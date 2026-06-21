/**
 * Minimal local declaration for the slice of `node:async_hooks` this package
 * uses. `@voyant-travel/hono` is a Workers-targeted package whose tsconfig
 * restricts `types` to `@cloudflare/workers-types` (no `@types/node`), yet the
 * `AsyncLocalStorage` runtime class is provided both by Node and by Cloudflare
 * Workers under the `nodejs_compat` / `nodejs_als` compatibility flag. Declaring
 * just what we consume keeps us off a hard `@types/node` dependency without
 * pulling Node's ambient globals into the Workers type surface.
 */
declare module "node:async_hooks" {
  export class AsyncLocalStorage<T> {
    getStore(): T | undefined
    run<R>(store: T, callback: () => R): R
  }
}
