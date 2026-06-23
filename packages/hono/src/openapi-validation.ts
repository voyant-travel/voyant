import type { Hook } from "@hono/zod-openapi"
import { normalizeValidationError, RequestValidationError } from "./validation.js"

/**
 * Shared `OpenAPIHono` `defaultHook` (voyant#2114).
 *
 * `@hono/zod-openapi` validates `request` schemas before the handler runs;
 * without a hook it returns `@hono/zod-validator`'s raw `safeParse` result as a
 * bare 400, bypassing the framework's `parseQuery`/`parseJsonBody` path and the
 * shared `{ error, code: "invalid_request", requestId, details }` contract that
 * clients and the error-boundary rely on. This hook re-routes failures through
 * the same `RequestValidationError` so `.openapi()` routes stay on-contract.
 *
 * Every module that constructs an `OpenAPIHono` must pass it:
 *
 *     new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
 *
 * (Validation runs on the instance that owns the route, so a hook on the
 * composed root app does NOT cover mounted module sub-apps.)
 */
// Typed as the library's own `defaultHook` shape (`Hook<any, E, any, any>`) so
// it stays assignable for every module's specific `OpenAPIHono<Env>`.
// biome-ignore lint/suspicious/noExplicitAny: matches @hono/zod-openapi's defaultHook signature
export const openApiValidationHook: Hook<any, any, any, unknown> = (result) => {
  if (!result.success) {
    throw normalizeValidationError(result.error) ?? new RequestValidationError("Invalid request")
  }
}
