import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { OperatorAdminBootstrapGate, useLocale } from "@voyantjs/admin"
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui/i18n"
import { CrmUiMessagesProvider } from "@voyantjs/crm-ui/i18n"
import { DistributionUiMessagesProvider } from "@voyantjs/distribution-ui/i18n"
import { FinanceUiMessagesProvider } from "@voyantjs/finance-ui/i18n"
import { ProductsUiMessagesProvider } from "@voyantjs/products-ui/i18n"
import { VoyantReactProvider } from "@voyantjs/react"
import { ResourcesUiMessagesProvider } from "@voyantjs/resources-ui/i18n"
import { SuppliersUiMessagesProvider } from "@voyantjs/suppliers-ui/i18n"
import { SidebarProvider } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { UserProvider, useUser } from "@/components/providers/user-provider"
import {
  AdminI18nProvider,
  getAdminMessageOverridesFromUiPrefs,
  useAdminMessages,
} from "@/lib/admin-i18n"
import { getCurrentUser } from "@/lib/current-user"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace")({
  loader: async ({ location }) => {
    const user = await getCurrentUser()

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { next: location.href },
      })
    }

    return { user }
  },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { user } = Route.useLoaderData()

  return (
    <VoyantReactProvider baseUrl={getApiUrl()}>
      <UserProvider initialUser={user}>
        <WorkspaceContent />
      </UserProvider>
    </VoyantReactProvider>
  )
}

function WorkspaceContent() {
  const { user, isLoading } = useUser()
  const { resolvedLocale, setLocale, setTimeZone } = useLocale()
  const messages = useAdminMessages()

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return
    }

    if (!window.localStorage.getItem("admin-locale") && user.locale) {
      setLocale(user.locale)
    }

    if (!window.localStorage.getItem("admin-timezone") && user.timezone) {
      setTimeZone(user.timezone)
    }
  }, [setLocale, setTimeZone, user])

  return (
    <OperatorAdminBootstrapGate
      user={user}
      isUserLoading={isLoading}
      loadingFallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{messages.loading}</p>
          </div>
        </div>
      }
    >
      {({ user }) => (
        <AdminI18nProvider overrides={getAdminMessageOverridesFromUiPrefs(user.uiPrefs)}>
          <BookingsUiMessagesProvider locale={resolvedLocale}>
            <CrmUiMessagesProvider locale={resolvedLocale}>
              <ProductsUiMessagesProvider locale={resolvedLocale}>
                <ResourcesUiMessagesProvider locale={resolvedLocale}>
                  <DistributionUiMessagesProvider locale={resolvedLocale}>
                    <FinanceUiMessagesProvider locale={resolvedLocale}>
                      <SuppliersUiMessagesProvider locale={resolvedLocale}>
                        <WorkspaceInner user={user} />
                      </SuppliersUiMessagesProvider>
                    </FinanceUiMessagesProvider>
                  </DistributionUiMessagesProvider>
                </ResourcesUiMessagesProvider>
              </ProductsUiMessagesProvider>
            </CrmUiMessagesProvider>
          </BookingsUiMessagesProvider>
        </AdminI18nProvider>
      )}
    </OperatorAdminBootstrapGate>
  )
}

function WorkspaceInner({ user }: { user: NonNullable<ReturnType<typeof useUser>["user"]> }) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: displayName,
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
          email: user.email ?? undefined,
          avatar: user.profilePictureUrl ?? undefined,
        }}
      />
      <main className="flex-1">
        <Outlet />
      </main>
    </SidebarProvider>
  )
}
