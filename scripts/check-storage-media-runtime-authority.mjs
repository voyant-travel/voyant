import { readFileSync } from "node:fs"
import path from "node:path"

const rootIndex = process.argv.indexOf("--root")
const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : ".")
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8")
const failures = []

const storageContributor = read("packages/storage/src/runtime-contributor.ts")
const storageRuntime = read("packages/storage/src/standard-node-runtime.ts")
const inventoryContributor = read("packages/inventory/src/runtime-contributor.ts")
const brochureRuntime = read("packages/inventory/src/standard-node-brochure-runtime.ts")
const mediaFacade = read("starters/operator/src/api/runtime/media-runtime.ts")
const storageFacade = read("starters/operator/src/api/lib/storage.ts")
const brochureFacade = read("starters/operator/src/lib/brochure-printer.ts")
const storagePackage = JSON.parse(read("packages/storage/package.json"))
const inventoryPackage = JSON.parse(read("packages/inventory/package.json"))
const policy = JSON.parse(read("scripts/fixtures/storage-media-runtime-policy.json"))

if (!storageContributor.includes("primitives: VoyantRuntimeHostPrimitives")) {
  failures.push("Storage contributor must consume generic runtime host primitives")
}
if (
  /capabilities|loadStorageMediaRuntime/.test(storageContributor) ||
  !storageContributor.includes("createStorageStandardNodeRuntime(host.primitives)")
) {
  failures.push("Storage contributor must construct its standard Node runtime package-side")
}
if (
  !inventoryContributor.includes("createInventoryBrochureStandardNodeRuntime(host.primitives)") ||
  /runtime\.brochure/.test(inventoryContributor)
) {
  failures.push("Inventory brochure port must be derived package-side from generic primitives")
}

for (const token of policy.storageRuntimeTokens) {
  if (!storageRuntime.includes(token)) failures.push(`Storage runtime must preserve ${token}`)
}
for (const token of policy.brochureRuntimeTokens) {
  if (!brochureRuntime.includes(token)) failures.push(`Brochure runtime must preserve ${token}`)
}

if (
  !storageFacade.includes('from "@voyant-travel/storage/standard-node"') ||
  /createR2Provider|MIME_BY_EXT|DOCUMENTS_BUCKET/.test(storageFacade)
) {
  failures.push("Operator storage library must remain a package re-export facade")
}
if (
  !brochureFacade.includes('from "@voyant-travel/inventory/standard-node/brochure-runtime"') ||
  /browser\.pdf|brochureBodyToHtml|getCloudClient/.test(brochureFacade)
) {
  failures.push("Operator brochure printer must remain a package re-export facade")
}
if (
  !mediaFacade.includes("createStorageStandardNodeRuntime(directEnvPrimitives)") ||
  !mediaFacade.includes("createInventoryBrochureStandardNodeRuntime(directEnvPrimitives)") ||
  /createMediaStorage|createVideoUploadTicket|tryGetCloudClient/.test(mediaFacade)
) {
  failures.push("Operator media runtime must only adapt package-owned standard Node runtimes")
}

if (
  storagePackage.exports["./standard-node"] !== "./src/standard-node-runtime.ts" ||
  storagePackage.publishConfig?.exports?.["./standard-node"]?.import !==
    "./dist/standard-node-runtime.js"
) {
  failures.push("Storage must publish its standard Node runtime")
}
if (
  inventoryPackage.exports["./standard-node/brochure-runtime"] !==
    "./src/standard-node-brochure-runtime.ts" ||
  inventoryPackage.publishConfig?.exports?.["./standard-node/brochure-runtime"]?.import !==
    "./dist/standard-node-brochure-runtime.js"
) {
  failures.push("Inventory must publish its standard Node brochure runtime")
}
if (storagePackage.dependencies?.["@voyant-travel/inventory"]) {
  failures.push("Storage must not depend on Inventory")
}
if (storagePackage.dependencies?.["@voyant-travel/hono"]) {
  failures.push("Storage must not create the Hono/public-document-delivery dependency cycle")
}
if (inventoryPackage.dependencies?.["@voyant-travel/storage"] !== "workspace:^") {
  failures.push("Inventory must retain the existing acyclic dependency on Storage")
}

if (failures.length > 0) {
  console.error("check-storage-media-runtime-authority: FAILED")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("check-storage-media-runtime-authority: OK")
