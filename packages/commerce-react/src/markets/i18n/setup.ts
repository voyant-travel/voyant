import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type MarketSetupMessages = {
  navigationLabel: string
  title: string
  description: string
  action: string
}

export const commerceMarketSetupMessageDefinitions = {
  en: {
    navigationLabel: "Markets",
    title: "Locale, currency, and market",
    description: "Define the primary market, language, and selling currency.",
    action: "Configure markets",
  },
  ro: {
    navigationLabel: "Piețe",
    title: "Limbă, monedă și piață",
    description: "Definește piața principală, limba și moneda de vânzare.",
    action: "Configurează piețele",
  },
} satisfies LocaleMessageDefinitions<MarketSetupMessages>
