import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  plugins: [
    { resolve: "@voyant-travel/plugin-netopia" },
    { resolve: "@voyant-travel/plugin-smartbill" },
  ],
  deployment: {
    target: "node",
    providers: {
      database: "postgres",
    },
    migrations: [{ id: "deployment", source: "./migrations" }],
  },
})
