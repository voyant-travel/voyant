function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function queryRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.filter(isRecord)
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows.filter(isRecord)
  }
  return []
}
