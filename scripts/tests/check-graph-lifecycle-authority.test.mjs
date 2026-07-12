import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inspectGraphLifecycleAuthority } from "../lib/graph-lifecycle-authority.mjs"

function validFixture() {
  const facets = [
    "runtime",
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
       validateVoyantGraphUpgradeCompatibility(input.previous, input.next)
       isVoyantVersionCompatible(previousVersion, range)
       but the previous graph has no package version to validate
       kind: "migrate-graph" | "detach-unit" | "release-resource" | "activate-unit"`,
    ],
    [
      "packages/framework/src/deployment-graph.ts",
      "export function isVoyantVersionCompatible VOYANT_GRAPH_INCOMPATIBLE_UPGRADE",
    ],
    [
      "packages/core/src/project-facets.ts",
      'uninstall: { default: "retain-data" }; cleanup: { action: "release" }',
    ],
    [
      "packages/framework/src/index.ts",
      "VoyantGraphLifecycleConsequence VoyantGraphLifecycleFacet validateVoyantGraphUpgradeCompatibility",
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

  it("rejects missing runtime consequence accounting", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/graph-lifecycle.ts",
      files.get("packages/framework/src/graph-lifecycle.ts").replace('"runtime"', ""),
    )
    assert.match(inspectGraphLifecycleAuthority(files).join("\n"), /runtime facet/)
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

  it("accepts upgradeFrom enforcement through the shared version-range utility", () => {
    assert.deepEqual(inspectGraphLifecycleAuthority(validFixture()), [])
  })

  it("rejects planning that bypasses upgradeFrom range validation", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/graph-lifecycle.ts",
      files
        .get("packages/framework/src/graph-lifecycle.ts")
        .replace("validateVoyantGraphUpgradeCompatibility(input.previous, input.next)", "[]"),
    )
    assert.match(
      inspectGraphLifecycleAuthority(files).join("\n"),
      /validateVoyantGraphUpgradeCompatibility/,
    )
  })

  it("rejects compatibility handling that does not fail closed without provenance", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/graph-lifecycle.ts",
      files
        .get("packages/framework/src/graph-lifecycle.ts")
        .replace(
          "but the previous graph has no package version to validate",
          "version unavailable",
        ),
    )
    assert.match(inspectGraphLifecycleAuthority(files).join("\n"), /no package version/)
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
