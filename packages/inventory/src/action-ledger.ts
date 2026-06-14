import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyant-travel/action-ledger/request-context"
import { actionLedgerService } from "@voyant-travel/action-ledger/service"
import {
  type ActionLedgerTargetTimelinePage,
  actionLedgerTargetTimelineQuerySchema,
  buildActionLedgerTargetTimelinePage,
} from "@voyant-travel/action-ledger/timeline"
import { parseQuery } from "@voyant-travel/hono"
import type { Context } from "hono"
import type { Env } from "./route-env.js"
import type { Product } from "./schema.js"
import { productsService } from "./service.js"

export const productActionLedgerQuerySchema = actionLedgerTargetTimelineQuerySchema

export type ProductActionLedgerListResponse = ActionLedgerTargetTimelinePage
export type ProductLedgerMutationAction = "create" | "update" | "delete" | "duplicate"

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
  return changedMutationFields(input, before, after)
}

export function changedMutationFields(
  input: object,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const fields = Object.keys(input).filter((field) => !ignoredMutationFields.has(field))
  if (!before || !after) return fields.sort()

  return fields.filter((field) => !productValuesEqual(before[field], after[field])).sort()
}

export function productMutationSummary(
  action: ProductLedgerMutationAction,
  fields: string[],
  subject = "product",
) {
  const formattedSubject = subject.trim() || "product"
  if (action === "delete") return `Deleted ${formattedSubject}`
  if (action === "duplicate") return `Duplicated ${formattedSubject}`
  if (fields.length === 0)
    return action === "create" ? `Created ${formattedSubject}` : `Updated ${formattedSubject}`
  const verb = action === "create" ? "Created" : "Updated"
  return `${verb} ${formattedSubject} fields: ${fields.join(", ")}`
}

export async function appendProductMutationLedgerEntry(
  c: Context<Env>,
  input: {
    action: ProductLedgerMutationAction
    productId: string
    changedFields: string[]
    subject?: string
    actionName?: string
    routeOrToolName?: string
    summary?: string
  },
) {
  return appendActionLedgerMutation(c.get("db"), {
    context: getProductActionLedgerRequestContext(c),
    actionName: input.actionName ?? `product.${input.action}`,
    actionKind: input.action === "duplicate" ? "create" : input.action,
    evaluatedRisk: "medium",
    targetType: "product",
    targetId: input.productId,
    routeOrToolName: input.routeOrToolName ?? `products.${input.action}`,
    mutationDetail: {
      summary:
        input.summary ?? productMutationSummary(input.action, input.changedFields, input.subject),
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

const ignoredMutationFields = new Set(["updatedAt", "createdAt"])

export const __test__ = {
  changedMutationFields,
  changedProductFields,
  productMutationSummary,
  productActionLedgerQuerySchema,
}
