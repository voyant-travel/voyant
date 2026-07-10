import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the realtime package. */
export const realtimeVoyantModule = defineModule({
  id: "@voyant-travel/realtime",
  packageName: "@voyant-travel/realtime",
  localId: "realtime",
  provides: {
    ports: [{ id: "realtime.transport" }],
  },
  api: [
    {
      id: "@voyant-travel/realtime#api.admin",
      surface: "admin",
      mount: "realtime",
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeHonoModule",
      },
    },
    {
      id: "@voyant-travel/realtime#api.public",
      surface: "public",
      mount: "realtime",
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeHonoModule",
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
