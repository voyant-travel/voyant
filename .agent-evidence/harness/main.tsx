import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  ConsentScreen,
  DeveloperAppsPage,
  InstallationDetail,
  InstalledAppsPage,
  VoyantProvider,
} from "@voyant-travel/apps-react"
import { AppsUiMessagesProvider } from "@voyant-travel/apps-react/i18n"
import { useState } from "react"
import { createRoot } from "react-dom/client"

import { mockFetcher } from "./mock-fetcher.js"
import "./styles.css"

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const VIEWS = [
  { id: "list", label: "Installed apps" },
  { id: "detail", label: "App detail" },
  { id: "consent", label: "Consent" },
  { id: "developer", label: "Developer" },
] as const

function Harness() {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("list")
  const [consentOpen, setConsentOpen] = useState(true)
  return (
    <VoyantProvider baseUrl="/api" fetcher={mockFetcher}>
      <QueryClientProvider client={queryClient}>
        <AppsUiMessagesProvider locale="en">
          <div className="min-h-screen bg-background text-foreground">
            <nav className="flex items-center gap-2 border-b bg-card px-6 py-3">
              <span className="mr-3 text-sm font-semibold">Apps governance harness</span>
              {VIEWS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setView(entry.id)
                    setConsentOpen(true)
                  }}
                  className={
                    view === entry.id
                      ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                      : "rounded-md border px-3 py-1.5 text-sm"
                  }
                >
                  {entry.label}
                </button>
              ))}
            </nav>
            <main className="mx-auto max-w-6xl">
              {view === "list" ? <InstalledAppsPage actorId="user_admin" /> : null}
              {view === "detail" ? (
                <div className="p-6">
                  <InstallationDetail installationId="inst_smartbill" actorId="user_admin" />
                </div>
              ) : null}
              {view === "developer" ? <DeveloperAppsPage actorId="user_admin" /> : null}
              {view === "consent" ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Consent dialog is open over this surface.
                  <ConsentScreen
                    open={consentOpen}
                    onOpenChange={setConsentOpen}
                    actorId="user_admin"
                    appId="app_smartbill_7f3a"
                  />
                </div>
              ) : null}
            </main>
          </div>
        </AppsUiMessagesProvider>
      </QueryClientProvider>
    </VoyantProvider>
  )
}

const container = document.getElementById("root")
if (container) createRoot(container).render(<Harness />)
