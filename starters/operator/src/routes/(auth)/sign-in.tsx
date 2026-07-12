import { createFileRoute } from "@tanstack/react-router"
import { localAuthRouteContribution } from "@/lib/local-auth-bootstrap"

export const Route = createFileRoute("/(auth)/sign-in")(localAuthRouteContribution.routes.signIn)
