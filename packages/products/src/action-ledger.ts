import {
  type ActionLedgerRequestContextValues,
  appendActionLedgerMutation,
} from "@voyantjs/action-ledger/request-context"
import type { ActionLedgerEntry } from "@voyantjs/action-ledger/schema"
import { actionLedgerService } from "@voyantjs/action-ledger/service"
import { parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { z } from "zod"
import type { Env } from "./routes.js"
import type { Product } from "./schema.js"
import { productsService } from "./service.js"

export const productActionLedgerQuerySchema = z
  .object({
    cursorOccurredAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(199).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorOccurredAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorOccurredAt ? ["cursorId"] : ["cursorOccurredAt"],
      message: "cursorOccurredAt and cursorId must be provided together",
    })
  })
  .transform(({ cursorOccurredAt, cursorId, ...query }) => ({
    ...query,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

export interface ProductActionLedgerListResponse {
  data: Array<
    Omit<ActionLedgerEntry, "occurredAt" | "createdAt"> & {
      occurredAt: string
      createdAt: string
      mutationSummary: string | null
    }
  >
  pageInfo: {
    nextCursor: {
      occurredAt: string
      id: string
    } | null
  }
}

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

export function serializeProductActionLedgerDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Product action ledger timestamp must be a valid date")
  }
  return date.toISOString()
}

export function serializeProductActionLedgerEntry(
  entry: ActionLedgerEntry,
  mutationSummary: string | null,
) {
  return {
    ...entry,
    occurredAt: serializeProductActionLedgerDate(entry.occurredAt),
    createdAt: serializeProductActionLedgerDate(entry.createdAt),
    mutationSummary,
  }
}

export function toProductActionLedgerCursor(entry: Pick<ActionLedgerEntry, "occurredAt" | "id">) {
  return {
    occurredAt: serializeProductActionLedgerDate(entry.occurredAt),
    id: entry.id,
  }
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
  const entries = result.entries.slice(0, limit)
  const lastEntry = entries.at(-1)
  const nextCursor =
    result.entries.length > limit && lastEntry ? toProductActionLedgerCursor(lastEntry) : null
  const details = await Promise.all(
    entries.map((entry) => actionLedgerService.getEntry(c.get("db"), entry.id)),
  )
  const summariesByActionId = new Map(
    details.flatMap((detail) =>
      detail ? [[detail.entry.id, detail.mutationDetail?.summary ?? null] as const] : [],
    ),
  )

  return c.json({
    data: entries.map((entry) =>
      serializeProductActionLedgerEntry(entry, summariesByActionId.get(entry.id) ?? null),
    ),
    pageInfo: {
      nextCursor,
    },
  } satisfies ProductActionLedgerListResponse)
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
