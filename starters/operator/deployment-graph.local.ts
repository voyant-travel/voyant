import {
  childGraphEntityId,
  defineModule,
  definePlugin,
  graphIdFromSpecifier,
  packageNameFromSpecifier,
  type VoyantGraphRouteSurface,
  type VoyantGraphUnitManifest,
} from "../../packages/framework/src/deployment-graph.ts"
import { moduleIdFromSpecifier } from "../../packages/framework/src/profile-types.ts"

export const OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS = [
  "operator/invitations",
  "operator/team",
  "operator/cruises",
  "operator/charters",
  "operator/realtime",
  "@voyant-travel/mice",
] as const

export const OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_SPECIFIERS = [
  "@voyant-travel/mice/booking-extension",
] as const

export const OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS = [
  "@voyant-travel/db",
  "@voyant-travel/availability",
  "@voyant-travel/storefront",
  "@voyant-travel/catalog-authoring",
  "@voyant-travel/workflow-runs",
  "@voyant-travel/charters",
  "@voyant-travel/cruises",
] as const

export const OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_IDS =
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS.map(graphIdFromSpecifier)

export const OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_IDS =
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_SPECIFIERS.map(graphIdFromSpecifier)

export const OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_IDS =
  OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS.map(graphIdFromSpecifier)

export const OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST = {
  modules: [
    localModule("operator/invitations", [
      { surface: "admin" },
      { surface: "public", anonymous: true },
    ]),
    localModule("operator/team", [{ surface: "admin" }]),
    localModule("operator/cruises", [{ surface: "admin" }, { surface: "public", anonymous: true }]),
    localModule("operator/charters", [
      { surface: "admin" },
      { surface: "public", anonymous: true },
    ]),
    localModule("operator/realtime", [{ surface: "admin" }, { surface: "public" }]),
    localModule("@voyant-travel/mice", [{ surface: "admin" }]),
  ],
  plugins: [localPlugin("@voyant-travel/mice/booking-extension", [{ surface: "admin" }])],
} satisfies {
  modules: readonly VoyantGraphUnitManifest[]
  plugins: readonly VoyantGraphUnitManifest[]
}

export const OPERATOR_SCHEMA_DEPLOYMENT_GRAPH_MANIFEST = {
  modules: OPERATOR_SCHEMA_ONLY_DEPLOYMENT_GRAPH_MODULE_SPECIFIERS.map(schemaOnlyModule),
} satisfies {
  modules: readonly VoyantGraphUnitManifest[]
}

function localModule(
  specifier: string,
  api: readonly { surface: VoyantGraphRouteSurface; anonymous?: boolean }[],
): VoyantGraphUnitManifest {
  const id = graphIdFromSpecifier(specifier)
  return defineModule({
    id,
    packageName: packageNameFromSpecifier(specifier),
    localId: moduleIdFromSpecifier(specifier),
    api: routeBundles(id, specifier, api),
    meta: { source: "operator-local" },
  })
}

function localPlugin(
  specifier: string,
  api: readonly { surface: VoyantGraphRouteSurface; anonymous?: boolean }[],
): VoyantGraphUnitManifest {
  const id = graphIdFromSpecifier(specifier)
  return definePlugin({
    id,
    packageName: packageNameFromSpecifier(specifier),
    localId: moduleIdFromSpecifier(specifier),
    api: routeBundles(id, specifier, api),
    meta: { source: "operator-local" },
  })
}

function schemaOnlyModule(specifier: string): VoyantGraphUnitManifest {
  const id = graphIdFromSpecifier(specifier)
  return defineModule({
    id,
    packageName: packageNameFromSpecifier(specifier),
    localId: moduleIdFromSpecifier(specifier),
    schema: [{ id: childGraphEntityId(id, "schema") }],
    migrations: [{ id: childGraphEntityId(id, "migrations") }],
    meta: { source: "operator-schema-only" },
  })
}

function routeBundles(
  graphId: string,
  specifier: string,
  api: readonly { surface: VoyantGraphRouteSurface; anonymous?: boolean }[],
): VoyantGraphUnitManifest["api"] {
  return api.map((route) => ({
    id: childGraphEntityId(graphId, `api.${route.surface}`),
    surface: route.surface,
    mount: specifier,
    ...(route.anonymous ? { anonymous: true } : {}),
  }))
}
