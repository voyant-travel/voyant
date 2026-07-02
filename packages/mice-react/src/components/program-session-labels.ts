const DATE_TIME_PATTERN = /[T\s](\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?/
const TIME_ONLY_PATTERN = /^(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/

export function formatSessionTimeLabel(startsAt: string | null | undefined): string {
  const value = startsAt?.trim()
  if (!value) return "—"

  return DATE_TIME_PATTERN.exec(value)?.[1] ?? TIME_ONLY_PATTERN.exec(value)?.[1] ?? "—"
}
