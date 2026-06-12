import { type DependencyList, useCallback, useEffect } from "react"

/**
 * Normalize unknown values into an Error instance.
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === "string") {
    return new Error(error)
  }
  return new Error(String(error))
}

/**
 * Wrap an async handler with consistent error logging and normalization.
 */
export function useAsyncHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<unknown>,
): (...args: TArgs) => Promise<void> {
  return useCallback(
    async (...args: TArgs) => {
      try {
        await handler(...args)
      } catch (error) {
        const normalized = toError(error)
        console.error("Async handler error:", normalized)
        throw normalized
      }
    },
    [handler],
  )
}

/**
 * React hook to run async effects with built-in error handling.
 */
export function useEffectAsync(
  effect: () => Promise<undefined | (() => void)>,
  deps: DependencyList,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps is the explicit contract of this helper hook -- owner: operator; existing suppression is intentional pending typed cleanup.
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false

    effect()
      .then((result) => {
        if (!cancelled && typeof result === "function") {
          cleanup = result
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("useEffectAsync error:", toError(error))
        }
      })

    return () => {
      cancelled = true
      if (cleanup) {
        cleanup()
      }
    }
  }, deps)
}
