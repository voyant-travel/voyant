import { hooks } from "./hooks.js"
import type { Extension, Module } from "./module.js"

export interface RegistryOptions {
  modules?: Module[]
  extensions?: Extension[]
}

/**
 * Register module and extension hooks without binding them to the server API
 * runtime.
 *
 * The API runtime consumes the returned modules and extensions separately.
 */
export function createRegistry(options: RegistryOptions = {}) {
  const modules = options.modules ?? []
  const extensions = options.extensions ?? []

  for (const mod of modules) {
    if (mod.hooks) {
      for (const [event, handler] of Object.entries(mod.hooks)) {
        hooks.on(event, handler)
      }
    }
  }

  for (const ext of extensions) {
    if (ext.hooks) {
      for (const [event, handler] of Object.entries(ext.hooks)) {
        hooks.on(event, handler)
      }
    }
  }

  return {
    modules,
    extensions,
  }
}
