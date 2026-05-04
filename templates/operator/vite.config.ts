import { fileURLToPath, URL } from "node:url"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const config = defineConfig({
  // Allow Cloudflare-tunnel / ngrok hostnames to reach the dev server.
  // Vite's default rejects any Host header that isn't localhost, which
  // breaks Netopia (and other) webhooks delivered through a public tunnel.
  // `true` allows everything — fine for dev, never for production.
  server: {
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  ssr: {
    optimizeDeps: {
      include: [
        "clsx",
        "tailwind-merge",
        "react",
        "react-dom",
        "react-dom/server",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "zustand",
        "zustand/react/shallow",
        "immer",
        "sonner",
        "lucide-react",
        "date-fns",
        "zod",
        "react-hook-form",
        "swr",
      ],
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern:
          "^(_components|_hooks|_stores|_sections|_contexts|_lib|_tabs|utils|types\\.ts|.*(?:^|[-])(shared|page(?:-[a-z0-9-]+)?|dialogs?(?:-[a-z0-9-]+)?|sections|service-row|day-row|version-row|contact-tab|questions-row|questions-tab|section-header|kanban|queries)\\.(?:ts|tsx))$",
      },
    }),
    viteReact(),
  ],
})

export default config
