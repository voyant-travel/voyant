import { createFileRoute } from "@tanstack/react-router"
import { localAuthRouteContribution } from "@/lib/local-auth-bootstrap"

export const Route = createFileRoute("/(auth)")(localAuthRouteContribution.routes.layout)
