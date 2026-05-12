import type { Context } from "hono"

import { contractsService } from "./service.js"
import { isContractTemplateSyntaxError, type RenderTemplateInput } from "./service-shared.js"

export function contractTemplateSyntaxResponse(c: Context, error: unknown) {
  if (!isContractTemplateSyntaxError(error)) {
    throw error
  }

  return c.json(
    {
      error: error.message,
      issues: error.issues,
    },
    400,
  )
}

export function renderPreviewResponse(
  c: Context,
  input: RenderTemplateInput,
  extraData: Record<string, unknown> = {},
) {
  try {
    const rendered = contractsService.renderPreview(input)
    return c.json({ data: { ...extraData, rendered } })
  } catch (error) {
    return contractTemplateSyntaxResponse(c, error)
  }
}
