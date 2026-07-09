import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

import { buildDeploymentGraphJson } from "../../packages/framework/src/deployment-artifacts.ts"
import {
  defineModule,
  defineProject,
  resolveDeploymentGraph,
} from "../../packages/framework/src/deployment-graph.ts"
import {
  buildDeploymentGraphDoctorJson,
  buildDeploymentGraphDoctorReport,
  checkDeploymentGraphGeneratedArtifacts,
  formatDeploymentGraphDoctorReport,
} from "../lib/deployment-graph-doctor.ts"

describe("deployment graph doctor report", () => {
  it("emits deterministic JSON diagnostics for missing and stale generated artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "voyant-graph-doctor-"))
    const generatedRoot = join(root, "starters", "operator")
    await mkdir(generatedRoot, { recursive: true })

    const freshPath = join(generatedRoot, "deployment-graph.generated.json")
    const stalePath = join(generatedRoot, "runtime-entry.generated.ts")
    const missingPath = join(generatedRoot, "deployment-artifacts.generated.json")
    await writeFile(freshPath, "fresh\n", "utf8")
    await writeFile(stalePath, "old\n", "utf8")

    const diagnostics = await checkDeploymentGraphGeneratedArtifacts(
      [
        {
          path: stalePath,
          expected: "new\n",
          facet: "runtime-entry",
          hint: "Run graph:emit.",
        },
        {
          path: freshPath,
          expected: "fresh\n",
          facet: "deployment-graph",
        },
        {
          path: missingPath,
          expected: "{}\n",
          facet: "deployment-artifacts",
          hint: "Run graph:emit.",
        },
      ],
      { repoRoot: root },
    )

    assert.deepEqual(
      diagnostics.map((entry) => ({
        code: entry.code,
        source: entry.source,
        facet: entry.facet,
      })),
      [
        {
          code: "VOYANT_GRAPH_ARTIFACT_MISSING",
          source: "starters/operator/deployment-artifacts.generated.json",
          facet: "deployment-artifacts",
        },
        {
          code: "VOYANT_GRAPH_ARTIFACT_STALE",
          source: "starters/operator/runtime-entry.generated.ts",
          facet: "runtime-entry",
        },
      ],
    )

    const report = buildDeploymentGraphDoctorReport({
      graph: await cleanGraph(),
      diagnostics,
    })
    const firstJson = buildDeploymentGraphDoctorJson(report)
    const secondJson = buildDeploymentGraphDoctorJson(report)

    assert.equal(report.ok, false)
    assert.equal(firstJson, secondJson)
    assert.match(firstJson, /"schemaVersion": "voyant.graph-doctor-report.v1"/)
    assert.match(firstJson, /"code": "VOYANT_GRAPH_ARTIFACT_MISSING"/)
    assert.match(formatDeploymentGraphDoctorReport(report), /VOYANT_GRAPH_ARTIFACT_STALE/)
  })

  it("uses resolver diagnostics and artifact diagnostics in the same contract", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          requires: { capabilities: ["acme.crm.people"] },
        }),
      ],
    })
    const graph = await resolveDeploymentGraph({ project, target: "node", mode: "self-hosted" })
    const report = buildDeploymentGraphDoctorReport({
      graph,
      diagnostics: [
        {
          code: "VOYANT_GRAPH_ARTIFACT_STALE",
          severity: "error",
          source: "starters/operator/deployment-graph.generated.json",
          facet: "deployment-graph",
          message: "starters/operator/deployment-graph.generated.json is stale.",
        },
      ],
    })
    const parsed = JSON.parse(buildDeploymentGraphDoctorJson(report)) as {
      diagnostics: Array<{ code: string }>
    }

    assert.deepEqual(
      parsed.diagnostics.map((entry) => entry.code),
      ["VOYANT_GRAPH_ARTIFACT_STALE", "VOYANT_GRAPH_MISSING_CAPABILITY"],
    )
  })

  it("reports clean graphs as ok", async () => {
    const graph = await cleanGraph()
    const report = buildDeploymentGraphDoctorReport({ graph })

    assert.equal(report.ok, true)
    assert.equal(report.diagnostics.length, 0)
    assert.deepEqual(JSON.parse(buildDeploymentGraphJson(graph)).diagnostics, [])
    assert.match(formatDeploymentGraphDoctorReport(report), /deployment graph doctor: OK/)
  })
})

async function cleanGraph() {
  const project = defineProject({
    modules: [
      defineModule({
        id: "@acme/voyant-loyalty",
        provides: { capabilities: ["acme.loyalty.points"] },
      }),
    ],
  })
  return resolveDeploymentGraph({ project, target: "node", mode: "self-hosted" })
}
