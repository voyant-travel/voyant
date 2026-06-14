export function maybeNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}
