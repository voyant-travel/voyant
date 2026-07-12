import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  plugins: [{ resolve: "@voyant-travel/plugin-netopia" }],
  deployment: {
    target: "node",
    providers: {
      database: "postgres",
    },
  },
})
