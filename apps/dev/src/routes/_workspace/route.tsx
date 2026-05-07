import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { VoyantReactProvider } from "@voyantjs/react"
import { SidebarProvider } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { UserProvider, useUser } from "@/components/providers/user-provider"
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

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
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </SidebarProvider>
  )
}
