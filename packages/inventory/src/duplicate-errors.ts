import { ApiHttpError } from "@voyant-travel/hono"

type DuplicateInventoryValueInput = {
  code: string
  message: string
  resource: string
  fields: string[][]
}

export function duplicateInventoryValueError(input: DuplicateInventoryValueInput): ApiHttpError {
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
