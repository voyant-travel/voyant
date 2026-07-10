import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  modules: [
    { resolve: "./src/modules/mcp" },
    { resolve: "./src/modules/invitations" },
    { resolve: "./src/modules/team" },
  ],
  plugins: [{ resolve: "@voyant-travel/plugin-netopia" }],
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
