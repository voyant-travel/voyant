import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the catalog demo plugin. */
export const catalogDemoVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-catalog-demo",
  packageName: "@voyant-travel/plugin-catalog-demo",
  localId: "plugin-catalog-demo",
  provides: {
    ports: [{ id: "catalog.source-adapter" }],
  },
  config: [
    {
      id: "@voyant-travel/plugin-catalog-demo#config.base-url",
      key: "baseUrl",
      required: true,
    },
    {
      id: "@voyant-travel/plugin-catalog-demo#config.verticals",
      key: "verticals",
      default: ["products"],
    },
    {
      id: "@voyant-travel/plugin-catalog-demo#config.timeout-ms",
      key: "timeoutMs",
      default: 8000,
    },
  ],
  resources: [
    {
      id: "@voyant-travel/plugin-catalog-demo#resource.api",
      kind: "http-service",
      required: true,
      config: { service: "catalog-demo-api" },
    },
  ],
  providers: [
    {
      id: "@voyant-travel/plugin-catalog-demo#provider.source-adapter",
      port: "catalog.source-adapter",
      runtime: {
        entry: "@voyant-travel/plugin-catalog-demo",
        export: "createDemoCatalogAdapter",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default catalogDemoVoyantPlugin
