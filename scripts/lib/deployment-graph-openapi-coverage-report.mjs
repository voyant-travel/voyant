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
          message: `Selected graph owns ${failure.actual} OpenAPI API bundles; expected at least ${failure.minimum}.`,
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
      if (failure.kind === "unknown-docs") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_UNKNOWN_AUTHORITY",
          severity: "error",
          id: failure.apiId,
          files: failure.files,
          message: `${failure.apiId} is documented but is not selected by the deployment graph.`,
        }
      }
      if (failure.kind === "mismatched-docs") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_MISMATCHED_AUTHORITY",
          severity: "error",
          id: failure.apiId,
          expected: failure.expected,
          files: failure.files,
          message: `${failure.apiId} is stamped into an artifact outside its manifest document claim.`,
        }
      }
      if (failure.kind === "unknown-document") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_UNKNOWN_DOCUMENT",
          severity: "error",
          id: failure.document,
          files: failure.files,
          message: `${failure.document} has no selected graph document claim.`,
        }
      }
      if (failure.kind === "duplicate-docs") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_DUPLICATE_AUTHORITY",
          severity: "error",
          id: failure.apiId,
          files: failure.files,
          message: `${failure.apiId} is documented by multiple artifacts.`,
        }
      }
      if (failure.kind === "duplicate-document-owner") {
        return {
          code: "VOYANT_GRAPH_OPENAPI_DUPLICATE_DOCUMENT_OWNER",
          severity: "error",
          id: failure.document,
          owners: failure.owners,
          message: `${failure.document} is owned by multiple packages.`,
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
    return `[deployment-graph-openapi-coverage:authority-regression] selected graph owns ${failure.actual} OpenAPI API bundles; expected at least ${failure.minimum}`
  }
  if (failure.kind === "missing-docs") return formatGap(failure.bundle)
  if (failure.kind === "unknown-docs") {
    return `[deployment-graph-openapi-coverage:unknown-authority] ${failure.apiId} is documented by ${failure.files.join(", ")} but is absent from the selected graph`
  }
  if (failure.kind === "mismatched-docs") {
    return `[deployment-graph-openapi-coverage:mismatched-authority] ${failure.apiId} expected ${failure.expected} but is stamped into ${failure.files.join(", ")}`
  }
  if (failure.kind === "unknown-document") {
    return `[deployment-graph-openapi-coverage:unknown-document] ${failure.document} has no selected graph claim: ${failure.files.join(", ")}`
  }
  if (failure.kind === "duplicate-docs") {
    return `[deployment-graph-openapi-coverage:duplicate-authority] ${failure.apiId} is documented by multiple artifacts: ${failure.files.join(", ")}`
  }
  if (failure.kind === "duplicate-document-owner") {
    return `[deployment-graph-openapi-coverage:duplicate-document-owner] ${failure.document} is owned by multiple packages: ${failure.owners.join(", ")}`
  }
  if (failure.bundle) {
    return `[deployment-graph-openapi-coverage:stale-allowlist] ${failure.bundle.apiId} is allowlisted but now has documented ${failure.bundle.surface} paths for one of: ${failure.bundle.candidateModules.join(", ")}`
  }
  return `[deployment-graph-openapi-coverage:stale-allowlist] ${failure.apiId} is allowlisted but no longer appears in the deployment graph`
}

function formatGap(bundle) {
  return `  - [deployment-graph-openapi-coverage:missing-docs] ${bundle.apiId} (${bundle.graphSurface} -> ${bundle.surface}, ${bundle.localId || bundle.moduleId}) has no documented OpenAPI paths for candidates: ${bundle.candidateModules.join(", ")}.`
}
