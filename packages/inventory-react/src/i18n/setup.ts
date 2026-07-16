import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type FirstProductSetupMessages = {
  title: string
  description: string
  action: string
}

export const inventoryFirstProductSetupMessageDefinitions = {
  en: {
    title: "Create your first product",
    description: "Continue in Products to create the first sellable travel product.",
    action: "Open products",
  },
  ro: {
    title: "Creează primul produs",
    description: "Continuă în Produse pentru a crea primul produs de călătorie vandabil.",
    action: "Deschide produsele",
  },
} satisfies LocaleMessageDefinitions<FirstProductSetupMessages>
