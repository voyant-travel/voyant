/**
 * Assign one graph API bundle to every operation already registered by a
 * package-owned route tree. The helper is structural so runtime packages do
 * not need to import the build-time OpenAPI generator.
 */
export function stampOpenApiRegistryApiId<TRoutes>(routes: TRoutes, apiId: string): TRoutes {
  const registry = (routes as { openAPIRegistry?: unknown } | null)?.openAPIRegistry as
    | { definitions?: unknown[] }
    | undefined
  for (const definition of registry?.definitions ?? []) {
    if (!isOpenApiRouteDefinition(definition)) continue
    definition.route["x-voyant-api-id"] = apiId
  }
  return routes
}

function isOpenApiRouteDefinition(
  value: unknown,
): value is { type: "route"; route: Record<string, unknown> } {
  if (!value || typeof value !== "object") return false
  const definition = value as Record<string, unknown>
  return (
    definition.type === "route" &&
    typeof definition.route === "object" &&
    definition.route !== null &&
    !Array.isArray(definition.route)
  )
}
