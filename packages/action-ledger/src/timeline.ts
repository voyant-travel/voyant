import { z } from "zod"

import type { ActionLedgerEntry } from "./schema.js"

export type ActionLedgerTimelineCursor = {
  occurredAt: string
  id: string
}

export type ActionLedgerSerializedEntry = Omit<ActionLedgerEntry, "occurredAt" | "createdAt"> & {
  occurredAt: string
  createdAt: string
}

export type ActionLedgerTargetTimelineEntry = ActionLedgerSerializedEntry & {
  mutationSummary: string | null
}

export interface ActionLedgerTargetTimelinePage {
  data: ActionLedgerTargetTimelineEntry[]
  pageInfo: {
    nextCursor: ActionLedgerTimelineCursor | null
  }
}

export const actionLedgerTargetTimelineQuerySchema = z
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

export type ActionLedgerTargetTimelineQuery = z.infer<typeof actionLedgerTargetTimelineQuerySchema>

export function serializeActionLedgerDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger timeline timestamp must be a valid date")
  }
  return date.toISOString()
}

export function serializeActionLedgerEntry(entry: ActionLedgerEntry): ActionLedgerSerializedEntry {
  return {
    ...entry,
    occurredAt: serializeActionLedgerDate(entry.occurredAt),
    createdAt: serializeActionLedgerDate(entry.createdAt),
  }
}

export function toActionLedgerTimelineCursor(
  entry: Pick<ActionLedgerEntry, "occurredAt" | "id">,
): ActionLedgerTimelineCursor {
  return {
    occurredAt: serializeActionLedgerDate(entry.occurredAt),
    id: entry.id,
  }
}

export function sortActionLedgerTimelineEntries(entries: ActionLedgerEntry[]): ActionLedgerEntry[] {
  return [...entries].sort((a, b) => {
    const occurredAtDelta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    if (occurredAtDelta !== 0) return occurredAtDelta
    return b.id.localeCompare(a.id)
  })
}

export function buildActionLedgerTargetTimelinePage({
  entries,
  limit,
  mutationSummariesByActionId = new Map(),
}: {
  entries: ActionLedgerEntry[]
  limit: number
  mutationSummariesByActionId?: ReadonlyMap<string, string | null>
}): ActionLedgerTargetTimelinePage {
  const entriesById = new Map<string, ActionLedgerEntry>()
  for (const entry of entries) {
    entriesById.set(entry.id, entry)
  }

  const sortedEntries = sortActionLedgerTimelineEntries([...entriesById.values()])
  const visibleEntries = sortedEntries.slice(0, limit)
  const lastEntry = visibleEntries.at(-1)

  return {
    data: visibleEntries.map((entry) => ({
      ...serializeActionLedgerEntry(entry),
      mutationSummary: mutationSummariesByActionId.get(entry.id) ?? null,
    })),
    pageInfo: {
      nextCursor:
        sortedEntries.length > limit && lastEntry ? toActionLedgerTimelineCursor(lastEntry) : null,
    },
  }
}

export const __test__ = {
  actionLedgerTargetTimelineQuerySchema,
  buildActionLedgerTargetTimelinePage,
  serializeActionLedgerDate,
  serializeActionLedgerEntry,
  sortActionLedgerTimelineEntries,
  toActionLedgerTimelineCursor,
}
