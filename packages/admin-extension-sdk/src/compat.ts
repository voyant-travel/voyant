/**
 * Dependency-free compatibility check between an extension's declared
 * `extensionApi` range and the admin's implemented API version.
 *
 * Supports the range forms the manifest contract allows: caret (`"^1"`,
 * `"^1.2"`, `"^1.2.3"`), x-ranges / partials (`"1"`, `"1.2"`, `"1.x"`,
 * `"1.2.x"`, `"*"`), and exact versions (`"1.2.3"`). This is deliberately a
 * small hand-rolled matcher rather than a semver dependency — the contract
 * must stay tiny and the accepted grammar is closed. It lives in the SDK so
 * both the admin host (render-time gate) and the cloud/apps resolver
 * (installation-time filter) evaluate compatibility identically.
 */
import { ADMIN_UI_EXTENSION_API_VERSION } from "./version.js"

type Version = [number, number, number]
type PartialToken = number | "x"

function parseVersion(value: string): Version | null {
  const parts = value.trim().split(".")
  if (parts.length !== 3) return null
  const nums: number[] = []
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null
    nums.push(Number(part))
  }
  return [nums[0] as number, nums[1] as number, nums[2] as number]
}

function parsePartial(value: string): PartialToken[] | null {
  const parts = value.trim().split(".")
  if (parts.length === 0 || parts.length > 3) return null
  const tokens: PartialToken[] = []
  for (const part of parts) {
    if (part === "x" || part === "X" || part === "*") {
      tokens.push("x")
      continue
    }
    if (!/^\d+$/.test(part)) return null
    tokens.push(Number(part))
  }
  return tokens
}

function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) {
    const delta = (a[i] as number) - (b[i] as number)
    if (delta !== 0) return delta
  }
  return 0
}

/** Lower bound of a partial: unspecified/`x` segments become 0. */
function lowerBound(tokens: PartialToken[]): Version {
  const filled = [0, 0, 0]
  tokens.forEach((token, index) => {
    filled[index] = token === "x" ? 0 : token
  })
  return [filled[0] as number, filled[1] as number, filled[2] as number]
}

/** Whether every specified (non-`x`) leading segment of the partial matches. */
function matchesXRange(tokens: PartialToken[], target: Version): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === "x") continue
    if (token !== target[index]) return false
  }
  return true
}

function satisfiesCaret(body: string, target: Version): boolean {
  const tokens = parsePartial(body)
  if (!tokens) return false
  const lower = lowerBound(tokens)
  if (compare(target, lower) < 0) return false
  // Caret allows changes that keep the left-most non-zero segment fixed.
  const pivot = lower.findIndex((segment) => segment > 0)
  const upper: Version = [0, 0, 0]
  if (pivot === -1) {
    // "^0.0.0" — only the exact version satisfies.
    return compare(target, lower) === 0
  }
  for (let i = 0; i < pivot; i += 1) upper[i] = lower[i] as number
  upper[pivot] = (lower[pivot] as number) + 1
  return compare(target, upper) < 0
}

export function isUiExtensionCompatible(
  range: string,
  version: string = ADMIN_UI_EXTENSION_API_VERSION,
): boolean {
  const target = parseVersion(version)
  if (!target) return false
  const trimmed = range.trim()
  if (trimmed === "") return false
  if (trimmed === "*" || trimmed === "x" || trimmed === "X") return true

  if (trimmed.startsWith("^")) {
    return satisfiesCaret(trimmed.slice(1), target)
  }

  const tokens = parsePartial(trimmed)
  if (!tokens) return false
  // A fully-specified numeric version is an exact match; anything shorter or
  // containing an `x` is an x-range.
  if (tokens.length === 3 && tokens.every((token) => token !== "x")) {
    return compare(target, tokens as Version) === 0
  }
  return matchesXRange(tokens, target)
}
