import type { LocaleMessageDefinitions } from "@voyant-travel/i18n"

type TeamSetupMessages = {
  navigationLabel: string
  title: string
  description: string
  action: string
}

export const authTeamSetupMessageDefinitions = {
  en: {
    navigationLabel: "Team",
    title: "Invite your team",
    description: "Add colleagues and assign the access they need.",
    action: "Manage team",
  },
  ro: {
    navigationLabel: "Echipă",
    title: "Invită echipa",
    description: "Adaugă colegi și atribuie-le accesul de care au nevoie.",
    action: "Gestionează echipa",
  },
} satisfies LocaleMessageDefinitions<TeamSetupMessages>
