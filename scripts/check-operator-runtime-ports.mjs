import { readFile } from "node:fs/promises"

const compositionPath = "starters/operator/src/api/composition.ts"
const composition = await readFile(compositionPath, "utf8")

function section(start, end) {
  const startIndex = composition.indexOf(start)
  const endIndex = composition.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`check-operator-runtime-ports: could not locate ${start}`)
  }
  return composition.slice(startIndex, endIndex)
}

const runtimePorts = section(
  "export function buildOperatorRuntimePorts",
  "function createLazyCatalogSearchRuntime",
)
const compatibilityModules = section(
  "export const operatorGraphCompatibilityModules",
  "export const operatorGraphCompatibilityExtensions",
)
const runtimeBindings = section(
  "export const operatorGraphRuntimeBindings",
  "function bindingsFromModuleFactories",
)

for (const port of ["channelPushRuntimePort", "storageMediaRuntimePort", "realtimeRuntimePort"]) {
  if (!runtimePorts.includes(`[${port}.id]`)) {
    throw new Error(`check-operator-runtime-ports: buildOperatorRuntimePorts must bind ${port}.id`)
  }
}

for (const packageId of [
  "@voyant-travel/distribution#channel-push-extension",
  "@voyant-travel/storage",
  "@voyant-travel/realtime",
]) {
  if (compatibilityModules.includes(`"${packageId}"`)) {
    throw new Error(
      `check-operator-runtime-ports: ${packageId} must compose through its declared runtime port, not operatorGraphCompatibilityModules`,
    )
  }
  if (runtimeBindings.includes(`"${packageId}"`)) {
    throw new Error(
      `check-operator-runtime-ports: ${packageId} must not return to package-keyed operatorGraphRuntimeBindings`,
    )
  }
}

console.log(
  "check-operator-runtime-ports: OK (channel-push, storage, and realtime are bound by typed ports)",
)
