import { createFileRoute, Outlet } from "@tanstack/react-router"
import { VoyantMark, VoyantWordmark } from "@voyantjs/admin"

export const Route = createFileRoute("/(auth)")({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center text-foreground">
          <div className="flex items-center gap-3">
            <VoyantMark aria-hidden="true" className="size-8 shrink-0" />
            <VoyantWordmark className="h-7 w-auto" />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
