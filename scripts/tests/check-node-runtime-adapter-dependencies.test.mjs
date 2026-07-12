import assert from "node:assert/strict"
import test from "node:test"
import {
  adapterBoundaryViolations,
  findProductionDependencyCycles,
} from "../lib/node-runtime-adapter-dependency-policy.mjs"

const adapter = {
  packageName: "@test/reservations-node",
  domainPackageNames: ["@test/reservations"],
}

test("accepts a leaf target adapter", () => {
  const manifests = [
    { name: "@test/reservations", dependencies: { "@test/core": "workspace:^" } },
    {
      name: "@test/reservations-node",
      dependencies: { "@test/reservations": "workspace:^" },
    },
    { name: "@test/core" },
  ]
  assert.deepEqual(adapterBoundaryViolations(manifests, [adapter]), [])
  assert.deepEqual(findProductionDependencyCycles(manifests), [])
})

test("rejects a domain dependency back to its target adapter", () => {
  const manifests = [
    {
      name: "@test/reservations",
      dependencies: { "@test/reservations-node": "workspace:^" },
    },
    {
      name: "@test/reservations-node",
      dependencies: { "@test/reservations": "workspace:^" },
    },
  ]
  assert.deepEqual(adapterBoundaryViolations(manifests, [adapter]), [
    "@test/reservations must not depend on leaf adapter @test/reservations-node",
  ])
  assert.deepEqual(findProductionDependencyCycles(manifests), [
    ["@test/reservations", "@test/reservations-node", "@test/reservations"],
  ])
})
