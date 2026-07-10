import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the realtime package. */
export const realtimeVoyantModule = defineModule({
  id: "@voyant-travel/realtime",
  packageName: "@voyant-travel/realtime",
  localId: "realtime",
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
  meta: {
    ownership: "package",
  },
})

export default realtimeVoyantModule
