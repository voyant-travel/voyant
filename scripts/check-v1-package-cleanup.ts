import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { getTableName, isTable } from "drizzle-orm/table"

type TemporaryPackageKind = "facade" | "orphan"

interface TemporaryPackage {
  name: string
  kind: TemporaryPackageKind
  owner: string
  ownerDependencies: string[]
}

const repoRoot = process.cwd()
const failOnTemporary = process.argv.includes("--fail-on-temporary")

const skipDirs = new Set([".git", ".turbo", ".wrangler", "coverage", "dist", "node_modules"])

const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"])

const removedRuntimePackages = [
  "@voyantjs/checkout",
  "@voyantjs/checkout-react",
  "@voyantjs/crm",
  "@voyantjs/crm-react",
  "@voyantjs/transactions",
  "@voyantjs/transactions-react",
  "@voyantjs/travel-composer",
  "@voyantjs/travel-composer-react",
]

function packageList(value: string): TemporaryPackage[] {
  return value
    .trim()
    .split("\n")
    .map((line) => {
      const [name, kind, owner, ownerDependencies] = line.trim().split("|")
      if (!name || (kind !== "facade" && kind !== "orphan") || !owner || !ownerDependencies) {
        throw new Error(`Invalid temporary package row: ${line}`)
      }
      return {
        name,
        kind,
        owner,
        ownerDependencies: ownerDependencies.split(","),
      }
    })
}

const temporaryPackages = packageList(`
  @voyantjs/allocation-ui|orphan|@voyantjs/operations-react/availability/allocation|@voyantjs/operations-react
  @voyantjs/availability|facade|@voyantjs/operations/availability|@voyantjs/operations
  @voyantjs/availability-react|facade|@voyantjs/operations-react/availability|@voyantjs/operations-react
  @voyantjs/booking-requirements|orphan|@voyantjs/bookings/requirements|@voyantjs/bookings
  @voyantjs/booking-requirements-react|orphan|@voyantjs/bookings-react/requirements|@voyantjs/bookings-react
  @voyantjs/customer-portal|orphan|@voyantjs/storefront/customer-portal|@voyantjs/storefront
  @voyantjs/customer-portal-react|orphan|@voyantjs/storefront-react/customer-portal|@voyantjs/storefront-react
  @voyantjs/external-refs|facade|@voyantjs/distribution/external-refs|@voyantjs/distribution
  @voyantjs/external-refs-react|facade|@voyantjs/distribution-react/external-refs|@voyantjs/distribution-react
  @voyantjs/extras|orphan|@voyantjs/inventory/extras + @voyantjs/bookings/extras|@voyantjs/inventory,@voyantjs/bookings
  @voyantjs/extras-react|orphan|@voyantjs/inventory-react/extras + @voyantjs/bookings-react/extras|@voyantjs/inventory-react,@voyantjs/bookings-react
  @voyantjs/facilities|orphan|@voyantjs/operations/places|@voyantjs/operations
  @voyantjs/facilities-react|orphan|@voyantjs/operations-react/places|@voyantjs/operations-react
  @voyantjs/ground|orphan|@voyantjs/operations/ground|@voyantjs/operations
  @voyantjs/ground-react|orphan|@voyantjs/operations-react/ground|@voyantjs/operations-react
  @voyantjs/markets|facade|@voyantjs/commerce/markets|@voyantjs/commerce
  @voyantjs/markets-react|facade|@voyantjs/commerce-react/markets|@voyantjs/commerce-react
  @voyantjs/places|orphan|@voyantjs/operations/places|@voyantjs/operations
  @voyantjs/places-react|orphan|@voyantjs/operations-react/places|@voyantjs/operations-react
  @voyantjs/pricing|facade|@voyantjs/commerce/pricing|@voyantjs/commerce
  @voyantjs/pricing-react|facade|@voyantjs/commerce-react/pricing|@voyantjs/commerce-react
  @voyantjs/products|facade|@voyantjs/inventory|@voyantjs/inventory
  @voyantjs/products-react|facade|@voyantjs/inventory-react|@voyantjs/inventory-react
  @voyantjs/promotions|facade|@voyantjs/commerce/promotions|@voyantjs/commerce
  @voyantjs/promotions-react|facade|@voyantjs/commerce-react/promotions|@voyantjs/commerce-react
  @voyantjs/resources|facade|@voyantjs/operations/resources|@voyantjs/operations
  @voyantjs/resources-react|facade|@voyantjs/operations-react/resources|@voyantjs/operations-react
  @voyantjs/sellability|facade|@voyantjs/commerce/sellability|@voyantjs/commerce
  @voyantjs/sellability-react|facade|@voyantjs/commerce-react/sellability|@voyantjs/commerce-react
  @voyantjs/suppliers|facade|@voyantjs/distribution/suppliers|@voyantjs/distribution
  @voyantjs/suppliers-react|facade|@voyantjs/distribution-react/suppliers|@voyantjs/distribution-react
`)

function exportList(value: string) {
  return value.trim().split(/\s+/)
}

const temporaryOwnerExports = new Map<string, string[]>([
  [
    "@voyantjs/commerce",
    exportList(`
      ./markets ./markets/routes ./markets/schema ./markets/service-core
      ./markets/service-rules ./markets/service-shared ./markets/service
      ./markets/validation ./pricing/events ./pricing ./pricing/routes-core
      ./pricing/routes-public ./pricing/routes-rules ./pricing/routes-shared
      ./pricing/routes ./pricing/schema-catalogs ./pricing/schema-categories
      ./pricing/schema-departure-overrides ./pricing/schema-option-rules
      ./pricing/schema-policies ./pricing/schema-relations ./pricing/schema-shared
      ./pricing/schema ./pricing/service-catalog-plane-pricing ./pricing/service-catalogs
      ./pricing/service-categories ./pricing/service-departure-overrides
      ./pricing/service-option-rules ./pricing/service-policies ./pricing/service-public
      ./pricing/service-rule-resolver ./pricing/service-shared
      ./pricing/service-transfer-rules ./pricing/service ./pricing/validation-public
      ./pricing/validation-shared ./pricing/validation ./promotions/events ./promotions
      ./promotions/routes-shared ./promotions/routes ./promotions/schema
      ./promotions/service-booking-confirmed ./promotions/service-boundary-scheduler
      ./promotions/service-catalog-evaluator ./promotions/service-catalog-plane-promotions
      ./promotions/service-evaluator ./promotions/service-storefront ./promotions/service
      ./promotions/validation ./promotions/workflow-bulk-reindex
      ./promotions/workflow-runtime ./sellability ./sellability/routes ./sellability/schema
      ./sellability/service-records ./sellability/service-resolve ./sellability/service-shared
      ./sellability/service-snapshots ./sellability/service ./sellability/validation
      ./pricing/public-routes ./pricing/public-validation
    `),
  ],
  [
    "@voyantjs/operations",
    exportList(`
      ./availability ./availability/schema ./availability/validation ./availability/routes
      ./availability/rrule ./availability/service-holds
      ./availability/service-catalog-plane-departures ./resources ./resources/schema
      ./resources/validation ./resources/routes ./ground ./ground/schema ./ground/validation
      ./ground/routes ./places ./places/schema ./places/validation ./places/routes
    `),
  ],
  [
    "@voyantjs/distribution",
    exportList(`
      ./booking-extension ./channel-push ./suppliers ./suppliers/schema ./suppliers/validation
      ./suppliers/routes ./external-refs ./external-refs/schema ./external-refs/validation
      ./external-refs/routes
    `),
  ],
])

const temporaryOwnerExportPrefixes = new Map<string, string[]>([
  ["@voyantjs/commerce", ["./markets", "./pricing", "./promotions", "./sellability"]],
  ["@voyantjs/operations", ["./availability", "./resources", "./ground", "./places"]],
  [
    "@voyantjs/distribution",
    ["./booking-extension", "./channel-push", "./suppliers", "./external-refs"],
  ],
])

function findPackageJsonFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findPackageJsonFiles(fullPath))
      continue
    }

    if (entry.name === "package.json") files.push(fullPath)
  }

  return files
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>
}

function dependencyNames(pkg: Record<string, unknown>) {
  const names = new Set<string>()
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
    "devDependencies",
  ]) {
    const deps = pkg[field]
    if (!deps || typeof deps !== "object") continue
    for (const name of Object.keys(deps)) names.add(name)
  }
  return names
}

function walkSourceFiles(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files)
      continue
    }

    if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath)
  }

  return files
}

function packageImportPatterns(packageName: string) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const specifier = `["']${escaped}(?:/[^"']*)?["']`
  return [
    new RegExp(`\\bfrom\\s+${specifier}`),
    new RegExp(`\\bimport\\s+${specifier}`),
    new RegExp(`\\bimport\\s*\\(\\s*${specifier}\\s*\\)`),
    new RegExp(`\\brequire\\s*\\(\\s*${specifier}\\s*\\)`),
  ]
}

function findSourceImporters(packageName: string, ownPackageJsonPath: string | undefined) {
  const ownPackageDir = ownPackageJsonPath ? path.dirname(ownPackageJsonPath) : undefined
  const searchRoots = ["packages", "templates", "apps", "scripts"]
    .map((entry) => path.join(repoRoot, entry))
    .filter((entry) => fs.existsSync(entry))
  const patterns = packageImportPatterns(packageName)
  const importers: string[] = []

  for (const root of searchRoots) {
    for (const filePath of walkSourceFiles(root)) {
      if (
        ownPackageDir &&
        (filePath === ownPackageDir || filePath.startsWith(`${ownPackageDir}${path.sep}`))
      ) {
        continue
      }
      const source = fs.readFileSync(filePath, "utf8")
      if (patterns.some((pattern) => pattern.test(source)))
        importers.push(path.relative(repoRoot, filePath))
    }
  }

  return importers.sort()
}

function exportKeys(value: unknown) {
  if (!value || typeof value !== "object") return []
  return Object.keys(value as Record<string, unknown>).sort()
}

function isTemporaryOwnerExport(packageName: string, exportKey: string) {
  const prefixes = temporaryOwnerExportPrefixes.get(packageName) ?? []
  return prefixes.some((prefix) => exportKey === prefix || exportKey.startsWith(`${prefix}/`))
}

function collectTableNames(module: Record<string, unknown>) {
  return new Set(
    Object.values(module)
      .filter((value) => isTable(value))
      .map((value) => getTableName(value))
      .sort(),
  )
}

function diffSet(left: Set<string>, right: Set<string>) {
  return [...left].filter((entry) => !right.has(entry)).sort()
}

function formatList(entries: string[]) {
  return entries.length === 0 ? "(none)" : entries.join(", ")
}

async function importSchemaFile(relativePath: string) {
  const filePath = path.join(repoRoot, relativePath)
  if (!fs.existsSync(filePath)) return undefined
  return (await import(pathToFileURL(filePath).href)) as Record<string, unknown>
}

async function main() {
  const packageJsonFiles = findPackageJsonFiles(path.join(repoRoot, "packages"))
  const packagesByName = new Map<
    string,
    { packageJsonPath: string; pkg: Record<string, unknown> }
  >()

  for (const packageJsonPath of packageJsonFiles) {
    const pkg = readJson(packageJsonPath)
    if (typeof pkg.name === "string") {
      packagesByName.set(pkg.name, { packageJsonPath, pkg })
    }
  }

  const problems: string[] = []
  const presentTemporaryPackages: TemporaryPackage[] = []
  const presentTemporaryExports: Array<{ packageName: string; exportKey: string; source: string }> =
    []

  for (const packageName of removedRuntimePackages) {
    const existing = packagesByName.get(packageName)
    if (existing) {
      problems.push(
        `${path.relative(repoRoot, existing.packageJsonPath)}: ${packageName} is retired and must not re-enter the workspace`,
      )
    }
  }

  for (const temporaryPackage of temporaryPackages) {
    const existing = packagesByName.get(temporaryPackage.name)
    if (!existing) continue

    presentTemporaryPackages.push(temporaryPackage)

    const deps = dependencyNames(existing.pkg)
    if (!temporaryPackage.ownerDependencies.some((dependencyName) => deps.has(dependencyName))) {
      problems.push(
        `${path.relative(repoRoot, existing.packageJsonPath)}: ${temporaryPackage.name} is a temporary ${temporaryPackage.kind} for ${temporaryPackage.owner}, but does not depend on one of ${temporaryPackage.ownerDependencies.join(", ")}`,
      )
    }

    if (temporaryPackage.kind === "orphan") {
      const importers = findSourceImporters(temporaryPackage.name, existing.packageJsonPath)
      if (importers.length > 0) {
        problems.push(
          `${temporaryPackage.name} is classified as a zero-importer orphan but is still imported by ${formatList(importers)}`,
        )
      }
    }
  }

  for (const [packageName, allowedTemporaryExports] of temporaryOwnerExports) {
    const existing = packagesByName.get(packageName)
    if (!existing) {
      problems.push(
        `${packageName} owns temporary export cleanup entries but the package is missing`,
      )
      continue
    }

    const allowed = new Set(allowedTemporaryExports)
    for (const [sourceName, exportContainer] of [
      ["exports", existing.pkg.exports],
      [
        "publishConfig.exports",
        (existing.pkg.publishConfig as Record<string, unknown> | undefined)?.exports,
      ],
    ] as const) {
      for (const exportKey of exportKeys(exportContainer)) {
        if (!isTemporaryOwnerExport(packageName, exportKey)) continue
        if (!allowed.has(exportKey)) {
          problems.push(
            `${path.relative(repoRoot, existing.packageJsonPath)}: ${sourceName} contains unclassified temporary owner export ${exportKey}`,
          )
          continue
        }
        presentTemporaryExports.push({ packageName, exportKey, source: sourceName })
      }
    }
  }

  const legacyExtrasSchema = await importSchemaFile("packages/extras/src/schema.ts")
  const inventoryExtrasSchema = await importSchemaFile("packages/inventory/src/extras/schema.ts")
  const bookingsExtrasSchema = await importSchemaFile("packages/bookings/src/extras/schema.ts")
  const legacyExtrasTables = legacyExtrasSchema
    ? collectTableNames(legacyExtrasSchema)
    : new Set<string>()

  if (packagesByName.has("@voyantjs/extras") && !legacyExtrasSchema) {
    problems.push("@voyantjs/extras exists but packages/extras/src/schema.ts is missing")
  }

  if (legacyExtrasSchema) {
    if (!inventoryExtrasSchema) {
      problems.push(
        "Inventory extras owner schema is missing at packages/inventory/src/extras/schema.ts",
      )
    }
    if (!bookingsExtrasSchema) {
      problems.push(
        "Bookings extras owner schema is missing at packages/bookings/src/extras/schema.ts",
      )
    }

    const ownerExtrasTables = new Set([
      ...collectTableNames(inventoryExtrasSchema ?? {}),
      ...collectTableNames(bookingsExtrasSchema ?? {}),
    ])
    const legacyOnlyExtrasTables = diffSet(legacyExtrasTables, ownerExtrasTables)
    const ownerOnlyExtrasTables = diffSet(ownerExtrasTables, legacyExtrasTables)

    if (legacyExtrasTables.size === 0) {
      problems.push("@voyantjs/extras legacy schema does not export any Drizzle tables")
    }

    if (legacyOnlyExtrasTables.length > 0 || ownerOnlyExtrasTables.length > 0) {
      problems.push(
        [
          "@voyantjs/extras legacy schema table names must exactly mirror Inventory/Bookings extras owner tables.",
          `legacy-only: ${formatList(legacyOnlyExtrasTables)}`,
          `owner-only: ${formatList(ownerOnlyExtrasTables)}`,
        ].join(" "),
      )
    }
  }

  if (failOnTemporary) {
    for (const temporaryPackage of presentTemporaryPackages) {
      problems.push(
        `${temporaryPackage.name} still exists as a temporary ${temporaryPackage.kind}; remove it or explicitly reclassify it before v1`,
      )
    }

    const temporaryExportSummaries = [
      ...new Set(presentTemporaryExports.map((entry) => `${entry.packageName}${entry.exportKey}`)),
    ].sort()
    for (const summary of temporaryExportSummaries) {
      problems.push(`${summary} is still exported as a temporary owner-path subpath`)
    }
  }

  if (problems.length > 0) {
    console.error("V1 package cleanup gate failed:\n")
    for (const problem of problems) {
      console.error(`  - ${problem}`)
    }
    process.exit(1)
  }

  console.log("V1 package cleanup gate")
  console.log(
    `  temporary wrappers/facades inventoried: ${presentTemporaryPackages.length} (${presentTemporaryPackages.filter((entry) => entry.kind === "orphan").length} orphan, ${presentTemporaryPackages.filter((entry) => entry.kind === "facade").length} facade)`,
  )
  console.log(`  temporary owner subpath exports inventoried: ${presentTemporaryExports.length}`)
  console.log(`  legacy extras schema tables: ${formatList([...legacyExtrasTables].sort())}`)
  console.log(
    failOnTemporary
      ? "  strict mode: no temporary package or owner subpath exports remain"
      : "  normal mode: temporary surfaces are explicit; run with --fail-on-temporary for the v1 release cut",
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
