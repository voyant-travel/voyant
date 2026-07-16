import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type NavigationSetupMessages = {
  navigationLabel: string
  title: string
  description: string
  action: string
}

export const navigationSetupMessageDefinitions = {
  en: {
    navigationLabel: "Navigation",
    title: "Workspace navigation",
    description: "Choose which product areas your team sees in the main navigation.",
    action: "Choose navigation",
  },
  ro: {
    navigationLabel: "Navigare",
    title: "Navigarea spațiului de lucru",
    description: "Alege zonele de produs afișate echipei în navigarea principală.",
    action: "Alege navigarea",
  },
} satisfies LocaleMessageDefinitions<NavigationSetupMessages>
