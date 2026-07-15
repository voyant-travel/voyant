import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import type {
  CompositionRegistry,
  ExtensionFactory,
  ModuleFactory,
} from "@voyant-travel/hono/composition"

/**
 * Deprecated compatibility marker for deployment capability containers.
 * Product packages own their provider types through declared runtime ports.
 */
export type FrameworkProviders = Record<never, never>

/**
 * Config for {@link createVoyantApp}: the injected providers + deployment-local
 * additions, plus everything else `createApp` takes (db, auth, workflows,
 * outbox, publicPaths, …) — minus the `manifest`/`registry`/`capabilities` the
 * framework now assembles for you.
 */
export interface CreateVoyantAppConfig<TBindings extends VoyantBindings, TProviders>
  extends Omit<CreateAppConfig<TBindings, TProviders>, "manifest" | "registry" | "capabilities"> {
  /** Capabilities passed only to the explicitly supplied local factories. */
  providers: TProviders
  /** Explicit module factories. Standard product units come from the generated graph runtime. */
  modules?: Record<string, ModuleFactory<TProviders>>
  /** Explicit extension factories. */
  extensions?: Record<string, ExtensionFactory<TProviders>>
}

/** Compose only explicitly supplied factories through the shared API runtime. */
export function createVoyantApp<TBindings extends VoyantBindings, TProviders>(
  config: CreateVoyantAppConfig<TBindings, TProviders>,
) {
  const { providers, modules = {}, extensions = {}, ...rest } = config

  const registry: CompositionRegistry<TProviders> = {
    modules,
    extensions,
  }

  return createApp<TBindings, TProviders>({
    ...rest,
    manifest: {
      modules: Object.keys(modules),
      extensions: Object.keys(extensions),
    },
    registry,
    capabilities: providers,
  } as CreateAppConfig<TBindings, TProviders>)
}
