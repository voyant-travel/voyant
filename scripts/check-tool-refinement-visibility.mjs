/**
 * Keep Tool constraints visible to the model that has to satisfy them.
 *
 * `z.toJSONSchema` DROPS refinements (`.refine` / `.superRefine` / `.check`),
 * and JSON Schema is exactly what an MCP client shows the model when it picks
 * tool arguments. A rule expressed only as a refinement is therefore invisible
 * at call time and only appears afterwards as a `-32602` parse failure — which
 * reads to an agent as "that call was unlucky", not "those arguments were
 * wrong". The observed failure mode is a retry loop with cosmetic changes until
 * the loop guard fires.
 *
 * Two shipped instances motivated this check:
 *
 * - `create_booking` required a billing party via `superRefine`. A customer's
 *   agent omitted `personId` three times and got loop-guard blocked (#3814).
 * - `create_option_unit` required `occupancyMin` for room and vehicle units the
 *   same way; omitting it silently under-charges the booking (#3822).
 *
 * The fix in both cases was to restate the rule in a `.describe()` that DOES
 * serialize. This check keeps that from regressing: a refinement is allowed as
 * long as the text a model can actually read mentions the constraint.
 *
 * Requires built packages — run after `turbo build`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"

const PACKAGES_DIR = "packages"

/**
 * Tools whose refinements are not yet restated in visible text. This is a
 * ratchet, not an allowlist to grow: entries come off as each is documented,
 * and a NEW undocumented refinement fails the build.
 */
const KNOWN_UNDOCUMENTED = new Set([
  // Blocked on a prior problem: these tools' input schemas are not
  // JSON-Schema-serializable at all (a `z.coerce.date()` or a transform makes
  // `z.toJSONSchema` throw), so the registry substitutes a description-only
  // stub and the model sees NO parameters. Documenting a refinement on them
  // would change nothing until the schema itself can serialize.
  "commerce:create_promotion:(root)",
  "finance:issue_invoice_from_booking:command",
  "mice:create_mice_program:(root)",
  "navigation-preferences:set_my_navigation_preferences:visibility",
  "notifications:get_notification_template:(root)",
  "storefront:bootstrap_my_customer_portal:(root)",
  "storefront:bootstrap_my_customer_portal:customerRecord.billingAddress",
])

/**
 * Vocabulary a conditional constraint needs. Deliberately generous — the goal
 * is to catch a rule stated NOWHERE, not to grade prose.
 */
const CONSTRAINT_WORDING =
  /\brequired\b|\brequires\b|\bmust\b|\bunless\b|\beither\b|\bat least one\b|\bonly if\b|\bcannot\b|\bwhen\b|\bexactly one\b|\bnot set\b/i

function isZodSchema(value) {
  return Boolean(value && typeof value === "object" && value._zod?.def)
}

function hasCustomCheck(schema) {
  return (schema._zod.def.checks ?? []).some((check) => check?._zod?.def?.check === "custom")
}

/** Every node in a Zod tree that carries a refinement, by field path. */
function findRefinements(schema, trail = [], seen = new Set(), out = []) {
  if (!isZodSchema(schema) || seen.has(schema)) return out
  seen.add(schema)
  const def = schema._zod.def

  if (hasCustomCheck(schema)) out.push(trail.join(".") || "(root)")

  if (def.shape) {
    for (const [key, child] of Object.entries(def.shape)) {
      findRefinements(child, [...trail, key], seen, out)
    }
  }
  for (const key of ["innerType", "element", "valueType", "in", "out"]) {
    if (def[key]) findRefinements(def[key], trail, seen, out)
  }
  if (Array.isArray(def.options)) {
    for (const option of def.options) findRefinements(option, trail, seen, out)
  }
  return out
}

/**
 * Text the model can read for a refinement at `fieldPath`.
 *
 * A refinement on an OBJECT is nearly always a rule about that object's fields
 * ("personId is required unless organizationId is set"), and the natural place
 * to document it is on those fields — so children count as visible text, not
 * just the node itself.
 */
function visibleText(jsonSchema, toolDescription, fieldPath) {
  let node = jsonSchema
  if (fieldPath !== "(root)") {
    for (const segment of fieldPath.split(".")) node = node?.properties?.[segment]
  }
  const chunks = [toolDescription ?? "", node?.description ?? ""]
  for (const property of Object.values(node?.properties ?? {})) {
    if (property?.description) chunks.push(property.description)
  }
  return chunks.join(" ")
}

function toolsEntryFor(packageName) {
  const manifestPath = path.join(PACKAGES_DIR, packageName, "package.json")
  if (!existsSync(manifestPath)) return null
  const entry = JSON.parse(readFileSync(manifestPath, "utf8")).exports?.["./tools"]
  if (!entry) return null
  const relative = typeof entry === "string" ? entry : (entry.import ?? entry.default)
  if (!relative) return null
  const resolved = path.join(PACKAGES_DIR, packageName, relative)
  return existsSync(resolved) ? resolved : null
}

const undocumented = []
const documented = []
const unbuilt = []

for (const packageName of readdirSync(PACKAGES_DIR)) {
  const entry = toolsEntryFor(packageName)
  if (!entry) {
    // Distinguish "no Tools" from "not built" — silently skipping an unbuilt
    // package would make this check pass by finding nothing.
    const manifestPath = path.join(PACKAGES_DIR, packageName, "package.json")
    if (existsSync(manifestPath)) {
      const exportsField = JSON.parse(readFileSync(manifestPath, "utf8")).exports?.["./tools"]
      if (exportsField) unbuilt.push(packageName)
    }
    continue
  }

  let module
  try {
    module = await import(pathToFileURL(path.resolve(entry)).href)
  } catch (error) {
    unbuilt.push(`${packageName} (${String(error).split("\n")[0]})`)
    continue
  }

  for (const value of Object.values(module)) {
    if (!value || typeof value !== "object") continue
    if (typeof value.name !== "string" || !isZodSchema(value.inputSchema)) continue

    const refinements = findRefinements(value.inputSchema)
    if (refinements.length === 0) continue

    let jsonSchema = null
    try {
      jsonSchema = z.toJSONSchema(value.inputSchema, { io: "input" })
    } catch {
      /* unrepresentable; treat as no visible text */
    }

    for (const fieldPath of refinements) {
      const key = `${packageName}:${value.name}:${fieldPath}`
      const text = visibleText(jsonSchema, value.description, fieldPath)
      if (CONSTRAINT_WORDING.test(text)) documented.push(key)
      else undocumented.push(key)
    }
  }
}

if (unbuilt.length > 0) {
  console.error("Tool refinement visibility check could not read every package:\n")
  for (const name of unbuilt) console.error(`- ${name}`)
  console.error("\nRun `turbo build` first — an unread package would pass by finding nothing.")
  process.exit(1)
}

const regressions = undocumented.filter((key) => !KNOWN_UNDOCUMENTED.has(key))
const fixed = [...KNOWN_UNDOCUMENTED].filter(
  (key) => !undocumented.includes(key) && documented.includes(key),
)

if (regressions.length > 0) {
  console.error("Tool input schemas hide a constraint from the model:\n")
  for (const key of regressions.sort()) {
    const [pkg, tool, field] = key.split(":")
    console.error(`- ${tool} (${pkg}) at \`${field}\``)
  }
  console.error(
    "\nZod refinements are dropped by `z.toJSONSchema`, so the model never sees this rule when\n" +
      "choosing arguments — it only hits it as a -32602 afterwards and tends to retry unchanged.\n" +
      "Restate the constraint in a `.describe()` on the field it governs (see #3814, #3822).",
  )
  process.exit(1)
}

if (fixed.length > 0) {
  console.error("These Tools are now documented — remove them from KNOWN_UNDOCUMENTED:\n")
  for (const key of fixed.sort()) console.error(`- ${key}`)
  process.exit(1)
}

console.log(
  `Tool refinement visibility: OK (${documented.length} documented, ` +
    `${undocumented.length} known-undocumented awaiting copy)`,
)
