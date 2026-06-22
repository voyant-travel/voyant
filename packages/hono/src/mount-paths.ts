/**
 * Resolve a route family's mount path under a surface prefix (`/v1/admin`,
 * `/v1/public`). `path` is the optional `publicPath` override: empty →
 * `{prefix}/{fallback}` (the module/extension name); `"/"` → the surface root
 * (`prefix`); otherwise `{prefix}/{trimmed path}`.
 *
 * Shared by the route mounting in `app.ts` and the anonymous-path assembly in
 * `anonymous-paths.ts` so both compute the same mount.
 */
export function resolveSurfaceMountPath(
  prefix: string,
  path: string | undefined,
  fallback: string,
): string {
  const normalized = path?.trim()

  if (!normalized) {
    return `${prefix}/${fallback}`
  }

  if (normalized === "/") {
    return prefix
  }

  return `${prefix}/${normalized.replace(/^\/+|\/+$/g, "")}`
}
