import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyant-travel/admin"
import { Paintbrush } from "lucide-react"

import { getAdminStorefrontSettings } from "./operations.js"

export function createSelectedStorefrontAdminExtension(): AdminExtension {
  return defineAdminExtension({
    id: "storefront",
    settingsPages: [
      {
        id: "storefront",
        path: "/storefront",
        title: "Storefront",
        label: "Storefront",
        icon: Paintbrush,
        group: "general",
        order: 25,
        page: () =>
          import("./components/storefront-settings-page.js").then((module) =>
            adminRoutePageModule(module.StorefrontSettingsPage),
          ),
      },
    ],
    setupSteps: [
      {
        id: "@voyant-travel/storefront#setup.branding",
        order: 20,
        skippable: true,
        href: "/settings/storefront",
        messages: {
          en: {
            title: "Storefront branding",
            description: "Add the logo and visual identity customers see on your storefront.",
            action: "Open storefront settings",
          },
          ro: {
            title: "Identitatea magazinului",
            description: "Adauga sigla si identitatea vizuala afisata clientilor in magazin.",
            action: "Deschide setarile magazinului",
          },
        },
        prefill: objectPrefill,
        isComplete: hasStorefrontBranding,
      },
    ],
  })
}

async function hasStorefrontBranding({ runtime }: AdminRouteLoaderContext): Promise<boolean> {
  try {
    const { data } = await getAdminStorefrontSettings({
      baseUrl: runtime.baseUrl,
      fetcher: runtime.fetcher ?? fetch,
    })
    return Boolean(data.branding.logoUrl || data.branding.brandMarkUrl)
  } catch {
    return false
  }
}

function objectPrefill(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined
}
