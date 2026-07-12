export const VOYANT_GRAPH_OPENAPI_COVERAGE_REPORT_SCHEMA_VERSION =
  "voyant.graph-openapi-coverage-report.v1"

export function buildDeploymentGraphOpenApiCoverageReport(input, relativePath) {
  const bundleSummary = (bundle) => ({
    id: bundle.apiId,
    graphSurface: bundle.graphSurface,
    surface: bundle.surface,
    moduleId: bundle.moduleId,
    localId: bundle.localId,
    packageName: bundle.packageName,
    mount: bundle.mount,
    ...(bundle.openapiDocument ? { openapiDocument: bundle.openapiDocument } : {}),
    candidateModules: [...bundle.candidateModules].sort(),
  })
  const sortedBundles = (bundles) =>
    [...bundles].sort((left, right) => left.apiId.localeCompare(right.apiId))
  const diagnostics = input.failures
    .map((failure) => {
      if (failure.kind === "authority-regression") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_AUTHORITY_REGRESSION",
          severity: "error",
          actual: failure.actual,
          minimum: failure.minimum,
          message: `Selected graph owns ${failure.actual} OpenAPI documents; expected at least ${failure.minimum}.`,
        }
      }
      if (failure.kind === "missing-docs") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_MISSING_DOCS",
          severity: "error",
          ...bundleSummary(failure.bundle),
          message: `No documented OpenAPI paths match ${failure.bundle.apiId}.`,
        }
      }
      if (failure.bundle) {
        return {
          code: "VOYANT_GRAPH_OPENAPI_STALE_ALLOWLIST",
          severity: "error",
          ...bundleSummary(failure.bundle),
          message: `${failure.bundle.apiId} is allowlisted but now has documented OpenAPI paths.`,
        }
      }
      return {
        code: "VOYANT_GRAPH_OPENAPI_STALE_ALLOWLIST",
        severity: "error",
        id: failure.apiId,
        message: `${failure.apiId} is allowlisted but no longer appears in the deployment graph.`,
      }
    })
    .sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""))

  return {
    schemaVersion: VOYANT_GRAPH_OPENAPI_COVERAGE_REPORT_SCHEMA_VERSION,
    ok: diagnostics.length === 0,
    graph: {
      path: relativePath(input.graphPath),
      ...(typeof input.graph.schemaVersion === "string"
        ? { schemaVersion: input.graph.schemaVersion }
        : {}),
      ...(typeof input.graph.contentHash === "string"
        ? { contentHash: input.graph.contentHash }
        : {}),
    },
    openapi: {
      directory: relativePath(input.openapiDir),
      documents: [...input.docs.files].sort(),
      documentedSurfaceModules: input.docs.keys.size,
    },
    bundles: {
      covered: sortedBundles(input.coveredBundles).map(bundleSummary),
      allowlistedGaps: [...input.allowlistedGaps]
        .sort((left, right) => left.bundle.apiId.localeCompare(right.bundle.apiId))
        .map(({ bundle, reason }) => ({ ...bundleSummary(bundle), reason })),
      missingDocs: input.failures
        .filter((failure) => failure.kind === "missing-docs")
        .map((failure) => bundleSummary(failure.bundle))
        .sort((left, right) => left.id.localeCompare(right.id)),
    },
    diagnostics,
  }
}

export function formatDeploymentGraphOpenApiCoverageFailure(failure) {
  if (failure.kind === "authority-regression") {
    return `[deployment-graph-openapi-coverage:authority-regression] selected graph owns ${failure.actual} OpenAPI documents; expected at least ${failure.minimum}`
  }
  if (failure.kind === "missing-docs") return formatGap(failure.bundle)
  if (failure.bundle) {
    return `[deployment-graph-openapi-coverage:stale-allowlist] ${failure.bundle.apiId} is allowlisted but now has documented ${failure.bundle.surface} paths for one of: ${failure.bundle.candidateModules.join(", ")}`
  }
  return `[deployment-graph-openapi-coverage:stale-allowlist] ${failure.apiId} is allowlisted but no longer appears in the deployment graph`
}

function formatGap(bundle) {
  return `  - [deployment-graph-openapi-coverage:missing-docs] ${bundle.apiId} (${bundle.graphSurface} -> ${bundle.surface}, ${bundle.localId || bundle.moduleId}) has no documented OpenAPI paths for candidates: ${bundle.candidateModules.join(", ")}.`
}
