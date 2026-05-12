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

  return roots.sort()
}

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
      !trimmed ||
      trimmed.includes("i18n-literal-ok") ||
      ignoredLineStarts.some((prefix) => trimmed.startsWith(prefix)) ||
      shouldIgnoreSuspiciousLine(trimmed) ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      continue
    }

    if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
      findings.push({
        filePath,
        line: index + 1,
        text: trimmed,
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
