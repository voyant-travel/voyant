import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const rootIndex = process.argv.indexOf("--root")
const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : ".")
const read = (file) => readFileSync(path.join(root, file), "utf8")
const json = (file) => JSON.parse(read(file))
const violations = []

const catalog = json("packages/catalog/package.json")
const cyclicPackages = [
  "@voyant-travel/accommodations",
  "@voyant-travel/charters",
  "@voyant-travel/commerce",
  "@voyant-travel/cruises",
  "@voyant-travel/distribution",
  "@voyant-travel/inventory",
  "@voyant-travel/operations",
  "@voyant-travel/plugin-catalog-demo",
]

if (existsSync(path.join(root, "packages/catalog-node"))) {
  violations.push("the retired Catalog target package still exists")
}
if (
  catalog.voyant?.runtime?.entry !== "./runtime-contributor" ||
  catalog.voyant?.runtime?.export !== "createCatalogRuntimePortContribution"
) {
  violations.push("Catalog must own the manifest-selected runtime contributor")
}
if (!catalog.exports?.["./runtime-contracts"] || !catalog.exports?.["./runtime-contributor"]) {
  violations.push("Catalog must publish its neutral contracts and manifest contributor")
}
if (Object.keys(catalog.exports ?? {}).some((entry) => entry.includes("standard-node"))) {
  violations.push("Catalog must not publish a target-labelled runtime namespace")
}
for (const packageName of cyclicPackages) {
  if (catalog.dependencies?.[packageName] || catalog.optionalDependencies?.[packageName]) {
    violations.push(`Catalog must invert the ${packageName} runtime edge`)
  }
}

const catalogProduction = sourceFiles("packages/catalog/src")
  .filter((file) => !file.endsWith(".test.ts"))
  .map((file) => read(file))
  .join("\n")
for (const packageName of cyclicPackages) {
  const escaped = packageName.replaceAll("/", "\\/").replaceAll("-", "\\-")
  if (
    new RegExp(`(?:from\\s+|import\\s*\\()\\s*["']${escaped}(?:/[^"']*)?["']`).test(
      catalogProduction,
    )
  ) {
    violations.push(`Catalog has a static production import of ${packageName}`)
  }
}

const contracts = read("packages/catalog/src/runtime-contracts.ts")
const contributor = read("packages/catalog/src/runtime-contributor.ts")
const runtime = read("packages/catalog/src/runtime.ts")
for (const token of [
  "CatalogRuntimeExtensions",
  "CatalogRuntimeServices",
  "catalogRuntimeServicesPort",
  "requireCatalogRuntimeServices",
]) {
  if (!contracts.includes(token)) violations.push(`Catalog runtime contracts are missing ${token}`)
}
for (const token of ["createCatalogRuntimePortContribution", "catalogRuntimeServicesPort.id"]) {
  if (!contributor.includes(token)) violations.push(`Catalog contributor is missing ${token}`)
}
for (const token of ["loadCatalogRuntimeExtensions", "installCatalogRuntimeServices"]) {
  if (!runtime.includes(token)) violations.push(`Catalog private runtime is missing ${token}`)
}

for (const [directory, exportName] of [
  ["accommodations", "catalogAccommodationsRuntimeExtension"],
  ["charters", "catalogChartersRuntimeExtension"],
  ["commerce", "catalogCommerceRuntimeExtension"],
  ["cruises", "catalogCruisesRuntimeExtension"],
  ["distribution", "catalogDistributionRuntimeExtension"],
  ["inventory", "catalogInventoryRuntimeExtension"],
  ["operations", "catalogOperationsRuntimeExtension"],
  ["plugins/catalog-demo", "catalogDemoRuntimeExtension"],
]) {
  const manifest = json(`packages/${directory}/package.json`)
  if (!manifest.exports?.["./catalog-runtime-extension"]) {
    violations.push(`${manifest.name} must export its Catalog runtime extension`)
  }
  if (!read(`packages/${directory}/src/catalog-runtime-extension.ts`).includes(exportName)) {
    violations.push(`${manifest.name} must implement ${exportName}`)
  }
}

const operatorResources = read("starters/operator/src/api/runtime/deployment-resources.ts")
if (!operatorResources.includes("modules:") || !operatorResources.includes("import: (specifier)")) {
  violations.push("the host must expose a generic module import primitive")
}
if (/loadCatalogRuntime|catalogRuntimeRegistry|catalogCapabilities/.test(operatorResources)) {
  violations.push("the starter must not own Catalog runtime capabilities")
}

for (const file of [
  "release.runtime-packages.generated.json",
  "packages/framework/src/runtime-packages.generated.ts",
  "packages/framework/src/runtime-contributors.generated.ts",
  "packages/typescript-config/dep-paths.json",
  "pnpm-lock.yaml",
]) {
  if (read(file).includes("catalog-node")) violations.push(`${file} retains the retired package`)
}

if (violations.length) {
  throw new Error(`check-catalog-runtime-authority:\n- ${violations.join("\n- ")}`)
}
console.log(
  "check-catalog-runtime-authority: OK (acyclic Catalog-owned runtime; neutral contracts)",
)

function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory)
  return readdirSync(directory).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry)
    const absolute = path.join(root, relative)
    return statSync(absolute).isDirectory()
      ? sourceFiles(relative)
      : entry.endsWith(".ts")
        ? [relative]
        : []
  })
}
