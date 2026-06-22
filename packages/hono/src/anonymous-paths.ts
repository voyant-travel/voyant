import type { HonoExtension, HonoModule } from "./module.js"
import { resolveSurfaceMountPath } from "./mount-paths.js"

/**
 * Assemble the anonymous-access allow-list (ADR-0008) from module/extension
 * `anonymous` declarations, unioned with any explicit `publicPaths` the
 * deployment still passes (the escape hatch — e.g. plugin/webhook routes that
 * aren't owned by a module, like a payment-processor callback).
 *
 * For each declaring unit the public mount is `resolveSurfaceMountPath` of its
 * `publicPath`/name under `/v1/public`. `anonymous: true` opens the whole mount;
 * a string array opens specific sub-paths relative to it. Pure and sorted for a
 * deterministic, snapshot-auditable result; the global list is what `requireAuth`
 * matches to skip auth (and stamp `actor: "customer"`).
 */
export function assembleAnonymousPaths(
  modules: readonly HonoModule[],
  extensions: readonly HonoExtension[],
  explicit: readonly string[] = [],
): string[] {
  const paths = new Set<string>(explicit)

  const add = (mount: string, anonymous: boolean | readonly string[] | undefined): void => {
    if (!anonymous) return
    if (anonymous === true) {
      paths.add(mount)
      return
    }
    for (const sub of anonymous) {
      const trimmed = sub.trim().replace(/^\/+|\/+$/g, "")
      paths.add(trimmed ? `${mount}/${trimmed}` : mount)
    }
  }

  for (const m of modules) {
    add(resolveSurfaceMountPath("/v1/public", m.publicPath, m.module.name), m.anonymous)
  }
  for (const e of extensions) {
    add(resolveSurfaceMountPath("/v1/public", e.publicPath, e.extension.module), e.anonymous)
  }

  return [...paths].sort()
}
