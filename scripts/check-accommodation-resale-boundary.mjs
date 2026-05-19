/**
 * Enforces issue #977's accommodation resale boundary.
 *
 * Accommodation remains valid catalog/resale inventory. This check blocks the
 * first-party hotel-operations surfaces from returning in starters, dev UI, and
 * the public UI registry.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const FORBIDDEN_PATHS = [
  "apps/dev/src/components/voyant/hospitality",
  "apps/dev/src/routes/_workspace/hospitality",
  "packages/ui/registry/hospitality",
]

const FILE_CHECKS = [
  {
    file: "apps/dev/src/api/app.ts",
    patterns: [/\bhospitalityHonoModule\b/, /@voyantjs\/hospitality/],
  },
  {
    file: "apps/dev/src/api/api-types.ts",
    patterns: [/\bHospitalityRoutes\b/, /"\/v1\/hospitality"/, /@voyantjs\/hospitality/],
  },
  {
    file: "templates/dmc/src/api/app.ts",
    patterns: [/\bhospitalityHonoModule\b/, /@voyantjs\/hospitality/],
  },
  {
    file: "templates/dmc/src/api/api-types.ts",
    patterns: [/\bHospitalityRoutes\b/, /"\/v1\/hospitality"/, /@voyantjs\/hospitality/],
  },
  {
    file: "templates/dmc/voyant.config.ts",
    patterns: [/"@voyantjs\/hospitality"/],
  },
  {
    file: "apps/dev/package.json",
    patterns: [
      /"@voyantjs\/hospitality"/,
      /"@voyantjs\/hospitality-react"/,
      /"@voyantjs\/hospitality-ui"/,
    ],
  },
  {
    file: "apps/dev/src/styles.css",
    patterns: [/@voyantjs\/hospitality-ui/],
  },
  {
    file: "packages/ui/registry.json",
    patterns: [/voyant-hospitality-/, /registry\/hospitality/, /@voyantjs\/hospitality-react/],
  },
  {
    file: "packages/ui/public/r/registry.json",
    patterns: [/voyant-hospitality-/, /registry\/hospitality/, /@voyantjs\/hospitality-react/],
  },
  {
    file: "apps/registry/public/r/registry.json",
    patterns: [/voyant-hospitality-/],
  },
]

const GENERATED_REGISTRY_DIRS = ["packages/ui/public/r", "apps/registry/public/r"]

const violations = []

for (const path of FORBIDDEN_PATHS) {
  if (existsSync(join(ROOT, path))) {
    violations.push({ file: path, line: null, text: "forbidden path exists" })
  }
}

for (const { file, patterns } of FILE_CHECKS) {
  const full = join(ROOT, file)
  if (!existsSync(full)) continue
  const lines = readFileSync(full, "utf-8").split("\n")
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ""
    if (patterns.some((pattern) => pattern.test(text))) {
      violations.push({ file, line: i + 1, text: text.trim() })
    }
  }
}

for (const dir of GENERATED_REGISTRY_DIRS) {
  const full = join(ROOT, dir)
  if (!existsSync(full)) continue
  for (const entry of readdirSync(full)) {
    const file = join(full, entry)
    if (statSync(file).isFile() && entry.startsWith("voyant-hospitality-")) {
      violations.push({ file: relative(ROOT, file), line: null, text: "forbidden registry item" })
    }
  }
}

if (violations.length > 0) {
  console.error("Accommodation resale boundary violation: hotel-operations surface found.")
  console.error("See docs/architecture/accommodation-resale-boundary.md for context.\n")
  for (const violation of violations) {
    const location = violation.line ? `${violation.file}:${violation.line}` : violation.file
    console.error(`  ${location}`)
    console.error(`    ${violation.text}`)
  }
  console.error(
    "\nAccommodation resale belongs in catalog/booking/storefront flows; do not reintroduce first-party hotel management surfaces.",
  )
  process.exit(1)
}

console.log("check-accommodation-resale-boundary: OK")
