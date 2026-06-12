import { Liquid } from "liquidjs"

export type StructuredTemplateBodyFormat = "html" | "markdown" | "lexical_json"

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

/**
 * Two engine instances share the same options + filters and differ only in
 * `outputEscape`. LiquidJS does not support per-render `outputEscape`, so
 * HTML-bodied templates render through `liquidHtml` (every `{{ output }}` is
 * HTML-escaped: `& < > " '`) while text-ish bodies (markdown, lexical_json
 * text nodes) render through the plain engine. Template authors opt out of
 * escaping for intentionally-trusted HTML with the built-in `raw` filter:
 * `{{ trustedHtmlBlock | raw }}`. Never pipe customer-supplied data through
 * `raw`.
 */
const liquid = new Liquid({
  strictFilters: false,
  strictVariables: false,
  jsTruthy: true,
})

const liquidHtml = new Liquid({
  strictFilters: false,
  strictVariables: false,
  jsTruthy: true,
  outputEscape: "escape",
})

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** Escape the five HTML-special characters (`& < > " '`). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch)
}

function registerFilter(
  name: string,
  // biome-ignore lint/suspicious/noExplicitAny: matches LiquidJS's FilterImplOptions -- owner: templating; existing suppression is intentional pending typed cleanup.
  handler: (...args: any[]) => unknown,
) {
  liquid.registerFilter(name, handler)
  liquidHtml.registerFilter(name, handler)
}

registerFilter("json", (value: unknown) => JSON.stringify(value ?? null))

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
registerFilter("currency", (value: unknown, currency = "EUR", locale = "en-US") => {
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
registerFilter("cents", (value: unknown, currency = "EUR", locale = "en-US") => {
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
registerFilter("format_date", (value: unknown, preset: unknown = "medium", locale = "en-US") => {
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
})

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
registerFilter("format_time", (value: unknown, preset: unknown = "short", locale = "en-US") => {
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
})

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
 *
 * `htmlEscape` HTML-escapes every interpolated value (both the Liquid
 * and the Mustache-fallback paths). `renderStructuredTemplate` derives
 * it from `bodyFormat` (`"html"` → escaped); set it explicitly when
 * calling `renderStringTemplate` / `renderMustacheTemplate` directly
 * for output that ends up in an HTML context. Authors opt out per
 * output tag with `{{ value | raw }}` (Liquid path only).
 */
export interface RenderTemplateOptions {
  missingValuePlaceholder?: string
  htmlEscape?: boolean
}

export interface TemplateSyntaxIssue {
  message: string
}

function stringifyValue(value: unknown, placeholder?: string, htmlEscape?: boolean): string {
  if (value === null || value === undefined) return placeholder ?? ""
  let str: string
  if (typeof value === "string") {
    str = value === "" && placeholder ? placeholder : value
  } else if (typeof value === "number" || typeof value === "boolean") {
    str = String(value)
  } else {
    str = JSON.stringify(value)
  }
  return htmlEscape ? escapeHtml(str) : str
}

const MUSTACHE_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const LIQUID_CONTROL_RE = /\{%-?[\s\S]*?-?%\}/
const LIQUID_FILTER_RE = /\{\{[\s\S]*\|[\s\S]*\}\}/
const LIQUID_OUTPUT_RE = /\{\{\s*([^}]+?)\s*\}\}/g
const LIQUID_DELIMITER_RE = /\{\{|\{%/
const HAS_DEFAULT_FILTER_RE = /\|\s*default\s*:/i
const TRAILING_RAW_FILTER_RE = /^([\s\S]*?)\|\s*raw\s*$/

/**
 * Inject `| default: <fallback>` into every Liquid output tag that
 * doesn't already chain a `default:` filter. Applied AFTER the rest of
 * the filter chain so transformations like `cents` / `format_date`
 * still run; they return empty strings on missing input, which the
 * `default` filter then replaces with the fallback. Output tags whose
 * authors already wired their own `default: "..."` are left alone.
 *
 * A trailing `| raw` must STAY the last filter — LiquidJS only skips
 * `outputEscape` when the chain ends in `raw` — so for
 * `{{ x | raw }}` the default is injected before it:
 * `{{ x | default: "-" | raw }}`.
 */
function injectDefaultFilter(body: string, fallback: string): string {
  return body.replace(LIQUID_OUTPUT_RE, (full, inner: string) => {
    if (HAS_DEFAULT_FILTER_RE.test(inner)) return full
    const trailingRaw = inner.match(TRAILING_RAW_FILTER_RE)
    if (trailingRaw) {
      return `{{ ${trailingRaw[1]!.trim()} | default: ${JSON.stringify(fallback)} | raw }}`
    }
    return `{{ ${inner.trim()} | default: ${JSON.stringify(fallback)} }}`
  })
}

export function renderMustacheTemplate(
  body: string,
  variables: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  const placeholder = options?.missingValuePlaceholder
  const htmlEscape = options?.htmlEscape === true
  return body.replace(MUSTACHE_RE, (_, path: string) => {
    const resolved = resolvePath(variables, path.trim())
    return stringifyValue(resolved, placeholder, htmlEscape)
  })
}

function shouldUseLiquid(body: string) {
  return LIQUID_CONTROL_RE.test(body) || LIQUID_FILTER_RE.test(body)
}

function validateStringTemplateSyntax(body: string): TemplateSyntaxIssue[] {
  if (!LIQUID_DELIMITER_RE.test(body)) return []

  try {
    liquid.parse(body)
    return []
  } catch (error) {
    return [{ message: error instanceof Error ? error.message : String(error) }]
  }
}

function collectLexicalTextIssues(node: LexicalNode, issues: TemplateSyntaxIssue[]) {
  if (typeof node.text === "string") {
    issues.push(...validateStringTemplateSyntax(node.text))
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectLexicalTextIssues(child, issues)
    }
  }
}

/**
 * Parse-check Liquid syntax without rendering. Rich-text editors can split
 * Liquid delimiters across HTML blocks; validating the raw body catches those
 * templates before they are persisted or previewed.
 */
export function validateStructuredTemplateSyntax(
  body: string,
  bodyFormat: StructuredTemplateBodyFormat,
): TemplateSyntaxIssue[] {
  if (bodyFormat !== "lexical_json") {
    return validateStringTemplateSyntax(body)
  }

  try {
    const parsed: unknown = JSON.parse(body)
    const issues: TemplateSyntaxIssue[] = []
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry && typeof entry === "object") {
          collectLexicalTextIssues(entry as LexicalNode, issues)
        }
      }
      return issues
    }

    if (parsed && typeof parsed === "object") {
      const obj = parsed as { root?: unknown } & Record<string, unknown>
      if (obj.root && typeof obj.root === "object") {
        collectLexicalTextIssues(obj.root as LexicalNode, issues)
        return issues
      }
      collectLexicalTextIssues(obj as LexicalNode, issues)
      return issues
    }

    return []
  } catch {
    return validateStringTemplateSyntax(body)
  }
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
  const engine = options?.htmlEscape === true ? liquidHtml : liquid
  return engine.parseAndRenderSync(processedBody, variables)
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

/**
 * Render a stored template body according to its `bodyFormat`.
 *
 * Escaping semantics: `"html"` bodies render with HTML output-escaping
 * (every interpolated `{{ value }}` has `& < > " '` escaped — Liquid and
 * Mustache-fallback paths alike). Template authors embed
 * intentionally-trusted HTML with the `raw` filter:
 * `{{ trustedHtmlBlock | raw }}`. `"markdown"` bodies and
 * `"lexical_json"` text nodes stay unescaped — they are plain-text
 * formats whose downstream converters handle their own encoding.
 * Callers can force either behavior via `options.htmlEscape`.
 */
export function renderStructuredTemplate(
  body: string,
  bodyFormat: StructuredTemplateBodyFormat,
  variables: Record<string, unknown>,
  renderOptions?: RenderTemplateOptions,
): string {
  const options: RenderTemplateOptions = {
    ...renderOptions,
    htmlEscape: renderOptions?.htmlEscape ?? bodyFormat === "html",
  }
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
