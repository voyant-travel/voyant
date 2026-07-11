import { defineModule, requirePort } from "@voyant-travel/core/project"
import { realtimeRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the realtime package. */
export const realtimeVoyantModule = defineModule({
  id: "@voyant-travel/realtime",
  packageName: "@voyant-travel/realtime",
  localId: "realtime",
  provides: {
    ports: [{ id: "realtime.transport" }, { id: "realtime.admin-invalidation-publication" }],
  },
  runtimePorts: [requirePort(realtimeRuntimePort)],
  api: [
    {
      id: "@voyant-travel/realtime#api.admin",
      surface: "admin",
      mount: "realtime",
      openapi: { document: "realtime-admin" },
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/realtime#api.public",
      surface: "public",
      mount: "realtime",
      openapi: { document: "realtime-public" },
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeVoyantRuntime",
      },
    },
  ],
  providers: [
    {
      id: "@voyant-travel/realtime#provider.local",
      port: "realtime.transport",
      runtime: {
        entry: "@voyant-travel/realtime/providers/local",
        export: "createLocalRealtimeProvider",
      },
    },
    {
      id: "@voyant-travel/realtime#provider.voyant-cloud",
      port: "realtime.transport",
      runtime: {
        entry: "@voyant-travel/realtime/providers/voyant-cloud",
        export: "createVoyantCloudRealtimeProvider",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default realtimeVoyantModule
