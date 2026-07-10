import { defineModule } from "@voyant-travel/framework/project"

export const invitationsVoyantModule = defineModule({
  id: "@voyant-travel/operator#invitations",
  packageName: "@voyant-travel/operator",
  localId: "operator.invitations",
  api: [
    {
      id: "@voyant-travel/operator#invitations.api.admin",
      surface: "admin",
      mount: "operator/invitations",
    },
    {
      id: "@voyant-travel/operator#invitations.api.public",
      surface: "public",
      mount: "operator/invitations",
      anonymous: true,
    },
  ],
  meta: { source: "operator-local" },
})

export default invitationsVoyantModule
