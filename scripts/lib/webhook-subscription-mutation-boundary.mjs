const PACKAGE_MUTATION_BOUNDARY = "packages/webhook-delivery/src/postgres-store.ts"
const TABLE_EXPORT = "infraWebhookSubscriptionsTable"

export function inspectWebhookSubscriptionMutationBoundary(files) {
  const failures = []

  for (const file of files) {
    const relativePath = normalizePath(file.path)
    if (relativePath === PACKAGE_MUTATION_BOUNDARY) continue

    const tableReferences = subscriptionTableReferences(file.source)
    const operation = findMutation(file.source, tableReferences)
    if (operation) {
      failures.push(
        `webhook subscription ${operation} bypasses the package-owned service: ${relativePath}`,
      )
    }
  }

  return failures
}

function subscriptionTableReferences(source) {
  const references = new Set([TABLE_EXPORT])
  const aliasPattern = new RegExp(`\\b${TABLE_EXPORT}\\s+as\\s+([A-Za-z_$][\\w$]*)`, "g")

  for (const match of source.matchAll(aliasPattern)) {
    references.add(match[1])
  }

  return references
}

function findMutation(source, tableReferences) {
  for (const operation of ["insert", "update", "delete"]) {
    for (const reference of tableReferences) {
      const tableExpression = `(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?${escapeRegExp(reference)}`
      const pattern = new RegExp(`\\.\\s*${operation}\\s*\\(\\s*${tableExpression}\\s*\\)`)
      if (pattern.test(source)) return operation
    }
  }

  return null
}

function normalizePath(file) {
  return file.replaceAll("\\\\", "/").replace(/^\.\//, "")
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
