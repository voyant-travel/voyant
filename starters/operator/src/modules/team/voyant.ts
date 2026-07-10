import { defineModule } from "@voyant-travel/framework/project"

export const teamVoyantModule = defineModule({
  id: "@voyant-travel/operator#team",
  packageName: "@voyant-travel/operator",
  localId: "operator.team",
  api: [
    {
      id: "@voyant-travel/operator#team.api.admin",
      surface: "admin",
      mount: "operator/team",
    },
  ],
  meta: { source: "operator-local" },
})

export default teamVoyantModule
