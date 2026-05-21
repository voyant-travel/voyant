import { access, readdir, readFile } from "node:fs/promises"
import path from "node:path"

const rootDir = process.cwd()

const filePatterns = [".ts", ".tsx"]
const ignoredDirectoryNames = new Set(["dist", "i18n", "node_modules"])
const ignoredFileSuffixes = [".d.ts", ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]
const ignoredLineStarts = ["import ", "export "]
const ignoredLineIncludes = [
  ">=",
  "<=",
  "=> Promise",
  "Promise<",
  "Record<string",
  "Resolver<",
  "z.literal(",
  "z.coerce",
  "function stripUndefined<",
  "function bucketBy<",
  "useForm<",
  "fetchJson<",
  "setField(",
  // TanStack Query / fetch-helper shapes — the JSX-text heuristic mis-fires
  // on `=> api.get<Type>(...)`, queryKey arrays, and bare `method: "PATCH"`
  // wire-protocol strings. These are network plumbing, not user-facing copy.
  "queryFn:",
  "queryKey:",
  "mutationFn:",
  "mutationKey:",
  "api.get<",
  "api.post<",
  "api.patch<",
  "api.put<",
  "api.delete<",
  "= useQuery(",
  "= useMutation(",
  "= useInfiniteQuery(",
  "method: \"",
  "method: '",
  "headers: {",
  "function useEditingToggle<",
]
const nonUserFacingLiterals = new Set([
  "",
  "-",
  " *",
  "?",
  "EUR",
  "GBP",
  "RON",
  "USD",
  "UTC",
  "Europe/Bucharest",
  "FREQ=DAILY;INTERVAL=1",
  // HTTP methods (PATCH, DELETE, OPTIONS are >4 chars so they slip past the
  // generic uppercase fallback).
  "PATCH",
  "DELETE",
  "OPTIONS",
  // RRULE frequency tokens used in product-schedule-form and elsewhere.
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
])

const suspiciousPatterns = [
  />\s*[^<{]*[A-Za-z][^<{]*</,
  /\b(?:title|placeholder|label|description|emptyMessage|buttonLabel|confirmLabel|aria-label)\s*=\s*(?:"[^"]*[A-Za-z][^"]*"|'[^']*[A-Za-z][^']*'|`[^`]*[A-Za-z][^`]*`)/,
  /(?:\?\s*|:\s*|return\s+)(?:"(?:[^"\n]* [^"\n]*|[A-Z][A-Za-z][^"\n]*)"|'(?:[^'\n]* [^'\n]*|[A-Z][A-Za-z][^'\n]*)')/,
]

function extractQuotedStrings(line) {
  return [...line.matchAll(/(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? "",
  )
}

function looksLikeTailwindUtility(value) {
  if (!value.trim()) {
    return false
  }

  return value.split(/\s+/).every((token) => {
    const bareToken = token.replace(/^[a-z0-9_-]+:/i, "")
    return (
      /^(?:[a-z0-9[\]()./%#,:_-]+!?|\[[^\]]+\])$/i.test(token) &&
      (/^(?:absolute|block|contents|flex|grid|hidden|inline|relative|sticky|truncate)$/.test(
        bareToken,
      ) ||
        /(?:^|:)(?:accent|animate|auto|bg|border|bottom|capitalize|center|col|cursor|duration|ease|font|gap|h|inset|items|justify|left|line|lowercase|m|mb|min|ml|mr|mt|mx|my|opacity|overflow|p|pb|pl|pointer|pr|pt|px|py|resize|right|ring|rounded|row|scroll|shadow|shrink|size|sm|space|sr|tabular|text|top|touch|tracking|transition|uppercase|w|whitespace|z)-/.test(
          token,
        ))
    )
  })
}

function isKnownNonUserFacingLiteral(value) {
  return nonUserFacingLiterals.has(value) || /^[A-Z]{2,4}$/.test(value)
}

function shouldIgnoreLine(trimmed) {
  return (
    !trimmed ||
    trimmed.includes("i18n-literal-ok") ||
    ignoredLineStarts.some((prefix) => trimmed.startsWith(prefix)) ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  )
}

function shouldIgnoreSuspiciousLine(trimmed) {
  if (ignoredLineIncludes.some((fragment) => trimmed.includes(fragment))) {
    return true
  }

  const quotedStrings = extractQuotedStrings(trimmed)
  if (quotedStrings.length === 0) {
    return false
  }

  return quotedStrings.every(
    (value) => isKnownNonUserFacingLiteral(value) || looksLikeTailwindUtility(value),
  )
}

function normalizeJsxText(value) {
  return value.replace(/\s+/g, " ").trim()
}

function getPreviousMeaningfulLine(lines, startIndex) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trim()
    if (trimmed) {
      return trimmed
    }
  }

  return ""
}

function getNextMeaningfulLine(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (trimmed) {
      return trimmed
    }
  }

  return ""
}

function looksLikeJsxOpeningContext(trimmed) {
  return (
    trimmed === ">" ||
    /^<[A-Z_a-z][^>]*>$/.test(trimmed) ||
    /[({]\s*<[A-Z_a-z][^>]*>$/.test(trimmed) ||
    /^[A-Za-z_$][\w$]*=.*>$/.test(trimmed)
  )
}

function looksLikeJsxClosingContext(trimmed) {
  return (
    trimmed.startsWith("</") ||
    trimmed.startsWith("<") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith(")")
  )
}

function looksLikeStandaloneJsxText(lines, index) {
  const text = normalizeJsxText(lines[index])

  if (
    !/[A-Za-z]/.test(text) ||
    /[<>{}`=;]/.test(text) ||
    !/^[A-Za-z][A-Za-z0-9 '&/+.-]*[.!?]?$/.test(text) ||
    isKnownNonUserFacingLiteral(text) ||
    looksLikeTailwindUtility(text)
  ) {
    return false
  }

  const previous = getPreviousMeaningfulLine(lines, index)
  const next = getNextMeaningfulLine(lines, index)

  return looksLikeJsxOpeningContext(previous) && looksLikeJsxClosingContext(next)
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectOptInRoots() {
  const roots = []
  const packagesDir = path.join(rootDir, "packages")
  const packageNames = await readdir(packagesDir)

  for (const packageName of packageNames) {
    if (!packageName.endsWith("-ui")) {
      continue
    }

    const i18nEntry = path.join(packagesDir, packageName, "src", "i18n", "index.ts")
    if (await exists(i18nEntry)) {
      roots.push(path.join(packagesDir, packageName, "src"))
    }
  }

  const registryDir = path.join(packagesDir, "ui", "registry")
  const registryNames = await readdir(registryDir)

  for (const registryName of registryNames) {
    const i18nEntry = path.join(registryDir, registryName, "i18n", "index.ts")
    if (await exists(i18nEntry)) {
      roots.push(path.join(registryDir, registryName))
    }
  }

  // Templates opt in to the scan via their admin-i18n shim. We only walk
  // `components/voyant/**` — custom voyant components are pure UI. Server
  // routes (api/, workflows.ts), shadcn ui/ copies, the api-client lib, and
  // TanStack Router page files mix non-UI concerns and would produce noise.
  const templatesDir = path.join(rootDir, "templates")
  const templateNames = await readdir(templatesDir).catch(() => [])

  for (const templateName of templateNames) {
    const adminI18nEntry = path.join(templatesDir, templateName, "src", "lib", "admin-i18n.tsx")
    if (!(await exists(adminI18nEntry))) continue

    const voyantComponents = path.join(templatesDir, templateName, "src", "components", "voyant")
    if (await exists(voyantComponents)) {
      roots.push(voyantComponents)
    }
  }

  return roots.sort()
}

/**
 * Files inside opted-in roots that still contain hardcoded English copy and
 * haven't been threaded through the i18n bundle yet. Listed here so the
 * scanner gates new drift in the rest of the operator template while we work
 * through the backlog. Remove entries as each file is translated.
 *
 * The list is dominated by surfaces that pre-date the i18n migration in the
 * operator template — settings dialogs, the travel composer, resource detail
 * pages — and by `.ts` query helpers whose `queryFn: () => api.get<Type>(...)`
 * shape produces false positives from the JSX-text heuristic. Translate the
 * UI strings and rerun the scanner to confirm before removing an entry.
 */
const HARDCODED_FILE_ALLOWLIST = new Set(
  [
    "templates/dmc/src/components/voyant/availability/availability-rule-detail-page.tsx",
    "templates/dmc/src/components/voyant/availability/availability-start-time-detail-page.tsx",
    "templates/dmc/src/components/voyant/products/product-dialog.tsx",
    "templates/dmc/src/components/voyant/products/product-service-dialog.tsx",
    "templates/dmc/src/components/voyant/products/product-sourced-content-section.tsx",
    "templates/dmc/src/components/voyant/resources/resource-allocation-detail-page.tsx",
    "templates/dmc/src/components/voyant/resources/resource-assignment-detail-page.tsx",
    "templates/dmc/src/components/voyant/resources/resource-detail-page.tsx",
    "templates/dmc/src/components/voyant/resources/resource-pool-detail-page.tsx",
    "templates/dmc/src/components/voyant/settings/team-settings-page.tsx",
    "templates/operator/src/components/voyant/action-ledger/action-ledger-entry-sheet.tsx",
    "templates/operator/src/components/voyant/availability/availability-page.tsx",
    "templates/operator/src/components/voyant/availability/option-resource-templates-panel.tsx",
    "templates/operator/src/components/voyant/booking-journey/operator-booking-journey.tsx",
    "templates/operator/src/components/voyant/bookings/booking-catalog-source-card.tsx",
    "templates/operator/src/components/voyant/bookings/booking-paid-payment-sessions.tsx",
    "templates/operator/src/components/voyant/bookings/booking-pending-payment-sessions.tsx",
    "templates/operator/src/components/voyant/catalog/catalog-booking-page.tsx",
    "templates/operator/src/components/voyant/catalog/catalog-page.tsx",
    "templates/operator/src/components/voyant/checkout/payment-link-trip-summary.tsx",
    "templates/operator/src/components/voyant/crm/person-detail-page.tsx",
    "templates/operator/src/components/voyant/finance/credit-note-dialog.tsx",
    "templates/operator/src/components/voyant/legal/policy-assignment-dialog.tsx",
    "templates/operator/src/components/voyant/legal/policy-dialog.tsx",
    "templates/operator/src/components/voyant/legal/template-dialog.tsx",
    "templates/operator/src/components/voyant/legal/template-version-dialog.tsx",
    "templates/operator/src/components/voyant/products/product-departure-form.tsx",
    "templates/operator/src/components/voyant/products/product-detail-itinerary-section.tsx",
    "templates/operator/src/components/voyant/products/product-detail-sections.tsx",
    "templates/operator/src/components/voyant/products/product-payment-policy-section.tsx",
    "templates/operator/src/components/voyant/products/product-schedule-form.tsx",
    "templates/operator/src/components/voyant/resources/resource-allocation-detail-page.tsx",
    "templates/operator/src/components/voyant/resources/resource-assignment-detail-page.tsx",
    "templates/operator/src/components/voyant/resources/resource-detail-page.tsx",
    "templates/operator/src/components/voyant/resources/resource-pool-detail-page.tsx",
    "templates/operator/src/components/voyant/settings/operator-settings-page.tsx",
    "templates/operator/src/components/voyant/settings/taxes-page.tsx",
    "templates/operator/src/components/voyant/travel-composer/admin-trip-composer-page.tsx",
    "templates/operator/src/components/voyant/travel-composer/admin-trip-composer-panels.tsx",
    "templates/operator/src/components/voyant/travel-composer/storefront-composer-block.tsx",
  ].map((relative) => path.join(rootDir, relative)),
)

async function collectSourceFiles(rootPath) {
  const results = []

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          await walk(nextPath)
        }
        continue
      }

      if (
        filePatterns.some((suffix) => entry.name.endsWith(suffix)) &&
        !ignoredFileSuffixes.some((suffix) => entry.name.endsWith(suffix))
      ) {
        results.push(nextPath)
      }
    }
  }

  await walk(rootPath)
  return results.sort()
}

async function findSuspiciousLines(filePath) {
  const findings = []
  const source = await readFile(filePath, "utf8")
  const lines = source.split("\n")

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (
      shouldIgnoreLine(trimmed) ||
      shouldIgnoreSuspiciousLine(trimmed) ||
      (index > 0 && lines[index - 1].includes("i18n-literal-ok"))
    ) {
      continue
    }

    if (
      suspiciousPatterns.some((pattern) => pattern.test(line)) ||
      looksLikeStandaloneJsxText(lines, index)
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text: normalizeJsxText(trimmed),
      })
    }
  }

  return findings
}

async function main() {
  const roots = await collectOptInRoots()

  if (roots.length === 0) {
    console.log("ui hardcoded string scan skipped: no package-owned i18n entrypoints found.")
    process.exit(0)
  }

  const findings = []

  for (const rootPath of roots) {
    const sourceFiles = await collectSourceFiles(rootPath)
    for (const filePath of sourceFiles) {
      if (HARDCODED_FILE_ALLOWLIST.has(filePath)) continue
      findings.push(...(await findSuspiciousLines(filePath)))
    }
  }

  if (findings.length > 0) {
    console.error("hardcoded UI string scan failed:\n")
    for (const finding of findings) {
      console.error(`- ${path.relative(rootDir, finding.filePath)}:${finding.line} ${finding.text}`)
    }
    process.exit(1)
  }

  console.log(`ui hardcoded string scan passed across ${roots.length} i18n-enabled roots.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
