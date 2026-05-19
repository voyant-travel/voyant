import { createFileRoute } from "@tanstack/react-router"

import { StorefrontComposerBlock } from "@/components/voyant/travel-composer/storefront-composer-block"

export const Route = createFileRoute("/(storefront)/shop_/composer")({
  component: StorefrontComposerBlock,
})
