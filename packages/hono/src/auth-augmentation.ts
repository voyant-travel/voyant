import type { ApiModule } from "./module.js"
import type { VoyantAuthIntegration, VoyantBindings } from "./types.js"

/** Compose trusted package app-token resolvers while preserving host auth. */
export function composeAuthAugmentations<TBindings extends VoyantBindings>(
  hostAuth: VoyantAuthIntegration<TBindings> | undefined,
  modules: readonly ApiModule[],
): VoyantAuthIntegration<TBindings> | undefined {
  const packageResolvers = modules.flatMap((module) =>
    module.authAugmentation ? [module.authAugmentation.resolveAppToken] : [],
  )
  if (packageResolvers.length === 0) return hostAuth

  const hostResolver = hostAuth?.resolveAppToken
  return {
    ...hostAuth,
    resolveAppToken: async (args) => {
      const hostResult = await hostResolver?.(args)
      if (hostResult) return hostResult

      for (const resolve of packageResolvers) {
        const result = await resolve(args)
        if (result) return result
      }
      return null
    },
  }
}
