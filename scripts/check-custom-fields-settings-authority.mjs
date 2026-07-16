import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), "utf8")
const failures = []
const genericManifest = read("packages/custom-fields/src/voyant.ts")
const relationshipsManifest = read("packages/relationships/src/voyant.ts")
const relationshipsAdmin = read("packages/relationships-react/src/admin/index.tsx")
const settingsReactPackage = read("packages/custom-fields-react/package.json")
const settingsReactI18n = read("packages/custom-fields-react/src/i18n/index.ts")
const settingsReactAdmin = read("packages/custom-fields-react/src/admin.tsx")
const settingsQueryOptions = read("packages/custom-fields-react/src/query-options.ts")
const settingsSheet = read(
  "packages/custom-fields-react/src/components/custom-field-definition-sheet.tsx",
)
const settingsPage = read(
  "packages/custom-fields-react/src/components/custom-field-definitions-page.tsx",
)
const definitionService = read("packages/custom-fields/src/service.ts")
const relationshipsValueService = read("packages/relationships/src/service/custom-fields.ts")
const namespaceOwnershipMigration = read(
  "packages/custom-fields/migrations/20260716000100_custom_field_namespace_ownership.sql",
)
const relationshipsRoutes = read("packages/relationships/src/routes/custom-fields.ts")
const relationshipsPackage = read("packages/relationships/package.json")

if (!genericManifest.includes('mount: "custom-fields"'))
  failures.push("generic custom-fields package must own the canonical API mount")
if (!genericManifest.includes('resource: "custom-fields"'))
  failures.push("generic custom-fields package must own a unique custom-fields access resource")
if (genericManifest.includes('resource: "settings"'))
  failures.push("generic custom-fields package must not duplicate the settings access resource")
if (!genericManifest.includes('requiredScopes: ["custom-fields:read"]'))
  failures.push("custom-fields Settings route must require the custom-fields read scope")
if (!genericManifest.includes('path: "/settings/custom-fields"'))
  failures.push("generic custom-fields package must own the Settings route")
if (!genericManifest.includes("@voyant-travel/custom-fields-react/admin"))
  failures.push("generic custom-fields manifest must select custom-fields-react")
if (!settingsReactPackage.includes('"name": "@voyant-travel/custom-fields-react"'))
  failures.push("custom-fields-react package must exist")
if (!settingsReactPackage.includes('"@voyant-travel/i18n": "workspace:^"'))
  failures.push("custom-fields-react must own its package i18n dependency")
if (!settingsReactPackage.includes('"./i18n": "./src/i18n/index.ts"'))
  failures.push("custom-fields-react must expose its package i18n API")
if (!settingsReactI18n.includes("CustomFieldsUiMessagesProvider"))
  failures.push("custom-fields-react must own English and Romanian route/page messages")
if (!settingsReactAdmin.includes("routeMessagesProvider: customFieldsRouteMessagesProvider"))
  failures.push("custom-fields-react Settings must load its route-local message provider")
if (settingsReactPackage.includes("@voyant-travel/relationships-react"))
  failures.push("custom-fields-react must not depend on relationships-react")
if (!settingsQueryOptions.includes("/v1/admin/custom-fields/targets"))
  failures.push("custom-fields Settings must load selected targets from the generic API")
if (!settingsSheet.includes("target.id === values.entityType"))
  failures.push("custom-fields Settings must constrain field types to the selected target")
if (!settingsSheet.includes("normalizeCustomFieldDefinitionFormValues"))
  failures.push("custom-fields Settings must clear unsupported target capabilities")
if (
  !settingsPage.includes('definition.ownerKind === "operator" && definition.namespace === "custom"')
)
  failures.push(
    "custom-fields Settings must expose app/platform definitions as structurally read-only",
  )
if (!settingsPage.includes("messages.page.namespace"))
  failures.push("custom-fields Settings must display physical namespace provenance")
if (!definitionService.includes('namespace: "custom"'))
  failures.push("operator-created definitions must use the server-assigned custom namespace")
if (!definitionService.includes("createForOwner") || !definitionService.includes("updateForOwner"))
  failures.push("app/platform definition operations must be owner-constrained domain operations")
if (
  !relationshipsValueService.includes('eq(customFieldDefinitions.namespace, "custom")') ||
  !relationshipsValueService.includes('eq(customFieldDefinitions.lifecycleState, "active")')
)
  failures.push(
    "pre-namespaced Relationships value paths must reject non-operator or inactive definitions",
  )
if (!namespaceOwnershipMigration.includes('DELETE FROM "custom_field_definitions"'))
  failures.push(
    "namespace ownership migration must explicitly discard unused pre-cutline definitions",
  )
if (
  namespaceOwnershipMigration.includes("ADD COLUMN IF NOT EXISTS") ||
  namespaceOwnershipMigration.includes("CREATE INDEX IF NOT EXISTS") ||
  /\bUPDATE\s+"custom_field_definitions"/.test(namespaceOwnershipMigration) ||
  /\bDEFAULT\b/.test(namespaceOwnershipMigration)
)
  failures.push("namespace ownership migration must not contain compatibility defaults or backfill")
if (relationshipsManifest.includes('path: "/settings/custom-fields"'))
  failures.push("Relationships must not own the custom-fields Settings route")
if (relationshipsAdmin.includes('id: "custom-fields"'))
  failures.push("Relationships admin must not expose custom-fields Settings")
if (relationshipsRoutes.includes('path: "/custom-fields"'))
  failures.push("Relationships must not expose definition CRUD")
if (relationshipsRoutes.includes("createCustomFieldsService"))
  failures.push("Relationships must not own definition services")
if (relationshipsPackage.includes("./custom-fields-registry"))
  failures.push("Relationships must not export a definition registry")
if (existsSync(resolve(root, "packages/relationships/src/service/custom-fields-registry.ts")))
  failures.push("Relationships definition registry adapter must stay deleted")
if (!read("packages/bookings/src/voyant.ts").includes('namespace: "bookings"'))
  failures.push("Bookings must declare a stable custom-field namespace")
if (!read("packages/relationships/src/voyant.ts").includes('namespace: "relationships"'))
  failures.push("Relationships must declare a stable custom-field namespace")
if (!read("packages/quotes/src/voyant.ts").includes('namespace: "quotes"'))
  failures.push("Quotes must declare a stable custom-field namespace")
if (!read("packages/bookings/src/voyant.ts").includes("customFieldTargets"))
  failures.push("Bookings must declare its custom-field target")
if (!read("packages/relationships/src/voyant.ts").includes("customFieldTargets"))
  failures.push("Relationships must declare its custom-field targets")
if (!read("packages/quotes/src/voyant.ts").includes("customFieldTargets"))
  failures.push("Quotes must declare its custom-field target")

if (failures.length)
  throw new Error(`check-custom-fields-settings-authority:\n- ${failures.join("\n- ")}`)
console.log("check-custom-fields-settings-authority: OK")
