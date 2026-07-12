import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import {
  adapterBoundaryViolations,
  findProductionDependencyCycles,
} from "./lib/node-runtime-adapter-dependency-policy.mjs"

const rootArgumentIndex = process.argv.indexOf("--root")
const root = path.resolve(rootArgumentIndex >= 0 ? process.argv[rootArgumentIndex + 1] : ".")
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8")
const adapters = [
  {
    packageName: "@voyant-travel/bookings-node",
    directory: "bookings-node",
    factory: "createBookingsNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/bookings"],
  },
  {
    packageName: "@voyant-travel/finance-node",
    directory: "finance-node",
    factory: "createFinanceNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/finance"],
  },
  {
    packageName: "@voyant-travel/catalog-node",
    directory: "catalog-node",
    factory: "createCatalogNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/catalog", "@voyant-travel/cruises"],
  },
  {
    packageName: "@voyant-travel/legal-node",
    directory: "legal-node",
    factory: "createLegalNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/legal"],
  },
  {
    packageName: "@voyant-travel/flights-node",
    directory: "flights-node",
    factory: "createFlightsNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/flights"],
  },
  {
    packageName: "@voyant-travel/notifications-node",
    directory: "notifications-node",
    factory: "createNotificationsNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/notifications"],
  },
  {
    packageName: "@voyant-travel/quotes-node",
    directory: "quotes-node",
    factory: "createQuotesNodeRuntimePortContribution",
    domainPackageNames: ["@voyant-travel/quotes"],
  },
]
const manifests = readWorkspaceManifests()
const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]))
const runtimeBom = JSON.parse(read("release.runtime-packages.generated.json")).runtimePackages
const generatedBom = read("packages/framework/src/runtime-packages.generated.ts")
const framework = byName.get("@voyant-travel/framework")
const starterAuthority = [
  read("starters/operator/voyant.config.ts"),
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  read("packages/framework/src/node-runtime.ts"),
].join("\n")
const graphGenerator = read("packages/framework/src/deployment-artifacts.ts")
const graphResolver = read("scripts/lib/operator-deployment-graph-package-records.ts")
const graphEmitter = read("scripts/emit-deployment-graph.ts")
const violations = adapterBoundaryViolations(manifests, adapters)

for (const cycle of findProductionDependencyCycles(manifests)) {
  violations.push(`workspace production dependency cycle: ${cycle.join(" -> ")}`)
}
for (const adapter of adapters) {
  const manifest = byName.get(adapter.packageName)
  const runtime = manifest?.voyant?.runtime
  if (manifest?.voyant?.schemaVersion !== "voyant.package.v1") {
    violations.push(`${adapter.packageName} must declare voyant.package.v1 metadata`)
  }
  if (manifest?.voyant?.kind !== "library") {
    violations.push(`${adapter.packageName} must remain a target adapter library`)
  }
  if (runtime?.entry !== "./runtime-contributor" || runtime?.export !== adapter.factory) {
    violations.push(`${adapter.packageName} has invalid runtime contributor metadata`)
  }
  if (!manifest?.exports?.["./runtime-contributor"]) {
    violations.push(`${adapter.packageName} must export ./runtime-contributor`)
  }
  if (!runtimeBom.includes(adapter.packageName)) {
    violations.push(`${adapter.packageName} must be selected by the standard Node runtime BOM`)
  }
  if (!generatedBom.includes(`"${adapter.packageName}"`)) {
    violations.push(`${adapter.packageName} is missing from generated framework BOM membership`)
  }
  if (!framework?.dependencies?.[adapter.packageName]) {
    violations.push(`${adapter.packageName} must be supplied by the framework BOM dependency set`)
  }
  if (starterAuthority.includes(adapter.packageName)) {
    violations.push(`starter/framework resident composition must not name ${adapter.packageName}`)
  }
}
for (const domainPackageName of [
  "@voyant-travel/bookings",
  "@voyant-travel/finance",
  "@voyant-travel/catalog",
  "@voyant-travel/cruises",
  "@voyant-travel/legal",
  "@voyant-travel/flights",
  "@voyant-travel/notifications",
  "@voyant-travel/quotes",
]) {
  const domain = byName.get(domainPackageName)
  if (domain?.voyant?.runtime) {
    violations.push(`${domainPackageName} must not retain standard Node contributor metadata`)
  }
  if (domain?.exports?.["./runtime-contributor"]) {
    violations.push(`${domainPackageName} must not export a target runtime contributor`)
  }
}
if (!graphResolver.includes("FRAMEWORK_RUNTIME_PACKAGES.filter(")) {
  violations.push("Operator graph resolution must admit standard BOM runtime package records")
}
if (
  !graphResolver.includes("additionalRuntimePackageNames") ||
  !graphResolver.includes("!discoveredPackageNames.has(packageName)")
) {
  violations.push("Operator graph resolution must not re-admit already selected product packages")
}
if (
  !graphResolver.includes(
    'OPERATOR_PACKAGE_RECORD_IMPORTERS = ["starters/operator", "packages/framework"]',
  )
) {
  violations.push("Operator graph resolution must derive adapter provenance from the framework BOM")
}
if (!graphGenerator.includes("const runtime = record.metadata?.runtime")) {
  violations.push("Graph runtime generation must lower contributors from admitted package records")
}
if (!graphEmitter.includes('overrides[entry] = "@voyant-travel/framework/runtime-contributors"')) {
  violations.push(
    "standard runtime contributors must resolve through the direct framework dependency",
  )
}
if (graphGenerator.includes("selectedPackageNames.has(record.packageName)")) {
  violations.push("Graph runtime generation must not require an adapter to own a product unit")
}

if (violations.length > 0) {
  throw new Error(`check-node-runtime-adapter-dependencies:\n- ${violations.join("\n- ")}`)
}
console.log(
  `check-node-runtime-adapter-dependencies: OK (${adapters.length} BOM-selected leaf adapters; production graph acyclic)`,
)

function readWorkspaceManifests() {
  const manifests = []
  for (const workspaceRoot of ["packages", "starters", "apps", "examples"]) {
    const absoluteRoot = path.join(root, workspaceRoot)
    if (!existsSync(absoluteRoot)) continue
    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const packageJsonPath = path.join(absoluteRoot, entry.name, "package.json")
      if (existsSync(packageJsonPath)) {
        manifests.push(JSON.parse(readFileSync(packageJsonPath, "utf8")))
      } else if (workspaceRoot === "packages") {
        for (const nested of readdirSync(path.join(absoluteRoot, entry.name), {
          withFileTypes: true,
        })) {
          if (!nested.isDirectory()) continue
          const nestedPackageJson = path.join(absoluteRoot, entry.name, nested.name, "package.json")
          if (existsSync(nestedPackageJson)) {
            manifests.push(JSON.parse(readFileSync(nestedPackageJson, "utf8")))
          }
        }
      }
    }
  }
  return manifests
}
