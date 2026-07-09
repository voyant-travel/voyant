import { readFile } from "node:fs/promises"
import path from "node:path"

import {
  canonicalJson,
  type ResolvedVoyantDeploymentGraph,
  type VoyantGraphDiagnostic,
} from "../../packages/framework/src/deployment-graph.ts"

export const VOYANT_GRAPH_DOCTOR_REPORT_SCHEMA_VERSION = "voyant.graph-doctor-report.v1" as const

export interface DeploymentGraphArtifactCheck {
  path: string
  expected: string
  facet: string
  hint?: string
}

export interface DeploymentGraphDoctorSummary {
  schemaVersion: ResolvedVoyantDeploymentGraph["schemaVersion"]
  contentHash: string
  target?: string
  mode?: string
  modules: {
    count: number
    ids: readonly string[]
  }
  plugins: {
    count: number
    ids: readonly string[]
  }
  packageRecords: {
    count: number
    packageNames: readonly string[]
  }
}

export interface DeploymentGraphDoctorReport {
  schemaVersion: typeof VOYANT_GRAPH_DOCTOR_REPORT_SCHEMA_VERSION
  ok: boolean
  graph: DeploymentGraphDoctorSummary
  diagnostics: readonly VoyantGraphDiagnostic[]
}

export interface BuildDeploymentGraphDoctorReportInput {
  graph: ResolvedVoyantDeploymentGraph
  diagnostics?: readonly VoyantGraphDiagnostic[]
}

export interface CheckDeploymentGraphGeneratedArtifactsOptions {
  repoRoot?: string
}

export async function checkDeploymentGraphGeneratedArtifacts(
  files: readonly DeploymentGraphArtifactCheck[],
  options: CheckDeploymentGraphGeneratedArtifactsOptions = {},
): Promise<VoyantGraphDiagnostic[]> {
  const diagnostics: VoyantGraphDiagnostic[] = []
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const source = relativeDiagnosticPath(file.path, options.repoRoot)
    let actual: string
    try {
      actual = await readFile(file.path, "utf8")
    } catch {
      diagnostics.push(
        sortObjectKeys({
          code: "VOYANT_GRAPH_ARTIFACT_MISSING",
          severity: "error",
          source,
          facet: file.facet,
          message: `${source} is missing.`,
          ...(file.hint ? { hint: file.hint } : {}),
        }),
      )
      continue
    }

    if (actual !== file.expected) {
      diagnostics.push(
        sortObjectKeys({
          code: "VOYANT_GRAPH_ARTIFACT_STALE",
          severity: "error",
          source,
          facet: file.facet,
          message: `${source} is stale.`,
          ...(file.hint ? { hint: file.hint } : {}),
        }),
      )
    }
  }
  return sortDiagnostics(diagnostics)
}

export function buildDeploymentGraphDoctorReport(
  input: BuildDeploymentGraphDoctorReportInput,
): DeploymentGraphDoctorReport {
  const diagnostics = sortDiagnostics([...input.graph.diagnostics, ...(input.diagnostics ?? [])])
  return {
    schemaVersion: VOYANT_GRAPH_DOCTOR_REPORT_SCHEMA_VERSION,
    ok: diagnostics.filter((entry) => entry.severity === "error").length === 0,
    graph: {
      schemaVersion: input.graph.schemaVersion,
      contentHash: input.graph.contentHash,
      ...(input.graph.deployment.target ? { target: input.graph.deployment.target } : {}),
      ...(input.graph.deployment.mode ? { mode: input.graph.deployment.mode } : {}),
      modules: {
        count: input.graph.modules.length,
        ids: input.graph.modules.map((unit) => unit.id).sort(),
      },
      plugins: {
        count: input.graph.plugins.length,
        ids: input.graph.plugins.map((unit) => unit.id).sort(),
      },
      packageRecords: {
        count: input.graph.packageRecords.length,
        packageNames: input.graph.packageRecords.map((record) => record.packageName).sort(),
      },
    },
    diagnostics,
  }
}

export function buildDeploymentGraphDoctorJson(report: DeploymentGraphDoctorReport): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(report)), null, 2)}\n`
}

export function formatDeploymentGraphDoctorDiagnostics(
  diagnostics: readonly VoyantGraphDiagnostic[],
): string {
  return sortDiagnostics(diagnostics)
    .map((entry) => {
      const suffix = [
        entry.source ? `source=${entry.source}` : undefined,
        entry.facet ? `facet=${entry.facet}` : undefined,
      ]
        .filter(Boolean)
        .join(", ")
      return `  - ${entry.code}: ${entry.message}${suffix ? ` (${suffix})` : ""}`
    })
    .join("\n")
}

export function formatDeploymentGraphDoctorReport(report: DeploymentGraphDoctorReport): string {
  if (report.ok) {
    return `deployment graph doctor: OK (${report.graph.modules.count} modules, ${report.graph.plugins.count} plugins, ${report.graph.contentHash})`
  }
  return `Deployment graph doctor failed.\n${formatDeploymentGraphDoctorDiagnostics(report.diagnostics)}`
}

function relativeDiagnosticPath(filePath: string, repoRoot: string | undefined): string {
  if (!repoRoot) return filePath.replaceAll(path.sep, "/")
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/")
}

function sortDiagnostics(diagnostics: readonly VoyantGraphDiagnostic[]): VoyantGraphDiagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      (a.source ?? "").localeCompare(b.source ?? "") ||
      (a.facet ?? "").localeCompare(b.facet ?? "") ||
      a.message.localeCompare(b.message),
  )
}

function sortObjectKeys<T extends VoyantGraphDiagnostic>(diagnostic: T): T {
  return JSON.parse(canonicalJson(diagnostic)) as T
}
