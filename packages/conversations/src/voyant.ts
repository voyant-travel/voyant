import { defineModule, requirePort } from "@voyant-travel/core/project"
import {
  conversationIngressSourcePort,
  conversationsDatabaseRuntimePort,
  conversationsPersonDirectoryPort,
  conversationsRenderedMessageAdmissionPort,
} from "./runtime-port.js"

const apiRuntime = {
  entry: "@voyant-travel/conversations",
  export: "createConversationsVoyantRuntime",
} as const
const adminRuntime = {
  entry: "@voyant-travel/conversations-react/admin",
  export: "createSelectedConversationsAdminExtension",
} as const

export const conversationsVoyantModule = defineModule({
  id: "@voyant-travel/conversations",
  packageName: "@voyant-travel/conversations",
  localId: "conversations",
  runtimePorts: [
    requirePort(conversationsDatabaseRuntimePort),
    requirePort(conversationIngressSourcePort, { optional: true, cardinality: "many" }),
    requirePort(conversationsRenderedMessageAdmissionPort, { optional: true }),
    requirePort(conversationsPersonDirectoryPort, { optional: true }),
  ],
  api: [
    {
      id: "@voyant-travel/conversations#api.admin",
      surface: "admin",
      mount: "conversations",
      resource: "conversations",
      transactional: true,
      openapi: { document: "conversations" },
      runtime: apiRuntime,
    },
  ],
  schema: [
    { id: "@voyant-travel/conversations#schema", source: "@voyant-travel/conversations/schema" },
  ],
  migrations: [{ id: "@voyant-travel/conversations#migrations", source: "./migrations" }],
  jobs: [
    {
      id: "conversations.ingress",
      schedule: { cron: "* * * * *", overlap: "skip" },
      scheduling: {
        required: true,
        profiles: {
          eager: { cron: "* * * * *", overlap: "skip" },
          economical: { cron: "*/5 * * * *", overlap: "skip" },
          "scale-to-zero": { cron: "*/15 * * * *", overlap: "skip" },
        },
      },
      wakeup: true,
      runtime: {
        entry: "@voyant-travel/conversations/ingress-job",
        export: "runConversationIngressJob",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/conversations#access.conversations",
        resource: "conversations",
        label: "Inbox",
        description: "Read and reply to customer conversations.",
        actions: [
          {
            action: "read",
            label: "View conversations",
            description: "View Inbox conversations and messages.",
          },
          {
            action: "write",
            label: "Manage conversations",
            description: "Reply, start, close, and snooze conversations.",
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 35,
    runtime: adminRuntime,
    routes: [
      {
        id: "@voyant-travel/conversations#admin.route.inbox",
        path: "/inbox",
        runtime: adminRuntime,
      },
    ],
  },
  lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale: "The first Inbox slice is staff-operated through admin routes.",
    },
  },
})

export default conversationsVoyantModule
