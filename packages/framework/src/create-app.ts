import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import type {
  CompositionRegistry,
  ExtensionFactory,
  ModuleFactory,
} from "@voyant-travel/hono/composition"

/**
 * Config for {@link createVoyantApp}: the deployment-local resources and
 * additions, plus everything else `createApp` takes (db, auth, workflows,
 * outbox, publicPaths, …) — minus the `manifest`/`registry`/`capabilities` the
 * framework now assembles for you.
 */
export interface CreateVoyantAppConfig<TBindings extends VoyantBindings, TResources>
  extends Omit<CreateAppConfig<TBindings, TResources>, "manifest" | "registry" | "capabilities"> {
  /** Capabilities passed only to the explicitly supplied local factories. */
  resources: TResources
  /** Explicit module factories. Standard product units come from the generated graph runtime. */
  modules?: Record<string, ModuleFactory<TResources>>
  /** Explicit extension factories. */
  extensions?: Record<string, ExtensionFactory<TResources>>
}

/** Compose only explicitly supplied factories through the generic Hono machinery. */
export function createVoyantApp<TBindings extends VoyantBindings, TResources>(
  config: CreateVoyantAppConfig<TBindings, TResources>,
) {
  const { resources, modules = {}, extensions = {}, ...rest } = config

  const registry: CompositionRegistry<TResources> = {
    modules,
    extensions,
  }

  return createApp<TBindings, TResources>({
    ...rest,
    manifest: {
      modules: Object.keys(modules),
      extensions: Object.keys(extensions),
    },
    registry,
    capabilities: resources,
  } as CreateAppConfig<TBindings, TResources>)
}
