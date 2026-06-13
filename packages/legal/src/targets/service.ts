import type { LegalTargetKind } from "./schema.js"

export interface LegalTargetInput {
  bookingId?: string | null
  targetKind?: LegalTargetKind | null
  targetId?: string | null
  targetProvider?: string | null
  targetSourceRef?: string | null
  legacyTransactionOfferId?: string | null
  legacyTransactionOrderId?: string | null
}

export function normalizeLegalTargetFields(input: LegalTargetInput) {
  const bookingId = input.bookingId ?? null
  return {
    targetKind: input.targetKind ?? (bookingId ? "booking" : null),
    targetId: input.targetId ?? bookingId,
    targetProvider: input.targetProvider ?? null,
    targetSourceRef: input.targetSourceRef ?? null,
    legacyTransactionOfferId: input.legacyTransactionOfferId ?? null,
    legacyTransactionOrderId: input.legacyTransactionOrderId ?? null,
  }
}

export function normalizeLegalTargetUpdateFields(input: LegalTargetInput) {
  const keys: Array<keyof LegalTargetInput> = [
    "bookingId",
    "targetKind",
    "targetId",
    "targetProvider",
    "targetSourceRef",
    "legacyTransactionOfferId",
    "legacyTransactionOrderId",
  ]
  if (!keys.some((key) => Object.hasOwn(input, key))) return {}
  return normalizeLegalTargetFields(input)
}
