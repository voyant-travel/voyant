import type { FieldErrors, FieldValues, Resolver } from "react-hook-form"
import type { z } from "zod/v4"

type FieldErrorLeaf = {
  type: string
  message: string
}

function setFieldError(
  target: Record<string, unknown>,
  path: Array<string | number>,
  error: FieldErrorLeaf,
) {
  let current: Record<string, unknown> = target

  for (let index = 0; index < path.length; index += 1) {
    const key = String(path[index] ?? "root")

    if (index === path.length - 1) {
      current[key] = error
      return
    }

    const next = current[key]
    if (typeof next !== "object" || next === null) {
      current[key] = {}
    }

    current = current[key] as Record<string, unknown>
  }
}

export function zodResolver<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
): Resolver<z.input<TSchema>, unknown, z.output<TSchema>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      }
    }

    const errors: Record<string, unknown> = {}

    for (const issue of result.error.issues) {
      const path = issue.path.filter(
        (segment): segment is string | number => typeof segment !== "symbol",
      )
      const normalizedPath = path.length > 0 ? path : ["root"]
      setFieldError(errors, normalizedPath, {
        type: issue.code,
        message: issue.message,
      })
    }

    return {
      values: {} as Record<string, never>,
      errors: errors as FieldErrors<z.input<TSchema>>,
    }
  }
}
