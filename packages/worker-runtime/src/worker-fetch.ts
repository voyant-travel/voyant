import {
  type ApiDispatch,
  type CreateApiDispatchOptions,
  createApiDispatch,
} from "./api-dispatch.js"
import type { WaitUntilContext } from "./types.js"

export type SsrHandler<Env, Ctx extends WaitUntilContext = WaitUntilContext> = (
  request: Request,
  env: Env,
  ctx: Ctx,
) => Response | Promise<Response>

/** Loads the real SSR handler. Wrap with {@link lazySsr}. */
export type SsrLoader<Env, Ctx extends WaitUntilContext = WaitUntilContext> = () => Promise<
  SsrHandler<Env, Ctx>
>

/**
 * Memoize an SSR-handler loader so the dynamic `import()` of the TanStack Start
 * server graph — React + `react-dom/server` — runs once per isolate and stays
 * OUT of the Worker's startup graph. The SSR handler is only invoked on
 * non-API requests, so API-only isolates never load the React SSR graph at all:
 * the same win `lazyApp` gives the Hono API, applied to the SSR half.
 *
 * Without this, `entry.ts` statically importing `@tanstack/react-start/server`
 * pulls ~2.2 MB of React/`react-dom/server` into module global scope, which
 * Cloudflare parses on every cold isolate before it can answer even
 * `/api/health`.
 */
export function lazySsr<Env, Ctx extends WaitUntilContext = WaitUntilContext>(
  load: SsrLoader<Env, Ctx>,
): SsrHandler<Env, Ctx> {
  let promise: Promise<SsrHandler<Env, Ctx>> | undefined
  return (request, env, ctx) => {
    promise ??= load()
    return promise.then((handler) => handler(request, env, ctx))
  }
}

export interface CreateWorkerFetchOptions<Env, Ctx extends WaitUntilContext = WaitUntilContext> {
  /** An {@link ApiDispatch} instance, or options to build one. */
  api: ApiDispatch<Env, Ctx> | CreateApiDispatchOptions<Env, Ctx>
  /** Handles every non-API request (typically the SSR start handler). */
  ssr: SsrHandler<Env, Ctx>
}

function isApiDispatch<Env, Ctx extends WaitUntilContext>(
  api: ApiDispatch<Env, Ctx> | CreateApiDispatchOptions<Env, Ctx>,
): api is ApiDispatch<Env, Ctx> {
  return "dispatch" in api
}

/**
 * The Worker `fetch` entrypoint: API-prefixed requests go through the
 * prefix-stripping dispatch, everything else goes to SSR. The app's
 * `entry.ts` shrinks to bindings plus this factory call.
 */
export function createWorkerFetch<Env, Ctx extends WaitUntilContext = WaitUntilContext>(
  options: CreateWorkerFetchOptions<Env, Ctx>,
): (request: Request, env: Env, ctx: Ctx) => Promise<Response> {
  const api = isApiDispatch(options.api) ? options.api : createApiDispatch(options.api)

  return async (request, env, ctx) => {
    if (api.isApiRequest(new URL(request.url).pathname)) {
      return api.dispatch(request, env, ctx)
    }
    return options.ssr(request, env, ctx)
  }
}
