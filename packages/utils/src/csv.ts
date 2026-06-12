/**
 * CSV encoding helpers that are safe against spreadsheet formula injection
 * (CWE-1236). Use these for every CSV export that an operator might open in
 * Excel, Google Sheets, or LibreOffice Calc.
 *
 * Two layers of defense:
 *
 * 1. **Structural quoting** - values containing a delimiter (`,`), a double
 *    quote (`"`), or a line break (`\n` / `\r`) are wrapped in double quotes
 *    with embedded quotes doubled (RFC 4180).
 * 2. **Formula neutralization** - values whose first character is one of
 *    `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with a single
 *    quote (`'`) so spreadsheet applications treat them as text instead of
 *    executing them as formulas (e.g. `=HYPERLINK(...)`, `=cmd|'/c calc'!A1`).
 */

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"])

const NEEDS_QUOTING = /[",\n\r]/

/**
 * Encode a single value as a CSV cell.
 *
 * `null` and `undefined` encode as an empty string. Everything else is
 * stringified via `String(value)`, neutralized against formula injection,
 * and quoted when it contains a delimiter, quote, or line break.
 */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ""

  let stringValue = String(value)

  const first = stringValue.charAt(0)
  if (FORMULA_PREFIXES.has(first)) {
    stringValue = `'${stringValue}`
  }

  if (NEEDS_QUOTING.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }

  return stringValue
}

/**
 * Encode an array of values as a single CSV row (no trailing newline).
 */
export function toCsvRow(values: readonly unknown[]): string {
  return values.map(toCsvCell).join(",")
}
