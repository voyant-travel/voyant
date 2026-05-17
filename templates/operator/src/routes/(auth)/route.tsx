import { createFileRoute, Outlet } from "@tanstack/react-router"
import { AuthLayout } from "@voyantjs/auth-ui"

export const Route = createFileRoute("/(auth)")({
  component: AuthRouteLayout,
})

function AuthRouteLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  )
}
