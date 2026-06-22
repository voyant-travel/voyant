import { listResponse } from "@voyant-travel/types"
export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return listResponse(data, { total: countResult[0]?.count ?? 0, limit, offset })
}

export function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}
