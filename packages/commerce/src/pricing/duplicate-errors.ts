import { ApiHttpError } from "@voyant-travel/hono"

type DuplicatePricingValueInput = {
  code: string
  message: string
  resource: string
  fields: string[][]
}

/**
 * Translate a duplicate unique-key insert into a deterministic 409 the Settings
 * UI can render as an inline field error, rather than letting the Postgres
 * unique-violation (SQLSTATE 23505) bubble up as a generic 500. Mirrors the
 * `duplicateInventoryValueError` helper so every reference-data create returns
 * the same `{ error, code, details }` shape (voyant#2612).
 */
export function duplicatePricingValueError(input: DuplicatePricingValueInput): ApiHttpError {
  return new ApiHttpError(input.message, {
    status: 409,
    code: input.code,
    details: {
      resource: input.resource,
      issues: input.fields.map((path) => ({
        code: input.code,
        path,
        message: input.message,
      })),
      fields: Object.fromEntries(input.fields.map((path) => [path.join("."), [input.message]])),
    },
  })
}
