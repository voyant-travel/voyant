import { readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const operatorRuntime = await read("packages/operator-runtime/src/index.ts")
const nodeRuntime = await read("packages/framework/src/node-runtime.ts")
const deploymentArtifacts = await read("packages/framework/src/deployment-artifacts.ts")
const frameworkPackage = JSON.parse(await read("packages/framework/package.json"))
const violations = []

for (const forbidden of [
  "voyant.managed-profile.v1",
  'profile: "operator"',
  "@voyant-travel/framework/managed-runtime",
  "loadManagedProfileRuntime",
]) {
  if (operatorRuntime.includes(forbidden)) {
    violations.push(`operator-runtime must not contain compatibility runtime token ${forbidden}`)
  }
}

for (const required of [
  "@voyant-travel/framework/node-runtime",
  "createVoyantNodeRuntimeHostPrimitives",
  "loadVoyantNodeRuntime",
  "deploymentRequirements: graph.requirements",
  "runtimePorts: generated.createRuntimePorts({ primitives })",
]) {
  if (!operatorRuntime.includes(required)) {
    violations.push(
      `operator-runtime must consume graph-native Node runtime authority: ${required}`,
    )
  }
}
if (operatorRuntime.includes("createVoyantGraphRuntimePortStubs")) {
  violations.push("operator-runtime must not boot selected package routes with runtime port stubs")
}

for (const required of [
  "createVoyantNodeRuntimeHostPrimitives",
  "loadVoyantNodeRuntime",
  "startVoyantNodeRuntime",
  "VOYANT_NODE_HOST_REQUIREMENT_MISSING",
  'VoyantNodeHostRequirementError("events.deliver")',
  "VoyantNodeRuntimeOptions",
]) {
  if (!nodeRuntime.includes(required)) {
    violations.push(`framework node-runtime must export ${required}`)
  }
}
if (!deploymentArtifacts.includes("createRuntimePorts: createGeneratedGraphRuntimePorts")) {
  violations.push("generated project runtimes must expose their static runtime port composition")
}

if (!deploymentArtifacts.includes("@voyant-travel/framework/node-runtime")) {
  violations.push("generated deployment entries must import the generic Node runtime")
}
if (deploymentArtifacts.includes("profileSnapshotPath: resolveGeneratedProfileSnapshotPath()")) {
  violations.push("generated deployment entries must not boot from a managed-profile snapshot")
}
if (frameworkPackage.exports?.["./node-runtime"] !== "./src/node-runtime.ts") {
  violations.push("framework must publish the ./node-runtime source entry")
}
if (!frameworkPackage.publishConfig?.exports?.["./node-runtime"]) {
  violations.push("framework must publish the ./node-runtime distribution entry")
}
for (const retiredExport of [
  "./profile",
  "./managed-jobs",
  "./managed-profile-compatibility",
  "./managed-runtime",
]) {
  if (
    frameworkPackage.exports?.[retiredExport] ||
    frameworkPackage.publishConfig?.exports?.[retiredExport]
  ) {
    violations.push(`framework must not publish retired compatibility export ${retiredExport}`)
  }
}

if (violations.length > 0) {
  throw new Error(`check-node-runtime-authority:\n- ${violations.join("\n- ")}`)
}

console.log("check-node-runtime-authority: OK (generated graphs own generic Node boot inputs)")

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8")
}
