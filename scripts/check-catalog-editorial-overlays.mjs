import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), "utf8")

const failures = []

const overlaySchema = read("packages/catalog/src/overlay/schema.ts")
for (const required of ["node_kind", "node_key", "version", "catalogOverlayHistoryTable"]) {
  if (!overlaySchema.includes(required)) {
    failures.push(`catalog overlay schema must include ${required}`)
  }
}

const productContent = read("packages/products-contracts/src/content-shape.ts")
if (!/productDaySchema[\s\S]*id: z\.string\(\)\.optional\(\)/.test(productContent)) {
  failures.push("product day content must expose a stable optional id for node overlays")
}

// The overlayable field policy lives in one module so the write path and the
// admin read model cannot drift apart.
const productOverlayFields = read("packages/inventory/src/editorial-overlay-fields.ts")
const rootFieldsMatch = productOverlayFields.match(
  /export const ROOT_FIELD_KINDS[\s\S]*?new Map\(\[([\s\S]*?)\]\)/,
)
if (!rootFieldsMatch) {
  failures.push("product editorial overlay service must declare an explicit ROOT_FIELDS allowlist")
} else {
  const rootFields = rootFieldsMatch[1]
  for (const forbidden of [
    "price",
    "availability",
    "source",
    "source_ref",
    "id",
    "booking",
    "currency",
    "departure",
  ]) {
    if (new RegExp(forbidden, "i").test(rootFields)) {
      failures.push(`product editorial overlay ROOT_FIELDS must not include ${forbidden}`)
    }
  }
}

const dayFieldsMatch = productOverlayFields.match(
  /export const DAY_FIELD_KINDS[\s\S]*?new Map\(\[([\s\S]*?)\]\)/,
)
if (!dayFieldsMatch || !/\["title",[\s\S]*\["description",/.test(dayFieldsMatch[1])) {
  failures.push("product itinerary-day overlays must use a narrow presentation-only allowlist")
}

if (failures.length > 0) {
  console.error(`check-catalog-editorial-overlays:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}

console.log("check-catalog-editorial-overlays: OK")
