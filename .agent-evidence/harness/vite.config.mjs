import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

// The harness dir has no node_modules; pnpm doesn't hoist these plugins to the
// repo root, so resolve them from the operator starter, which depends on both.
const require = createRequire(
  fileURLToPath(new URL("../../starters/operator/package.json", import.meta.url)),
)
const react = require("@vitejs/plugin-react").default
const tailwindcss = require("@tailwindcss/vite").default

const root = fileURLToPath(new URL(".", import.meta.url))
const repo = fileURLToPath(new URL("../../", import.meta.url))

export default {
  root,
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [repo] } },
}
