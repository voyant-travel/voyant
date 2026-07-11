import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
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
