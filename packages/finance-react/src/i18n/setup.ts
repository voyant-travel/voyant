import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type FiscalSetupMessages = {
  title: string
  description: string
  action: string
}

export const financeFiscalSetupMessageDefinitions = {
  en: {
    title: "Fiscal settings",
    description: "Review tax classes and regimes before issuing customer documents.",
    action: "Open tax settings",
  },
  ro: {
    title: "Setări fiscale",
    description: "Verifică clasele și regimurile fiscale înainte de emiterea documentelor.",
    action: "Deschide setările fiscale",
  },
} satisfies LocaleMessageDefinitions<FiscalSetupMessages>
