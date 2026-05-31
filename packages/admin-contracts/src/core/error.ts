import { z } from "zod"

/**
 * Admin API error envelope. Wire-compatible with `@voyantjs/types`'
 * `apiErrorSchema` (`{ error, code?, requestId?, details? }`); defined here so
 * the contract package stays zod-only and owns its client-facing error shape.
 */
export const adminErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type AdminError = z.infer<typeof adminErrorSchema>

/**
 * Thrown by `@voyantjs/admin-client` when a deployment returns a non-2xx
 * response. Carries the HTTP status and the parsed error envelope so callers
 * can branch on `status` / `code` without re-reading the body.
 */
export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: AdminError,
  ) {
    super(body.error)
    this.name = "AdminApiError"
  }

  get code(): string | undefined {
    return this.body.code
  }

  get requestId(): string | undefined {
    return this.body.requestId
  }
}

/**
 * Parse an arbitrary response body into an `AdminError`, tolerating non-conforming
 * bodies (falls back to a stringified message). Used by clients to normalize
 * error responses.
 */
export function toAdminError(status: number, body: unknown): AdminError {
  const parsed = adminErrorSchema.safeParse(body)
  if (parsed.success) return parsed.data
  if (typeof body === "string" && body.length > 0) return { error: body }
  return { error: `Request failed with status ${status}` }
}
