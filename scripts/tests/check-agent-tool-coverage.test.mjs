import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  formatAgentToolCoverageMarkdown,
  inspectAgentToolCoverage,
} from "../lib/agent-tool-coverage.mjs"

const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/agent-tool-coverage/${name}.json`, import.meta.url), "utf8"),
  )

describe("agent Tool coverage checker", () => {
  it("derives Tool surfaces and accepts explicit no-Tool postures", () => {
    const result = inspectAgentToolCoverage(fixture("valid"))

    assert.deepEqual(result.diagnostics, [])
    assert.deepEqual(
      result.rows.map(({ unitId, posture }) => [unitId, posture]),
      [
        ["@voyant-travel/inventory", "tools"],
        ["@voyant-travel/operations", "planned"],
        ["@voyant-travel/storage", "not-applicable"],
      ],
    )
  })

  it("rejects missing, invalid, and contradictory declarations", () => {
    const result = inspectAgentToolCoverage(fixture("invalid"))

    const diagnostics = result.diagnostics.join("\n")
    assert.match(diagnostics, /availability.*must declare meta\.agentTools/)
    assert.match(diagnostics, /operations.*posture must be "planned" or "not-applicable"/)
    assert.match(diagnostics, /operations.*rationale must be a non-empty string/)
    assert.match(diagnostics, /catalog.*remove the redundant no-Tool posture/)
  })

  it("requires a tracking issue for planned coverage", () => {
    const result = inspectAgentToolCoverage([
      {
        packageName: "@voyant-travel/flights",
        unitId: "@voyant-travel/flights",
        tools: [],
        agentTools: { posture: "planned", rationale: "Flight Tools remain to be authored." },
      },
    ])

    assert.match(result.diagnostics.join("\n"), /must name a tracking issue/)
  })

  it("supports only an explicit, documented transport exclusion", () => {
    const result = inspectAgentToolCoverage(
      [
        {
          packageName: "@voyant-travel/mcp",
          unitId: "@voyant-travel/mcp",
          tools: [],
        },
      ],
      {
        exclusions: new Map([
          [
            "@voyant-travel/mcp",
            { rationale: "The MCP module is the Tool transport adapter, not a domain surface." },
          ],
        ]),
      },
    )

    assert.deepEqual(result.diagnostics, [])
    assert.equal(result.rows[0].posture, "transport-excluded")
  })

  it("sorts modules and Tools in the generated report", () => {
    const { rows } = inspectAgentToolCoverage([
      {
        packageName: "@voyant-travel/zeta",
        unitId: "@voyant-travel/zeta",
        tools: [{ id: "zeta.b" }, { id: "zeta.a" }],
      },
      {
        packageName: "@voyant-travel/alpha",
        unitId: "@voyant-travel/alpha",
        tools: [],
        agentTools: { posture: "not-applicable", rationale: "Schema-only module." },
      },
    ])
    const report = formatAgentToolCoverageMarkdown(rows)

    assert.match(report, /Modules: 2 \| Tools: 2 \| Tool surfaces: 1/)
    assert.ok(report.indexOf("@voyant-travel/alpha") < report.indexOf("@voyant-travel/zeta"))
    assert.ok(report.indexOf("`zeta.a`") < report.indexOf("`zeta.b`"))
  })
})
