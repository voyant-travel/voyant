import {
  defineProject,
  generateFrameworkModuleManifests,
  generateFrameworkPluginManifests,
} from "../../packages/framework/src/deployment-graph.ts"
import { FRAMEWORK_RUNTIME_MANIFEST } from "../../packages/framework/src/manifest.ts"
import {
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST,
  OPERATOR_RUNTIME_DEPLOYMENT_GRAPH_PLUGIN_SPECIFIERS,
  OPERATOR_SCHEMA_DEPLOYMENT_GRAPH_MANIFEST,
} from "./deployment-graph.local.ts"

const CUSTOMER_APP_MODULE_SPECIFIERS = new Set([
  "@voyant-travel/storefront",
  "@voyant-travel/storefront/customer-portal",
  "@voyant-travel/storefront/verification",
])

export const OPERATOR_STANDARD_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS =
  FRAMEWORK_RUNTIME_MANIFEST.modules.filter(
    (specifier) => !CUSTOMER_APP_MODULE_SPECIFIERS.has(specifier),
  )

export const OPERATOR_COMPATIBILITY_BRIDGE_MODULE_SPECIFIERS = [
  "@voyant-travel/charters",
  "@voyant-travel/cruises",
  "@voyant-travel/realtime",
  "@voyant-travel/mice",
] as const

export const OPERATOR_COMPATIBILITY_BRIDGE_PLUGIN_SPECIFIERS = [
  "@voyant-travel/mice/booking-extension",
] as const

export const OPERATOR_VOYANT_PROJECT = defineProject({
  presetLineage: "operator-standard",
  modules: [
    ...generateFrameworkModuleManifests(OPERATOR_STANDARD_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS),
    ...generateFrameworkModuleManifests(OPERATOR_COMPATIBILITY_BRIDGE_MODULE_SPECIFIERS),
    ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST.modules,
    ...OPERATOR_SCHEMA_DEPLOYMENT_GRAPH_MANIFEST.modules,
  ],
  plugins: [
    ...generateFrameworkPluginManifests(),
    ...generateFrameworkPluginManifests(OPERATOR_COMPATIBILITY_BRIDGE_PLUGIN_SPECIFIERS),
    ...generateFrameworkPluginManifests(OPERATOR_RUNTIME_DEPLOYMENT_GRAPH_PLUGIN_SPECIFIERS),
    ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST.plugins,
  ],
})
