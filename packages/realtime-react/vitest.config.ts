import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    hookTimeout: 60000,
  },
})
