import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the flights demo plugin. */
export const flightsDemoVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-flights-demo",
  packageName: "@voyant-travel/plugin-flights-demo",
  localId: "plugin-flights-demo",
  provides: {
    ports: [{ id: "flights.connector-adapter" }],
  },
  config: [
    {
      id: "@voyant-travel/plugin-flights-demo#config.base-url",
      key: "baseUrl",
      required: true,
    },
  ],
  resources: [
    {
      id: "@voyant-travel/plugin-flights-demo#resource.api",
      kind: "http-service",
      required: true,
      config: { service: "flights-demo-api" },
    },
  ],
  providers: [
    {
      id: "@voyant-travel/plugin-flights-demo#provider.connector-adapter",
      port: "flights.connector-adapter",
      runtime: {
        entry: "@voyant-travel/plugin-flights-demo",
        export: "createDemoFlightAdapter",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default flightsDemoVoyantPlugin
