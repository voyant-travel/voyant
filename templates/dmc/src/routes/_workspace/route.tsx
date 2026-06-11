import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router"
import {
  type AdminDestinationResolvers,
  AdminNavigationProvider,
  OperatorAdminBootstrapGate,
  useLocale,
} from "@voyantjs/admin"
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui/i18n"
import { CrmUiMessagesProvider } from "@voyantjs/crm-ui/i18n"
import { DistributionUiMessagesProvider } from "@voyantjs/distribution-ui/i18n"
import { FinanceUiMessagesProvider } from "@voyantjs/finance-ui/i18n"
// Type-only: binds the notifications `AdminDestinations` augmentation into
// this program so the resolver map below typechecks against its keys.
import type {} from "@voyantjs/notifications-ui/admin"
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

// Resolver map for the semantic destinations declared by the packaged
// admin pages this template mounts (packaged-admin RFC §4.7) — today the
// notifications hosts from @voyantjs/notifications-ui/admin. `satisfies
// AdminDestinationResolvers` keeps it exhaustive: mounting a package that
// declares a new destination fails the typecheck here until the key is
// resolvable.
const dmcAdminDestinations = {
  "notificationReminderRule.detail": ({ ruleId }) =>
    `/notifications/reminder-rules/${encodeURIComponent(ruleId)}`,
  "notificationReminderRule.list": () => "/notifications/reminder-rules",
  "notificationTemplate.detail": ({ templateId }) =>
    `/notifications/templates/${encodeURIComponent(templateId)}`,
  "notificationTemplate.list": () => "/notifications/templates",
} satisfies AdminDestinationResolvers

function WorkspaceLayout() {
  const { user } = Route.useLoaderData()
  const router = useRouter()

  return (
    <VoyantReactProvider baseUrl={getApiUrl()}>
      <AdminNavigationProvider
        resolvers={dmcAdminDestinations}
        navigate={(href) => void router.navigate({ href })}
      >
        <UserProvider initialUser={user}>
          <WorkspaceContent />
        </UserProvider>
      </AdminNavigationProvider>
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
