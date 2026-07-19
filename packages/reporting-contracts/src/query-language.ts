import type { ReportQuery, ReportScalar } from "./contracts.js"
import { reportingIdentifierSchema, reportQuerySchema } from "./contracts.js"

const forbiddenSource =
  /(?:;|--|\/\*|\*\/|\b(?:join|union|insert|update|delete|drop|alter|create|grant|revoke|truncate|execute|call)\b)/i
const aggregateFunctions = {
  count: "count",
  countdistinct: "countDistinct",
  sum: "sum",
  average: "average",
  avg: "average",
  minimum: "minimum",
  min: "minimum",
  maximum: "maximum",
  max: "maximum",
} as const

/** Error raised when the bounded report query language cannot compile a source string. */
export class ReportQuerySyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportQuerySyntaxError"
  }
}

/**
 * Error a dataset raises when a query is well-formed but not answerable against
 * that dataset (e.g. summing amounts across currencies without grouping). The
 * reporting API surfaces it as a 400 so authors see the reason instead of a 500.
 * Dataset packages extend this so the reporting layer can recognise their
 * domain errors without importing each dataset package.
 */
export class ReportDatasetQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportDatasetQueryError"
  }
}

/**
 * Compile the intentionally small reporting language into the public query AST.
 * It is SQL-like for familiarity but has no joins, subqueries, statements, or
 * table access. Dataset owners remain responsible for executing the AST.
 */
export function parseReportQuery(source: string): ReportQuery {
  const normalized = source.trim().replace(/\s+/g, " ")
  if (normalized.length === 0) throw syntax("Query source is empty.")
  if (normalized.length > 10_000) throw syntax("Query source exceeds 10,000 characters.")
  if (forbiddenSource.test(normalized)) throw syntax("Query contains a forbidden construct.")
  if (normalized.includes("*")) throw syntax("Wildcard selections are not supported.")

  const clauses = normalized.match(
    /^from\s+(\S+?)(?:\s+where\s+(.+?))?(?:\s+group\s+by\s+(.+?))?\s+select\s+(.+?)(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+))?$/i,
  )
  if (!clauses) {
    throw syntax(
      "Expected `from <dataset> [where ...] [group by ...] select ... [order by ...] [limit ...]`.",
    )
  }

  const [, datasetSource, filterSource, groupSource, selectSource, orderSource, limitSource] =
    clauses
  const dataset = parseIdentifier(datasetSource, "dataset")
  const query = {
    dataset: { id: dataset },
    select: splitList(required(selectSource, "select")).map(parseSelection),
    filters: filterSource ? splitAnd(filterSource).map(parseFilter) : [],
    groupBy: groupSource ? splitList(groupSource).map(parseGroup) : [],
    orderBy: orderSource ? splitList(orderSource).map(parseOrder) : [],
    limit: limitSource ? Number.parseInt(limitSource, 10) : undefined,
  }
  const parsed = reportQuerySchema.safeParse(query)
  if (!parsed.success) throw syntax(parsed.error.issues[0]?.message ?? "Invalid report query.")
  return parsed.data
}

function parseSelection(source: string): ReportQuery["select"][number] {
  const aggregate = source.match(/^([a-z]+)\(([^)]*)\)\s+as\s+([a-z0-9][a-z0-9._/-]*)$/i)
  if (aggregate) {
    const operation =
      aggregateFunctions[aggregate[1]?.toLowerCase() as keyof typeof aggregateFunctions]
    if (!operation) throw syntax(`Unsupported aggregate function ${JSON.stringify(aggregate[1])}.`)
    const fieldSource = aggregate[2]?.trim()
    if (operation !== "count" && !fieldSource) {
      throw syntax(`${aggregate[1]}() requires a field.`)
    }
    return {
      kind: "aggregate",
      operation,
      ...(fieldSource ? { field: parseIdentifier(fieldSource, "aggregate field") } : {}),
      as: parseIdentifier(aggregate[3], "selection alias"),
    }
  }
  const field = source.match(/^([a-z0-9][a-z0-9._/-]*)(?:\s+as\s+([a-z0-9][a-z0-9._/-]*))?$/i)
  if (!field) throw syntax(`Unsupported selection ${JSON.stringify(source)}.`)
  return {
    kind: "field",
    field: parseIdentifier(field[1], "selected field"),
    ...(field[2] ? { as: parseIdentifier(field[2], "selection alias") } : {}),
  }
}

function parseFilter(source: string): ReportQuery["filters"][number] {
  const nullFilter = source.match(/^([a-z0-9][a-z0-9._/-]*)\s+is\s+(not\s+)?null$/i)
  if (nullFilter) {
    return {
      field: parseIdentifier(nullFilter[1], "filter field"),
      operator: nullFilter[2] ? "isNotNull" : "isNull",
    }
  }
  const match = source.match(
    /^([a-z0-9][a-z0-9._/-]*)\s+(not\s+in|in|between|contains|>=|<=|!=|=|>|<)\s+(.+)$/i,
  )
  if (!match) throw syntax(`Unsupported filter ${JSON.stringify(source)}.`)
  const operator = {
    "=": "equal",
    "!=": "notEqual",
    ">": "greaterThan",
    ">=": "greaterThanOrEqual",
    "<": "lessThan",
    "<=": "lessThanOrEqual",
    in: "in",
    "not in": "notIn",
    between: "between",
    contains: "contains",
  } as const
  const operatorKey = required(match[2], "filter operator")
    .toLowerCase()
    .replace(/\s+/g, " ") as keyof typeof operator
  return {
    field: parseIdentifier(match[1], "filter field"),
    operator: operator[operatorKey],
    value: parseValueReference(required(match[3], "filter value")),
  }
}

function parseValueReference(source: string): ReportQuery["filters"][number]["value"] {
  const value = source.trim()
  if (value.startsWith("$")) {
    return { kind: "parameter", name: parseIdentifier(value.slice(1), "parameter") }
  }
  // Lists accept both `[...]` and SQL-style `(...)` for `in`/`not in`/`between`.
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("(") && value.endsWith(")"))
  ) {
    const inner = value.slice(1, -1).trim()
    const values = inner ? splitList(inner).map(parseLiteral) : []
    return { kind: "literal", value: values }
  }
  return { kind: "literal", value: parseLiteral(value) }
}

function parseLiteral(source: string): ReportScalar {
  const value = source.trim()
  if (/^'.*'$/.test(value) || /^".*"$/.test(value)) return value.slice(1, -1)
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false
  if (/^null$/i.test(value)) return null
  throw syntax(`Literal ${JSON.stringify(source)} must be quoted, numeric, boolean, or null.`)
}

function parseGroup(source: string): ReportQuery["groupBy"][number] {
  const bucket = source.match(/^(day|week|month|quarter|year)\(([a-z0-9][a-z0-9._/-]*)\)$/i)
  if (bucket) {
    return {
      field: parseIdentifier(bucket[2], "group field"),
      timeGrain: required(bucket[1], "time grain").toLowerCase() as
        | "day"
        | "week"
        | "month"
        | "quarter"
        | "year",
    }
  }
  return { field: parseIdentifier(source, "group field") }
}

function parseOrder(source: string): ReportQuery["orderBy"][number] {
  const match = source.match(/^([a-z0-9][a-z0-9._/-]*)(?:\s+(asc|desc))?$/i)
  if (!match) throw syntax(`Unsupported ordering ${JSON.stringify(source)}.`)
  return {
    by: parseIdentifier(match[1], "order field"),
    direction: match[2]?.toLowerCase() === "desc" ? "descending" : "ascending",
  }
}

function splitList(source: string): string[] {
  const values: string[] = []
  let quote: string | undefined
  let depth = 0
  let start = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = undefined
      continue
    }
    if (character === "'" || character === '"') quote = character
    else if (character === "(" || character === "[") depth += 1
    else if (character === ")" || character === "]") depth -= 1
    else if (character === "," && depth === 0) {
      values.push(source.slice(start, index).trim())
      start = index + 1
    }
    if (depth < 0) throw syntax("Unbalanced query delimiters.")
  }
  if (quote || depth !== 0) throw syntax("Unbalanced query delimiters.")
  values.push(source.slice(start).trim())
  if (values.some((value) => value.length === 0)) throw syntax("Query list contains an empty item.")
  return values
}

function splitAnd(source: string): string[] {
  // AND inside quoted literals remains part of the literal.
  const parts: string[] = []
  let quote: string | undefined
  let start = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = undefined
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (source.slice(index).match(/^\s+and\s+/i)) {
      const separator = required(source.slice(index).match(/^\s+and\s+/i)?.[0], "AND separator")
      parts.push(source.slice(start, index).trim())
      index += separator.length - 1
      start = index + 1
    }
  }
  parts.push(source.slice(start).trim())
  return parts
}

function parseIdentifier(value: string | undefined, label: string): string {
  const parsed = reportingIdentifierSchema.safeParse(value)
  if (!parsed.success) throw syntax(`Invalid ${label} ${JSON.stringify(value)}.`)
  return parsed.data
}

function required(value: string | undefined, label: string): string {
  if (!value) throw syntax(`Missing ${label}.`)
  return value
}

function syntax(message: string): ReportQuerySyntaxError {
  return new ReportQuerySyntaxError(message)
}
