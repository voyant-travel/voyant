import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type ContractGenerationSetupMessages = {
  title: string
  description: string
  action: string
}

export const legalContractGenerationSetupMessageDefinitions = {
  en: {
    title: "Contract generation",
    description:
      "Author your contract, select it for automatic use, and choose a default number series.",
    action: "Configure contracts",
  },
  ro: {
    title: "Generarea contractelor",
    description:
      "Creează contractul, selectează-l pentru folosire automată și alege seria implicită.",
    action: "Configurează contractele",
  },
} satisfies LocaleMessageDefinitions<ContractGenerationSetupMessages>
