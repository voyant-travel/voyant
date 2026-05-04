import { Liquid } from "liquidjs"

export type StructuredTemplateBodyFormat = "html" | "markdown" | "lexical_json"

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

const liquid = new Liquid({
  strictFilters: false,
  strictVariables: false,
  jsTruthy: true,
})

liquid.registerFilter("json", (value: unknown) => JSON.stringify(value ?? null))

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * `currency` — Intl.NumberFormat currency style. Expects a decimal amount
 * (`123.45`). Example: `{{ amount | currency: "EUR", "en-US" }}` →
 * `"€123.45"`. Falls back to `String(value)` when the value isn't a number.
 */
liquid.registerFilter("currency", (value: unknown, currency = "EUR", locale = "en-US") => {
  const num = parseNumber(value)
  if (num === null) return String(value ?? "")
  return new Intl.NumberFormat(String(locale), {
    style: "currency",
    currency: String(currency || "EUR"),
  }).format(num)
})

/**
 * `cents` — Shortcut for formatting integer cents (`12345` → `"€123.45"`).
 * Saves every template from `{{ (amountCents | divided_by: 100) | currency: ... }}`.
 */
liquid.registerFilter("cents", (value: unknown, currency = "EUR", locale = "en-US") => {
  const num = parseNumber(value)
  if (num === null) return String(value ?? "")
  return new Intl.NumberFormat(String(locale), {
    style: "currency",
    currency: String(currency || "EUR"),
  }).format(num / 100)
})

/**
 * `format_date` — ISO/string/Date → locale-formatted date. Second arg chooses
 * the preset: `"short"` (`01/15/2026`), `"medium"` (default, `Jan 15, 2026`),
 * `"long"` (`January 15, 2026`), `"iso"` (`2026-01-15`), or `"time"`
 * (delegates to `format_time` — `08:30`). Pair with a locale for
 * Romanian/etc.: `{{ startsAt | format_date: "medium", "ro-RO" }}`.
 */
liquid.registerFilter(
  "format_date",
  (value: unknown, preset: unknown = "medium", locale = "en-US") => {
    if (value === null || value === undefined || value === "") return ""
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    const p = String(preset ?? "medium").toLowerCase()
    if (p === "iso") return date.toISOString().slice(0, 10)
    if (p === "time") {
      // Delegate to `format_time`'s default short shape so authors
      // can pipe a single `format_date: "time"` without remembering
      // to switch filters.
      return date.toLocaleTimeString(String(locale), { hour: "2-digit", minute: "2-digit" })
    }
    const options: Intl.DateTimeFormatOptions =
      p === "short"
        ? { year: "numeric", month: "2-digit", day: "2-digit" }
        : p === "long"
          ? { year: "numeric", month: "long", day: "numeric" }
          : { year: "numeric", month: "short", day: "numeric" }
    return date.toLocaleDateString(String(locale), options)
  },
)

/**
 * `format_time` — ISO/string/Date → locale-formatted time-of-day.
 * Second arg picks the preset: `"short"` (default, `08:30`),
 * `"medium"` (`08:30:42`), `"iso"` (`08:30:42` — same as medium but
 * always 24-hour). Locale defaults to `en-US`; pass `"ro-RO"` etc.
 * for locale-aware formatting (12 vs. 24 hour). Falls back to the
 * raw value when not parseable.
 *
 * Examples:
 *   `{{ contract.signedAt | format_time }}`               → `"08:30"`
 *   `{{ contract.signedAt | format_time: "medium" }}`     → `"08:30:42"`
 *   `{{ contract.signedAt | format_time: "short", "ro-RO" }}` → `"08:30"`
 */
liquid.registerFilter(
  "format_time",
  (value: unknown, preset: unknown = "short", locale = "en-US") => {
    if (value === null || value === undefined || value === "") return ""
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    const p = String(preset ?? "short").toLowerCase()
    if (p === "iso") {
      // 24-hour HH:MM:SS regardless of locale, useful for audit-
      // trail copy where consistency beats locale courtesy.
      return date.toISOString().slice(11, 19)
    }
    const options: Intl.DateTimeFormatOptions =
      p === "medium"
        ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
        : { hour: "2-digit", minute: "2-digit" }
    return date.toLocaleTimeString(String(locale), options)
  },
)

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
 * Optional render hooks. `missingValuePlaceholder` substitutes a
 * literal (typically `"-"`) for any output tag whose resolved value is
 * null / undefined / empty-string. Numbers (including 0) and
 * booleans are stringified as-is — they aren't "missing".
 */
export interface RenderTemplateOptions {
  missingValuePlaceholder?: string
}

function stringifyValue(value: unknown, placeholder?: string): string {
  if (value === null || value === undefined) return placeholder ?? ""
  if (typeof value === "string") {
    return value === "" && placeholder ? placeholder : value
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

const MUSTACHE_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const LIQUID_CONTROL_RE = /\{%-?[\s\S]*?-?%\}/
const LIQUID_FILTER_RE = /\{\{[\s\S]*\|[\s\S]*\}\}/
const LIQUID_OUTPUT_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const HAS_DEFAULT_FILTER_RE = /\|\s*default\s*:/i

/**
 * Inject `| default: <fallback>` into every Liquid output tag that
 * doesn't already chain a `default:` filter. Applied AFTER the rest of
 * the filter chain so transformations like `cents` / `format_date`
 * still run; they return empty strings on missing input, which the
 * `default` filter then replaces with the fallback. Output tags whose
 * authors already wired their own `default: "..."` are left alone.
 */
function injectDefaultFilter(body: string, fallback: string): string {
  return body.replace(LIQUID_OUTPUT_RE, (full, inner: string) => {
    if (HAS_DEFAULT_FILTER_RE.test(inner)) return full
    return `{{ ${inner.trim()} | default: ${JSON.stringify(fallback)} }}`
  })
}

export function renderMustacheTemplate(
  body: string,
  variables: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  const placeholder = options?.missingValuePlaceholder
  return body.replace(MUSTACHE_RE, (_, path: string) => {
    const resolved = resolvePath(variables, path.trim())
    return stringifyValue(resolved, placeholder)
  })
}

function shouldUseLiquid(body: string) {
  return LIQUID_CONTROL_RE.test(body) || LIQUID_FILTER_RE.test(body)
}

export function renderStringTemplate(
  body: string,
  variables: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  if (!shouldUseLiquid(body)) {
    return renderMustacheTemplate(body, variables, options)
  }

  const processedBody = options?.missingValuePlaceholder
    ? injectDefaultFilter(body, options.missingValuePlaceholder)
    : body
  return liquid.parseAndRenderSync(processedBody, variables)
}

function walkLexical(
  node: LexicalNode,
  variables: Record<string, unknown>,
  options?: RenderTemplateOptions,
): LexicalNode {
  const next: LexicalNode = { ...node }
  if (typeof next.text === "string") {
    next.text = renderStringTemplate(next.text, variables, options)
  }
  if (Array.isArray(next.children)) {
    next.children = next.children.map((child) => walkLexical(child, variables, options))
  }
  return next
}

export function renderStructuredTemplate(
  body: string,
  bodyFormat: StructuredTemplateBodyFormat,
  variables: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  if (bodyFormat === "lexical_json") {
    try {
      const parsed: unknown = JSON.parse(body)
      if (Array.isArray(parsed)) {
        return JSON.stringify(
          parsed.map((entry) => {
            if (entry && typeof entry === "object") {
              return walkLexical(entry as LexicalNode, variables, options)
            }
            return entry
          }),
        )
      }
      if (parsed && typeof parsed === "object") {
        const obj = parsed as { root?: unknown } & Record<string, unknown>
        if (obj.root && typeof obj.root === "object") {
          const result = {
            ...obj,
            root: walkLexical(obj.root as LexicalNode, variables, options),
          }
          return JSON.stringify(result)
        }
        return JSON.stringify(walkLexical(obj as LexicalNode, variables, options))
      }
      return body
    } catch {
      return renderStringTemplate(body, variables, options)
    }
  }

  return renderStringTemplate(body, variables, options)
}
