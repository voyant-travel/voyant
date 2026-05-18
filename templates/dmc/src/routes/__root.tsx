import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router"
import { Toaster } from "@voyantjs/ui/components"
import type { ReactNode } from "react"

import { Providers } from "../components/providers"
import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Voyant" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/fav128.png" },
    ],
    scripts: [
      {
        // Inline theme and language detection to prevent flashes before hydration.
        children: `(function(){var t=localStorage.getItem("theme");if(t==="dark"||(!t||t==="system")&&matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.classList.add("dark")}var l=localStorage.getItem("admin-locale")||(navigator.language||"en");l=l.toLowerCase().split("-")[0];document.documentElement.lang=l==="ro"?"ro":"en"})()`,
      },
    ],
  }),
  // shellComponent is always SSR'd — renders the <html> document shell
  shellComponent: RootShell,
  component: RootComponent,
})

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const queryClient = useRouteContext({
    from: "__root__",
    select: (context) => context.queryClient,
  })

  return (
    <Providers queryClient={queryClient}>
      <Outlet />
      <Toaster />
    </Providers>
  )
}
