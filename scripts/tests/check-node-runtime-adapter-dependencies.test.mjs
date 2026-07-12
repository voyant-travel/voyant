import assert from "node:assert/strict"
import test from "node:test"
import {
  adapterBoundaryViolations,
  findProductionDependencyCycles,
} from "../lib/node-runtime-adapter-dependency-policy.mjs"

const adapter = {
  packageName: "@test/bookings-node",
  domainPackageNames: ["@test/bookings"],
}

test("accepts a leaf target adapter", () => {
  const manifests = [
    { name: "@test/bookings", dependencies: { "@test/core": "workspace:^" } },
    {
      name: "@test/bookings-node",
      dependencies: { "@test/bookings": "workspace:^" },
    },
    { name: "@test/core" },
  ]
  assert.deepEqual(adapterBoundaryViolations(manifests, [adapter]), [])
  assert.deepEqual(findProductionDependencyCycles(manifests), [])
})

test("rejects a domain dependency back to its target adapter", () => {
  const manifests = [
    {
      name: "@test/bookings",
      dependencies: { "@test/bookings-node": "workspace:^" },
    },
    {
      name: "@test/bookings-node",
      dependencies: { "@test/bookings": "workspace:^" },
    },
  ]
  assert.deepEqual(adapterBoundaryViolations(manifests, [adapter]), [
    "@test/bookings must not depend on leaf adapter @test/bookings-node",
  ])
  assert.deepEqual(findProductionDependencyCycles(manifests), [
    ["@test/bookings", "@test/bookings-node", "@test/bookings"],
  ])
})
