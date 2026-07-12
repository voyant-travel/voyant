const requiredFacets = [
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

export function inspectGraphLifecycleAuthority(files) {
  const failures = []
  const lifecycle = files.get("packages/framework/src/graph-lifecycle.ts") ?? ""
  const frameworkIndex = files.get("packages/framework/src/index.ts") ?? ""
  const facets = files.get("packages/core/src/project-facets.ts") ?? ""

  requireToken(lifecycle, "consequences: readonly VoyantGraphLifecycleConsequence[]", failures)
  requireToken(lifecycle, 'action: "detach" | "activate" | "retain-data" | "release"', failures)
  requireToken(lifecycle, "unitFacetEntities(unit)", failures)
  requireToken(lifecycle, "retainedDataConsequences(input.operation, unit)", failures)
  requireToken(lifecycle, "cleanup.on.includes(input.operation)", failures)
  requireToken(lifecycle, "packageRecordsByName(input.previous)", failures)
  requireToken(frameworkIndex, "VoyantGraphLifecycleConsequence", failures)
  requireToken(frameworkIndex, "VoyantGraphLifecycleFacet", failures)
  requireToken(
    lifecycle,
    'kind: "migrate-graph" | "detach-unit" | "release-resource" | "activate-unit"',
    failures,
  )

  for (const facet of requiredFacets) {
    if (!lifecycle.includes(`"${facet}"`)) {
      failures.push(`Lifecycle consequence ledger does not account for the ${facet} facet`)
    }
  }

  for (const hook of ["onInstall", "onUpgrade", "onUninstall"]) {
    if (new RegExp(`\\b${hook}\\b`).test(`${lifecycle}\n${facets}`)) {
      failures.push(`Opaque lifecycle hook ${hook} must not be part of graph lifecycle authority`)
    }
  }
  if (!facets.includes('default: "retain-data"')) {
    failures.push("Package lifecycle declarations must preserve retain-data uninstall semantics")
  }
  if (!facets.includes('action: "release"')) {
    failures.push("Package cleanup declarations must remain explicit release-only metadata")
  }
  return failures
}

function requireToken(source, token, failures) {
  if (!source.includes(token)) failures.push(`Lifecycle authority is missing ${token}`)
}
