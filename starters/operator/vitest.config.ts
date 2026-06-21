import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    server: {
      deps: {
        inline: [
          /@voyant-travel\/(catalog|connect-adapter|connect-cruises|connect-sdk|cruises|plugin-voyant-connect)(\/.*)?/,
        ],
      },
    },
  },
})
