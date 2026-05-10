import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const args = new Set(process.argv.slice(2))
const changedOnly = args.has("--changed")
const reportOnly = args.has("--report-only")

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const textExtensions = new Set([...codeExtensions, ".md", ".json", ".css", ".sql"])
const skipPrefixes = [
  "node_modules/",
  "dist/",
  ".turbo/",
  ".next/",
  "coverage/",
  "apps/registry/public/",
]
const generatedSuffixes = [".d.ts"]
const generatedPathParts = ["/routeTree.gen.", "/__generated__/", "/generated/"]
const sizeWarnLines = 500
const sizeFailLines = 600

const findings = []

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" })
  if (result.error) throw result.error
  if (result.status !== 0) return []
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function extensionOf(file) {
  const ext = path.extname(file)
  return ext || ""
}

function isSkipped(file) {
  return skipPrefixes.some((prefix) => file.startsWith(prefix))
}

function isGenerated(file) {
  return (
    generatedSuffixes.some((suffix) => file.endsWith(suffix)) ||
    generatedPathParts.some((part) => file.includes(part)) ||
    file.includes("/drizzle/meta/") ||
    file.includes("/migrations/meta/")
  )
}

function collectChangedFiles() {
  return new Set([
    ...runGit(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...runGit(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ])
}

function collectTrackedFiles() {
  return new Set(runGit(["ls-files"]))
}

function collectFiles() {
  const candidates = changedOnly ? collectChangedFiles() : collectTrackedFiles()
  return [...candidates]
    .filter((file) => existsSync(file))
    .filter((file) => {
      try {
        return statSync(file).isFile()
      } catch {
        return false
      }
    })
    .filter((file) => textExtensions.has(extensionOf(file)))
    .filter((file) => !isSkipped(file))
    .sort()
}

function addFinding(severity, file, line, rule, message) {
  findings.push({ severity, file, line, rule, message })
}

function hasReason(line) {
  return /(?:because|reason|TODO|FIXME|#[0-9]+|https?:\/\/|owner:|intentional)/i.test(line)
}

function scanFile(file) {
  const ext = extensionOf(file)
  const isCode = codeExtensions.has(ext)
  const source = readFileSync(file, "utf8")
  const lines = source.split(/\r?\n/)

  if (isCode && !isGenerated(file)) {
    if (lines.length > sizeFailLines) {
      addFinding(
        "error",
        file,
        1,
        "file-size",
        `${lines.length} lines exceeds ${sizeFailLines}; split the file or document an exception`,
      )
    } else if (lines.length > sizeWarnLines) {
      addFinding(
        "warn",
        file,
        1,
        "file-size",
        `${lines.length} lines exceeds ${sizeWarnLines}; consider splitting before it becomes hard to review`,
      )
    }
  }

  for (const [index, line] of lines.entries()) {
    const lineNo = index + 1

    if (isCode) {
      if (/\/\/\s*@ts-ignore\b/.test(line) || /\/\/\s*@ts-nocheck\b/.test(line)) {
        addFinding(
          "error",
          file,
          lineNo,
          "typescript-suppression",
          "avoid @ts-ignore/@ts-nocheck; use typed narrowing or document a narrow exception",
        )
      }

      if (/\/\/\s*@ts-expect-error\b/.test(line) && !hasReason(line)) {
        addFinding(
          "error",
          file,
          lineNo,
          "typescript-suppression",
          "@ts-expect-error requires an inline reason or issue reference",
        )
      }

      if (/\bas\s+unknown\s+as\b/.test(line)) {
        addFinding(
          "error",
          file,
          lineNo,
          "unsafe-cast",
          "avoid double assertions; add a parser, mapper, or narrow adapter seam",
        )
      }

      if (/\bas\s+any\b/.test(line)) {
        addFinding(
          "warn",
          file,
          lineNo,
          "unsafe-cast",
          "avoid broad any assertions; prefer typed helpers or a documented adapter seam",
        )
      }

      if (/eslint-disable|biome-ignore-all|biome-ignore lint\/.+$/.test(line) && !hasReason(line)) {
        addFinding(
          "warn",
          file,
          lineNo,
          "lint-disable",
          "lint suppressions need a reason, owner, or issue reference",
        )
      }

      if (/\b(?:TODO|FIXME)\b/.test(line) && !hasReason(line)) {
        addFinding(
          "warn",
          file,
          lineNo,
          "todo-owner",
          "TODO/FIXME comments need owner, issue, or context",
        )
      }

      if (/\bsql\s*`[^`]*\$\{/.test(line)) {
        addFinding(
          "warn",
          file,
          lineNo,
          "raw-sql",
          "dynamic SQL template interpolation needs review; prefer Drizzle builders or parameters",
        )
      }

      if (/\b(?:password|secret|token|apiKey|api_key)\b\s*[:=]\s*["'][^"']{8,}["']/i.test(line)) {
        addFinding("error", file, lineNo, "hardcoded-secret", "possible hardcoded secret or token")
      }

      if (/Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/.test(line)) {
        addFinding("warn", file, lineNo, "cors", "wildcard CORS needs explicit approval")
      }
    }
  }
}

function changedPackageNames(files) {
  const packages = new Set()
  for (const file of files) {
    const parts = file.split("/")
    if (parts[0] === "packages" && parts[1] && parts[2]) {
      packages.add(parts[1])
    }
  }
  return packages
}

function hasChangedChangeset(files) {
  return files.some((file) => file.startsWith(".changeset/") && file.endsWith(".md"))
}

function scanChangeLevelRules(files) {
  if (!changedOnly) return

  const packages = changedPackageNames(files)
  if (packages.size > 0 && !hasChangedChangeset(files)) {
    addFinding(
      "warn",
      "package changes",
      1,
      "changeset",
      `changed packages (${[...packages].sort().join(", ")}) without a changeset; document why if not public-facing`,
    )
  }

  const schemaFiles = files.filter(
    (file) =>
      /\/schema(?:-[^/]*)?\.ts$/.test(file) ||
      /\/schema\/.+\.ts$/.test(file) ||
      file.endsWith("drizzle.config.ts"),
  )
  const migrationFiles = files.filter(
    (file) => file.includes("/migrations/") || file.includes("/drizzle/"),
  )
  if (schemaFiles.length > 0 && migrationFiles.length === 0) {
    addFinding(
      "warn",
      "schema changes",
      1,
      "migration",
      `schema/config files changed without migration files: ${schemaFiles.join(", ")}`,
    )
  }
}

const files = collectFiles()
for (const file of files) scanFile(file)
scanChangeLevelRules(files)

const errors = findings.filter((finding) => finding.severity === "error")
const warnings = findings.filter((finding) => finding.severity === "warn")

if (findings.length === 0) {
  console.log(`agent-quality: OK (${changedOnly ? "changed files" : "tracked files"}; no findings)`)
  process.exit(0)
}

console.error(
  `agent-quality: ${errors.length} error(s), ${warnings.length} warning(s) ` +
    `(${changedOnly ? "changed files" : "tracked files"})`,
)
for (const finding of findings) {
  const location =
    finding.file === "package changes" || finding.file === "schema changes"
      ? finding.file
      : `${finding.file}:${finding.line}`
  console.error(`- [${finding.severity}] ${location} ${finding.rule}: ${finding.message}`)
}

if (reportOnly) {
  console.error("agent-quality: report-only mode; not failing")
  process.exit(0)
}

process.exit(errors.length > 0 ? 1 : 0)
