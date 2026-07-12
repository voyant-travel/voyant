import { createFileRoute } from "@tanstack/react-router"
import { storefrontPresentationContribution } from "@/lib/storefront-messages"

export const Route = createFileRoute("/(storefront)/shop_/account/sign-in")(
  storefrontPresentationContribution.routes.accountSignIn,
)
