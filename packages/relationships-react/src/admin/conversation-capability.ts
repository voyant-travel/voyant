export interface ConversationDeploymentCapabilities {
  modules: readonly string[]
  operations: readonly { method: string; pathTemplate: string; scopes: readonly string[] }[]
  scopes?: readonly string[]
}

/** Fail-closed gate for the cross-module Person composer. */
export function canStartPersonConversation(
  capabilities: ConversationDeploymentCapabilities | undefined,
): boolean {
  if (!capabilities) return false
  const moduleActive = capabilities.modules.some(
    (moduleId) => moduleId === "conversations" || moduleId === "@voyant-travel/conversations",
  )
  if (!moduleActive) return false
  const operation = capabilities.operations.find(
    ({ method, pathTemplate }) =>
      method.toUpperCase() === "POST" && pathTemplate === "/v1/admin/conversations",
  )
  if (!operation?.scopes.includes("conversations:write")) return false
  if (capabilities.scopes) {
    return capabilities.scopes.includes("*") || capabilities.scopes.includes("conversations:write")
  }
  return true
}
