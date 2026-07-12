import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inspectPhase5ToolsMcpAuthority } from "../lib/phase5-tools-mcp-authority.mjs"

function validFixture() {
  return new Map([
    [
      "packages/mcp/package.json",
      JSON.stringify({
        exports: { "./runtime": "runtime", "./voyant": "voyant" },
        voyant: { kind: "module", manifest: "./voyant" },
      }),
    ],
    [
      "packages/mcp/src/voyant.ts",
      'defineModule({ id: "@voyant-travel/mcp", runtimePorts: [], api: [{ mount: "mcp", runtime: { entry: "@voyant-travel/mcp/runtime" } }] })',
    ],
    [
      "packages/mcp/src/runtime.ts",
      "defineGraphRuntimeFactory(() => mcpRuntimePort && createGraphMcpHonoApp())",
    ],
    ["packages/mcp/src/runtime-port.ts", 'definePort({ id: "mcp.runtime" })'],
    ["packages/framework/src/operator-distribution.ts", 'resolve: "@voyant-travel/mcp"'],
    ["starters/operator/src/api/app.ts", "ports[mcpRuntimePort.id] = { runtime: graphRuntime }"],
    ["packages/framework/src/project-resolver.ts", "buildProjectRuntimeModule(graph)"],
  ])
}

describe("Phase 5 tools/MCP authority checker", () => {
  it("accepts package-selected MCP and graph-only executable eligibility", () => {
    assert.deepEqual(inspectPhase5ToolsMcpAuthority(validFixture()), [])
  })

  it("rejects the Operator-local MCP compatibility module", () => {
    const files = validFixture()
    files.set("starters/operator/src/modules/mcp/index.ts", "mcpModule")
    assert.match(inspectPhase5ToolsMcpAuthority(files).join("\n"), /must be removed/)
  })

  it("rejects central tool, action, and webhook eligibility catalogs", () => {
    const files = validFixture()
    files.set(
      "packages/framework/src/project-resolver.ts",
      '["manifests/tools.json", "manifests/actions.json", "manifests/webhooks.json"]',
    )
    const failures = inspectPhase5ToolsMcpAuthority(files).join("\n")
    assert.match(failures, /manifests\/tools\.json/)
    assert.match(failures, /manifests\/actions\.json/)
    assert.match(failures, /manifests\/webhooks\.json/)
  })

  it("rejects MCP packages without manifest authority", () => {
    const files = validFixture()
    files.set("packages/mcp/package.json", JSON.stringify({ exports: {} }))
    const failures = inspectPhase5ToolsMcpAuthority(files).join("\n")
    assert.match(failures, /voyant metadata/)
    assert.match(failures, /runtime and voyant exports/)
  })
})
