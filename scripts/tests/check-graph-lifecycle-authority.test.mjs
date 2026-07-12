import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inspectGraphLifecycleAuthority } from "../lib/graph-lifecycle-authority.mjs"

function validFixture() {
  const facets = [
    "api",
    "schema",
    "migration",
    "link",
    "subscriber",
    "event",
    "workflow",
    "schedule",
    "setup-migration",
    "config",
    "secret",
    "resource",
    "provider",
    "access-resource",
    "access-role",
    "admin-runtime",
    "admin-copy",
    "admin-route",
    "admin-nav",
    "admin-slot",
    "admin-contribution",
    "tool",
    "webhook",
    "action",
  ]
  return new Map([
    [
      "packages/framework/src/graph-lifecycle.ts",
      `${facets.map((facet) => `"${facet}"`).join(" ")}
       consequences: readonly VoyantGraphLifecycleConsequence[]
       action: "detach" | "activate" | "retain-data" | "release"
       unitFacetEntities(unit)
       retainedDataConsequences(input.operation, unit)
       cleanup.on.includes(input.operation)
       packageRecordsByName(input.previous)
       kind: "migrate-graph" | "detach-unit" | "release-resource" | "activate-unit"`,
    ],
    [
      "packages/core/src/project-facets.ts",
      'uninstall: { default: "retain-data" }; cleanup: { action: "release" }',
    ],
    [
      "packages/framework/src/index.ts",
      "VoyantGraphLifecycleConsequence VoyantGraphLifecycleFacet",
    ],
  ])
}

describe("graph lifecycle authority checker", () => {
  it("accepts graph-derived lifecycle consequences", () => {
    assert.deepEqual(inspectGraphLifecycleAuthority(validFixture()), [])
  })

  it("rejects an unaccounted executable facet", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/graph-lifecycle.ts",
      files.get("packages/framework/src/graph-lifecycle.ts").replace('"webhook"', ""),
    )
    assert.match(inspectGraphLifecycleAuthority(files).join("\n"), /webhook facet/)
  })

  it("rejects loss of retained-data consequences", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/graph-lifecycle.ts",
      files
        .get("packages/framework/src/graph-lifecycle.ts")
        .replace("retainedDataConsequences(input.operation, unit)", "[]"),
    )
    assert.match(inspectGraphLifecycleAuthority(files).join("\n"), /retainedDataConsequences/)
  })

  it("rejects opaque package lifecycle hooks", () => {
    const files = validFixture()
    files.set(
      "packages/core/src/project-facets.ts",
      `${files.get("packages/core/src/project-facets.ts")} onUninstall`,
    )
    assert.match(inspectGraphLifecycleAuthority(files).join("\n"), /onUninstall/)
  })
})
