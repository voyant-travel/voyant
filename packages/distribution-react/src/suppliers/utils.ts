export function maybeNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

export function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function formatUnit(unit: string): string {
  return unit.replace(/_/g, " ")
}
