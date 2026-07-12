export function findProductionDependencyCycles(manifests) {
  const workspaceNames = new Set(manifests.map((manifest) => manifest.name))
  const edges = new Map(
    manifests.map((manifest) => [
      manifest.name,
      Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).filter((name) =>
        workspaceNames.has(name),
      ),
    ]),
  )
  const visiting = new Set()
  const visited = new Set()
  const stack = []
  const cycles = []

  function visit(packageName) {
    if (visited.has(packageName)) return
    if (visiting.has(packageName)) {
      const start = stack.indexOf(packageName)
      cycles.push([...stack.slice(start), packageName])
      return
    }
    visiting.add(packageName)
    stack.push(packageName)
    for (const dependency of edges.get(packageName) ?? []) visit(dependency)
    stack.pop()
    visiting.delete(packageName)
    visited.add(packageName)
  }

  for (const packageName of edges.keys()) visit(packageName)
  return cycles
}

export function adapterBoundaryViolations(manifests, adapters) {
  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]))
  const adapterNames = new Set(adapters.map(({ packageName }) => packageName))
  const violations = []
  for (const { packageName, domainPackageNames } of adapters) {
    const adapter = byName.get(packageName)
    if (!adapter) {
      violations.push(`missing adapter package ${packageName}`)
      continue
    }
    const dependencies = adapter.dependencies ?? {}
    for (const domainPackageName of domainPackageNames) {
      if (!dependencies[domainPackageName]) {
        violations.push(`${packageName} must declare ${domainPackageName}`)
      }
    }
  }
  for (const manifest of manifests) {
    if (
      adapterNames.has(manifest.name) ||
      manifest.name === "@voyant-travel/framework" ||
      manifest.private
    ) {
      continue
    }
    for (const adapterName of adapterNames) {
      if (manifest.dependencies?.[adapterName] || manifest.optionalDependencies?.[adapterName]) {
        violations.push(`${manifest.name} must not depend on leaf adapter ${adapterName}`)
      }
    }
  }
  return violations
}
