import { mountApp } from "./app.js"
import {
  type CompositionManifest,
  type CompositionRegistry,
  composeFromManifest,
} from "./composition.js"
import type { VoyantAppConfig, VoyantBindings } from "./types.js"

/**
 * Config-driven app config: the manifest + registry + capabilities replace the
 * resolved `modules`/`extensions` of {@link VoyantAppConfig}. Everything else
 * (db surfaces, auth, plugins, publicPaths, …) is unchanged.
 */
export interface CreateAppConfig<TBindings extends VoyantBindings, TCapabilities>
  extends Omit<VoyantAppConfig<TBindings>, "modules" | "extensions"> {
  /** Ordered module/extension manifest. */
  manifest: CompositionManifest
  /** Maps each manifest entry to its factory. */
  registry: CompositionRegistry<TCapabilities>
  /** Deployment capabilities passed to every registry factory. */
  capabilities: TCapabilities
}

/**
 * The low-level config-driven front door. Derives the module/extension set from
 * an explicit manifest + registry + capabilities, then mounts the app — instead
 * of `composeFromManifest(...)` followed by `mountApp(...)`:
 *
 *     export const app = createApp<CloudflareBindings, Providers>({
 *       manifest: runtimeManifest,
 *       registry: composition,
 *       capabilities: buildProviders(),
 *       db, auth, plugins, ...
 *     })
 *
 * Framework callers may use `createVoyantApp({ providers, modules })` for an
 * explicit local registry. Standard product units are composed from the
 * generated deployment graph instead of this registry path.
 */
export function createApp<TBindings extends VoyantBindings, TCapabilities>(
  config: CreateAppConfig<TBindings, TCapabilities>,
) {
  const { manifest, registry, capabilities, ...rest } = config
  const { modules, extensions } = composeFromManifest(manifest, registry, capabilities)
  return mountApp<TBindings>({ ...rest, modules, extensions } as VoyantAppConfig<TBindings>)
}
