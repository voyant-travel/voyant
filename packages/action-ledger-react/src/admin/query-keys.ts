/** Stable TanStack Query keys for the packaged action-ledger admin pages. */
export const actionLedgerQueryKeys = {
  all: ["actionLedger"] as const,
  entries: (filtersKey?: string) =>
    [...actionLedgerQueryKeys.all, "entries", { filtersKey }] as const,
  entry: (id: string) => [...actionLedgerQueryKeys.all, "entry", id] as const,
}
