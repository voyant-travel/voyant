import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger/request-context"
import { actionLedgerService } from "@voyantjs/action-ledger/service"
import {
  type ActionLedgerTargetTimelinePage,
  actionLedgerTargetTimelineQuerySchema,
  buildActionLedgerTargetTimelinePage,
} from "@voyantjs/action-ledger/timeline"
import { parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import type { Env } from "./route-env.js"
import type { Product } from "./schema.js"
import { productsService } from "./service.js"

export const productActionLedgerQuerySchema = actionLedgerTargetTimelineQuerySchema

export type ProductActionLedgerListResponse = ActionLedgerTargetTimelinePage

export function getProductActionLedgerRequestContext(
  c: Context<Env>,
): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}

export function changedProductFields(
  input: Partial<Product>,
  before: Product | null,
  after: Product | null,
): string[] {
  const fields = Object.keys(input).filter(
    (field) => field !== "updatedAt" && field !== "createdAt",
  )
  if (!before || !after) return fields.sort()

  return fields
    .filter(
      (field) => !productValuesEqual(before[field as keyof Product], after[field as keyof Product]),
    )
    .sort()
}

export function productMutationSummary(action: "create" | "update" | "delete", fields: string[]) {
  if (action === "delete") return "Deleted product"
  if (fields.length === 0) return action === "create" ? "Created product" : "Updated product"
  const verb = action === "create" ? "Created" : "Updated"
  return `${verb} product fields: ${fields.join(", ")}`
}

export async function appendProductMutationLedgerEntry(
  c: Context<Env>,
  input: {
    action: "create" | "update" | "delete"
    productId: string
    changedFields: string[]
  },
) {
  return appendActionLedgerMutation(c.get("db"), {
    context: getProductActionLedgerRequestContext(c),
    actionName: `product.${input.action}`,
    actionKind: input.action === "delete" ? "delete" : input.action,
    evaluatedRisk: "medium",
    targetType: "product",
    targetId: input.productId,
    routeOrToolName: `products.${input.action}`,
    mutationDetail: {
      summary: productMutationSummary(input.action, input.changedFields),
      reversalKind: "none",
    },
  })
}

export async function listProductActionLedger(c: Context<Env>) {
  const productId = c.req.param("id")
  if (!productId) return c.json({ error: "Product not found" }, 404)

  const product = await productsService.getProductById(c.get("db"), productId)
  if (!product) return c.json({ error: "Product not found" }, 404)

  const query = parseQuery(c, productActionLedgerQuerySchema)
  const limit = query.limit ?? 50
  const result = await actionLedgerService.listEntries(c.get("db"), {
    targetType: "product",
    targetId: product.id,
    cursor: query.cursor,
    limit: limit + 1,
  })
  const page = buildActionLedgerTargetTimelinePage({
    entries: result.entries,
    limit,
  })
  const details = await Promise.all(
    page.data.map((entry) => actionLedgerService.getEntry(c.get("db"), entry.id)),
  )
  const summariesByActionId = new Map(
    details.flatMap((detail) =>
      detail ? [[detail.entry.id, detail.mutationDetail?.summary ?? null] as const] : [],
    ),
  )

  return c.json(
    buildActionLedgerTargetTimelinePage({
      entries: result.entries,
      limit,
      mutationSummariesByActionId: summariesByActionId,
    }) satisfies ProductActionLedgerListResponse,
  )
}

function productValuesEqual(left: unknown, right: unknown) {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime()
    const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime()
    return leftTime === rightTime
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

export const __test__ = {
  changedProductFields,
  productMutationSummary,
  productActionLedgerQuerySchema,
}
