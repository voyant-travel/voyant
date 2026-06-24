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
export const openApiValidationHook: Hook<any, any, any, unknown> = (result, c) => {
  // Hono's json validator yields `{}` (not a parse) when the request's
  // content-type isn't one its parser accepts; partial PATCH schemas then
  // validate `{}` and silently no-op. Enforce the content-type the route's
  // contract declares so a missing/unaccepted header is a clean invalid_request
  // 400 (voyant#2114, §16). The pattern MIRRORS Hono's own `jsonRegex`
  // (hono/dist/validator/validator.js) EXACTLY — case-sensitive, strict params —
  // so "this guard accepts" ⟺ "Hono parses the body". A laxer check (e.g. a
  // case-insensitive match or a bare trailing `;`) would admit content-types
  // Hono leaves unparsed, reintroducing the silent no-op. Keep in sync with Hono.
  if (result.target === "json") {
    const contentType = c.req.header("content-type")
    const jsonContentType = /^application\/([a-z-.]+\+)?json(;\s*[a-zA-Z0-9-]+=([^;]+))*$/
    if (!contentType || !jsonContentType.test(contentType)) {
      throw new RequestValidationError("Expected request Content-Type: application/json")
    }
  }
  if (!result.success) {
    throw normalizeValidationError(result.error) ?? new RequestValidationError("Invalid request")
  }
}
