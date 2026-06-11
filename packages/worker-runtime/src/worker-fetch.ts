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
