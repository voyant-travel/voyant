import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), "utf8")
const failures = []
const registry = read("packages/custom-fields/src/registry.ts")
const definitionService = read("packages/custom-fields/src/service.ts")
const valueService = read("packages/relationships/src/service/custom-fields.ts")
const valueMapping = read("packages/relationships/src/service/custom-fields-value-mapping.ts")
const peopleService = read("packages/relationships/src/service/accounts-people.ts")
const organizationService = read("packages/relationships/src/service/accounts-organizations.ts")
const bookingService = read("packages/bookings/src/service-core.ts")
const bookingRoutes = read("packages/bookings/src/routes-admin.ts")
const relationshipRoutes = read("packages/relationships/src/routes/accounts.ts")
const reader = read("packages/relationships/src/runtime-contributor.ts")
const bookingLifecycle = read("packages/bookings/src/runtime-contributor.ts")
const quoteLifecycle = read("packages/quotes/src/runtime-contributor.ts")
const relationshipLifecycle = read("packages/relationships/src/runtime-contributor.ts")
const migrations = [
  ["packages/bookings/migrations/20260716000300_namespace_custom_field_values.sql", ["bookings"]],
  ["packages/quotes/migrations/20260716000301_namespace_custom_field_values.sql", ["quotes"]],
  [
    "packages/relationships/migrations/20260716000302_namespace_custom_field_values.sql",
    ["people", "organizations", "activities"],
  ],
]

if (!registry.includes("namespace: row.namespace"))
  failures.push("the runtime registry must retain persisted definition namespaces")
if (registry.includes('row.namespace !== "custom"'))
  failures.push("the runtime registry must not exclude non-operator namespaces")
if (!valueService.includes("ownerWhere(owner)"))
  failures.push("value APIs must resolve definitions through trusted owner context")
if (
  !valueService.includes(`COALESCE(custom_fields -> \${definition.namespace}, '{}'::jsonb)`) ||
  !valueService.includes(`\${definition.key}::text`)
)
  failures.push("value upserts must merge into the trusted definition namespace")
if (
  valueService.includes(
    `jsonb_set(custom_fields, ARRAY[\${definition.namespace}, \${definition.key}]`,
  )
)
  failures.push("two-level jsonb_set cannot create a missing namespace")
if (
  !valueService.includes(
    `custom_fields #- ARRAY[\${definition.namespace}, \${definition.key}]::text[]`,
  )
)
  failures.push("value deletes must remove only a definition-owned namespace/key path")
if (valueService.includes("custom_fields = custom_fields ||"))
  failures.push("value writes must not use the legacy flat JSONB merge")
if (!valueMapping.includes(`::\${namespace}::`))
  failures.push("synthetic value ids must include namespace identity")
if (!peopleService.includes(`-> \${field.namespace} ->> \${field.key}`))
  failures.push("custom-field search must address namespace and key")
if (!reader.includes("values[definition.namespace]?.[definition.key]"))
  failures.push("runtime readers must address namespace and key")
if (
  !bookingRoutes.includes('definition.namespace === "custom"') ||
  !relationshipRoutes.includes('definition.namespace === "custom"')
)
  failures.push("ordinary entity routes must accept only operator-owned values")
if (
  !bookingService.includes("...existing.custom_fields") ||
  !peopleService.includes("jsonb_set(") ||
  !organizationService.includes("jsonb_set(")
)
  failures.push("ordinary updates must preserve app/platform namespaces atomically")
if (
  !definitionService.includes("valueLifecycle.renameDefinitionKey") ||
  !definitionService.includes("valueLifecycle.deleteDefinitionValues")
)
  failures.push("definition rename/delete must delegate to package-owned value lifecycle providers")
if (!definitionService.includes("return db.transaction(async (tx) =>"))
  failures.push("definition mutation and value lifecycle cleanup must share a transaction")
if (!valueService.includes('.for("update")'))
  failures.push("value writes must coordinate with definition rename/delete locks")
for (const [source, targets] of [
  [bookingLifecycle, ["booking"]],
  [quoteLifecycle, ["quote"]],
  [relationshipLifecycle, ["person", "organization", "activity"]],
]) {
  for (const target of targets) {
    if (!source.includes(`entityType === "${target}"`) && !source.includes(`${target}: "`))
      failures.push(`target ${target} must have a package-owned value lifecycle provider`)
  }
}
if (
  existsSync(
    resolve(
      root,
      "packages/custom-fields/migrations/20260716000200_namespace_custom_field_values.sql",
    ),
  )
)
  failures.push("the generic definitions package must not migrate entity-owned tables")
for (const [path, tables] of migrations) {
  const migration = read(path)
  if (!migration.includes("jsonb_build_object('custom', \"custom_fields\")"))
    failures.push(`${path} must wrap flat values under custom`)
  if (!migration.includes("NOT (\"custom_fields\" ? 'custom')"))
    failures.push(`${path} must not double-wrap values during replay audits`)
  for (const table of tables) {
    if (!migration.includes(`UPDATE "${table}"`)) failures.push(`${path} must migrate ${table}`)
  }
}

if (failures.length)
  throw new Error(`check-custom-fields-namespaced-values:\n- ${failures.join("\n- ")}`)
console.log("check-custom-fields-namespaced-values: OK")
