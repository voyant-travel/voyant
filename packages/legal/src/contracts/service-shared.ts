import { renderStructuredTemplate } from "@voyantjs/utils/template-renderer"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { contractNumberSeries } from "./schema.js"
import type {
  contractListQuerySchema,
  contractTemplateListQuerySchema,
  insertContractAttachmentSchema,
  insertContractNumberSeriesSchema,
  insertContractSchema,
  insertContractSignatureSchema,
  insertContractTemplateSchema,
  insertContractTemplateVersionSchema,
  renderTemplateInputSchema,
  updateContractAttachmentSchema,
  updateContractNumberSeriesSchema,
  updateContractSchema,
  updateContractTemplateSchema,
} from "./validation.js"

export type ContractListQuery = z.infer<typeof contractListQuerySchema>
export type ContractTemplateListQuery = z.infer<typeof contractTemplateListQuerySchema>
export type CreateContractTemplateInput = z.infer<typeof insertContractTemplateSchema>
export type UpdateContractTemplateInput = z.infer<typeof updateContractTemplateSchema>
export type CreateContractTemplateVersionInput = z.infer<typeof insertContractTemplateVersionSchema>
export type CreateContractNumberSeriesInput = z.infer<typeof insertContractNumberSeriesSchema>
export type UpdateContractNumberSeriesInput = z.infer<typeof updateContractNumberSeriesSchema>
export type CreateContractInput = z.infer<typeof insertContractSchema>
export type UpdateContractInput = z.infer<typeof updateContractSchema>
export type CreateContractSignatureInput = z.infer<typeof insertContractSignatureSchema>
export type CreateContractAttachmentInput = z.infer<typeof insertContractAttachmentSchema>
export type UpdateContractAttachmentInput = z.infer<typeof updateContractAttachmentSchema>
export type RenderTemplateInput = z.infer<typeof renderTemplateInputSchema>

export function toTimestamp(value?: string | null): Date | null {
  return value ? new Date(value) : null
}

function resolvePath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  const segments: Array<string | number> = []
  const parts = path.split(".")
  for (const part of parts) {
    if (!part) continue
    const indexMatches = [...part.matchAll(/([^[\]]+)|\[(\d+)\]/g)]
    for (const match of indexMatches) {
      if (match[1] !== undefined) segments.push(match[1])
      else if (match[2] !== undefined) segments.push(Number.parseInt(match[2], 10))
    }
  }
  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof seg === "number") {
      if (!Array.isArray(current)) return undefined
      current = current[seg]
    } else {
      if (typeof current !== "object") return undefined
      current = (current as Record<string, unknown>)[seg]
    }
  }
  return current
}

/**
 * Default placeholder for output tags whose value is null / undefined
 * / empty-string. Applied to every contract render — preview at the
 * storefront, manual previews from the admin, AND the post-confirm
 * auto-generated PDFs — so authored templates don't have to spell out
 * `| default: "-"` on every variable.
 *
 * Authors who prefer a different fallback for a specific variable can
 * still write `{{ foo | default: "TBD" }}` and the renderer leaves
 * their explicit chain alone.
 */
const CONTRACT_MISSING_VALUE_PLACEHOLDER = "-"

export function renderTemplate(
  body: string,
  bodyFormat: "markdown" | "html" | "lexical_json",
  variables: Record<string, unknown>,
): string {
  return renderStructuredTemplate(body, bodyFormat, variables, {
    missingValuePlaceholder: CONTRACT_MISSING_VALUE_PLACEHOLDER,
  })
}

export function validateTemplateVariables(
  variableSchema: unknown,
  values: Record<string, unknown>,
): string[] {
  const issues: string[] = []
  if (!variableSchema || typeof variableSchema !== "object") return issues
  const schema = variableSchema as Record<string, unknown>
  const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : []
  for (const key of requiredList) {
    const resolved = resolvePath(values, key)
    if (resolved === undefined || resolved === null || resolved === "") {
      issues.push(`missing required variable: ${key}`)
    }
  }
  return issues
}

function currentPeriodBoundary(strategy: "never" | "annual" | "monthly", now: Date): Date | null {
  if (strategy === "never") return null
  if (strategy === "annual") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function formatNumber(
  prefix: string,
  separator: string,
  sequence: number,
  padLength: number,
): string {
  const padded = String(sequence).padStart(padLength, "0")
  return `${prefix}${separator}${padded}`
}

export async function allocateContractNumber(
  db: PostgresJsDatabase,
  seriesId: string,
): Promise<{ number: string; sequence: number } | null> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM ${contractNumberSeries}
          WHERE ${contractNumberSeries.id} = ${seriesId}
          FOR UPDATE`,
    )
    const row = (rows as unknown as Array<Record<string, unknown>>)[0]
    if (!row) return null

    const strategy = row.reset_strategy as "never" | "annual" | "monthly"
    const prefix = (row.prefix as string) ?? ""
    const separator = (row.separator as string) ?? ""
    const padLength = (row.pad_length as number) ?? 4
    const currentSequence = (row.current_sequence as number) ?? 0
    const resetAt = row.reset_at ? new Date(row.reset_at as string | Date) : null

    const now = new Date()
    const boundary = currentPeriodBoundary(strategy, now)
    const shouldReset =
      boundary !== null && (resetAt === null || resetAt.getTime() < boundary.getTime())

    const nextSequence = shouldReset ? 1 : currentSequence + 1
    const nextResetAt = strategy === "never" ? resetAt : boundary

    await tx
      .update(contractNumberSeries)
      .set({ currentSequence: nextSequence, resetAt: nextResetAt, updatedAt: new Date() })
      .where(sql`${contractNumberSeries.id} = ${seriesId}`)

    return {
      number: formatNumber(prefix, separator, nextSequence, padLength),
      sequence: nextSequence,
    }
  })
}

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ total: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.total ?? 0, limit, offset }
}
