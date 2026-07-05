// biome-ignore lint/suspicious/noExplicitAny: provider proxies preserve arbitrary service method signatures -- owner: hono runtime.
type AnyAsyncFunction = (...args: any[]) => Promise<unknown>

export type AsyncMethodProvider<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never
}

/**
 * Build a memoized proxy for a provider/service value that is expensive to
 * import eagerly. Method calls and direct function calls resolve the target on
 * first use, cache it for the isolate/process, and retry after a failed load.
 *
 * This helper is only for async provider seams. Object providers must expose
 * async methods only; plain properties and sync-returning methods are outside
 * the contract because a proxy cannot distinguish `service.flag` from
 * `service.method` until call time.
 */
export function lazyProvider<T extends AnyAsyncFunction>(load: () => Promise<T>): T
export function lazyProvider<T extends object>(
  load: () => Promise<AsyncMethodProvider<T>>,
): AsyncMethodProvider<T>
export function lazyProvider<T extends object | AnyAsyncFunction>(
  load: () => Promise<T>,
): T | AsyncMethodProvider<Extract<T, object>> {
  let targetPromise: Promise<T> | undefined

  function resolveTarget() {
    if (!targetPromise) {
      targetPromise = load().catch((error) => {
        targetPromise = undefined
        throw error
      })
    }
    return targetPromise
  }

  const callable = async (...args: Parameters<AnyAsyncFunction>) => {
    const target = await resolveTarget()
    if (typeof target !== "function") {
      throw new TypeError("Lazy provider target is not callable")
    }
    return target(...args)
  }

  return new Proxy(callable, {
    apply: (_target, thisArg, args) =>
      resolveTarget().then((target) => {
        if (typeof target !== "function") {
          throw new TypeError("Lazy provider target is not callable")
        }
        return Reflect.apply(target, thisArg, args)
      }),
    get: (_target, prop) => {
      if (prop === "then") return undefined
      if (prop === "toString") return () => "[lazy provider]"
      if (prop === Symbol.toStringTag) return "LazyProvider"
      return async (...args: Parameters<AnyAsyncFunction>) => {
        const target = await resolveTarget()
        const value = Reflect.get(target, prop, target)
        if (typeof value !== "function") {
          if (args.length === 0) return value
          throw new TypeError(`Lazy provider property "${String(prop)}" is not callable`)
        }
        return Reflect.apply(value, target, args)
      }
    },
  }) as T | AsyncMethodProvider<Extract<T, object>>
}
