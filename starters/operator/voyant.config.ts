import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  access: {
    presets: [
      {
        id: "commerce-read",
        kind: "api-token",
        label: "Commerce read",
        grants: ["bookings:read"],
      },
      {
        id: "agent-staff",
        kind: "api-token-grant",
        label: "Agent (staff)",
        grants: ["bookings:read", "bookings:write"],
        audience: "staff",
      },
      {
        id: "editor",
        kind: "staff",
        label: "Editor",
        grants: ["bookings:read", "bookings:write"],
      },
    ],
  },
  plugins: [
    { resolve: "@voyant-travel/plugin-netopia" },
    { resolve: "@voyant-travel/plugin-smartbill" },
  ],
  deployment: {
    target: "node",
    mode: "self-hosted",
    providers: {
      database: "postgres",
      storage: "memory",
      cache: "postgres",
      sharedState: "memory",
      rateLimit: "memory",
      search: "none",
      email: "none",
      sms: "none",
      auth: "better-auth",
      scheduledJobs: "none",
      workflows: "none",
    },
    migrations: [{ id: "deployment", source: "./migrations" }],
  },
})
