import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const operatorRoot = path.join(repoRoot, "starters", "operator")
const graph = JSON.parse(
  await readFile(path.join(operatorRoot, ".voyant", "deployment-graph.generated.json"), "utf8"),
)
const artifactManifest = JSON.parse(
  await readFile(path.join(operatorRoot, ".voyant", "deployment-artifacts.generated.json"), "utf8"),
)

assert.deepEqual(artifactManifest.accessCatalog, graph.accessCatalog)

const byResource = new Map(
  graph.accessCatalog.resources.map((resource) => [resource.resource, resource]),
)
assert.equal(byResource.get("bookings")?.unitId, "@voyant-travel/bookings")
assert.deepEqual(
  byResource.get("bookings")?.actions.map(({ action }) => action),
  ["read", "write"],
)
assert.deepEqual(byResource.get("bookings")?.legacyActions, ["cancel"])
assert.equal(byResource.get("bookings-pii")?.unitId, "@voyant-travel/bookings")
assert.equal(byResource.get("bookings-pii")?.wildcard, "explicit-resource")

const presets = new Map(graph.accessCatalog.presets.map((preset) => [preset.id, preset]))
assert.deepEqual(presets.get("commerce-read")?.grants, ["bookings:read"])
assert.deepEqual(presets.get("agent-staff")?.grants, ["bookings:read", "bookings:write"])
assert.deepEqual(presets.get("editor")?.grants, ["bookings:read", "bookings:write"])

for (const relativePath of [
  "src/api/app.ts",
  "src/api/auth/handler.ts",
  "src/lib/admin-presentation.tsx",
]) {
  const source = await readFile(path.join(operatorRoot, relativePath), "utf8")
  assert.match(
    source,
    /\.voyant\/access\/selected-access-catalog\.generated/,
    `${relativePath} must consume the generated access catalog`,
  )
}

console.log("access catalog authority: OK")
