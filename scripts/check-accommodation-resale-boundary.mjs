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
    file: "templates/dmc/package.json",
    patterns: [/"@voyantjs\/hospitality"/],
  },
  {
    file: "templates/dmc/src/api/mcp.ts",
    patterns: [/@voyantjs\/hospitality/, /\bvertical === "hospitality"\b/],
  },
  {
    file: "templates/operator/package.json",
    patterns: [/"@voyantjs\/hospitality"/],
  },
  {
    file: "templates/operator/src/api/catalog-content.ts",
    patterns: [/@voyantjs\/hospitality/, /\/v1\/(?:admin|public)\/hospitality/],
  },
  {
    file: "templates/operator/src/api/lib/booking-engine-runtime.ts",
    patterns: [/@voyantjs\/hospitality/, /\bhospitalityBookingsService\b/],
  },
  {
    file: "templates/operator/src/api/lib/catalog-runtime.ts",
    patterns: [/@voyantjs\/hospitality/, /\bhospitalityCatalogPolicy\b/, /"hospitality"/],
  },
  {
    file: "templates/operator/src/api/booking-schedule.ts",
    patterns: [/@voyantjs\/hospitality/, /\bresolveHospitalityListingPolicy\b/, /"hospitality"/],
  },
  {
    file: "templates/operator/src/api/app.ts",
    patterns: [/\/v1\/public\/hospitality/],
  },
  {
    file: "templates/operator/src/routes/(storefront)/shop.tsx",
    patterns: [/"hospitality"/],
  },
  {
    file: "templates/operator/src/routes/(storefront)/shop_.book.$entityModule.$entityId.tsx",
    patterns: [/@voyantjs\/hospitality/, /"hospitality"/, /\bHospitalityContent\b/],
  },
  {
    file: "templates/operator/src/routes/(storefront)/shop_.products.$entityModule.$entityId.tsx",
    patterns: [/@voyantjs\/hospitality/, /"hospitality"/, /\bHospitalityContent\b/],
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
    file: "apps/dev/drizzle.config.ts",
    patterns: [/packages\/hospitality/],
  },
  {
    file: "templates/dmc/drizzle.config.ts",
    patterns: [/packages\/hospitality/],
  },
  {
    file: "templates/operator/drizzle.config.ts",
    patterns: [/packages\/hospitality/],
  },
  {
    file: "scripts/generate-schema-docs.ts",
    patterns: [/\bhospitality\b/i, /packages\/hospitality/],
  },
  {
    file: "docs/architecture/schema-discipline.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "SCHEMA.md",
    patterns: [/\bhospitality\b/i, /^## Hospitality$/],
  },
  {
    file: "apps/dev/src/components/voyant/facilities/property-tab.tsx",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/products/src/draft-shape.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/products/src/booking-engine/handler.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/products/src/service-catalog-plane.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/extras/src/service-content.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/extras/src/schema-sourced-content.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/charters/src/service-content.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/charters/src/schema-sourced-content.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/charters/src/service-catalog-plane.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/bookings/src/schema/travel-details.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/legal/src/contracts/template-authoring.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/payments-architecture.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/cruises-module.md",
    patterns: [/\bhospitality\b/i],
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
  {
    file: "packages/catalog-ui/src/components/catalog-page.tsx",
    patterns: [/\bhospitality\b/i, /\bmakeHospitality/],
  },
  {
    file: "packages/catalog-ui/src/components/catalog-search-page.tsx",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog-ui/src/i18n/messages.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog-ui/src/i18n/en.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog-ui/src/i18n/ro.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/bookings-ui/src/journey/types.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/types/src/api-keys.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog-mcp/src/tools/get-entity.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog-mcp/src/tools/tools.test.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/README.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/adapter/contract.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/booking-engine/contracts.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/booking-engine/draft-shape.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/booking-engine/orders.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/booking-engine/owned-handler.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/src/booking-engine/owned-handler.test.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/catalog/tests/integration/snapshot-service.test.ts",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/catalog-booking-engine.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/catalog-architecture.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/catalog-sourced-content.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/booking-journey-architecture.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/service-api-keys.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "docs/architecture/ai-travel-experience-composition.md",
    patterns: [/\bhospitality\b/i],
  },
  {
    file: "packages/hospitality/README.md",
    patterns: [/pnpm add @voyantjs\/hospitality/, /\bhospitalityModule\b/],
  },
  {
    file: "packages/hospitality-ui/README.md",
    patterns: [/pnpm add @voyantjs\/hospitality-ui/, /npx shadcn add @voyant\/.*hospitality/],
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
