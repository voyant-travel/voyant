import { setupEn } from "./en.js"
import { setupEs } from "./es.js"
import type { SetupMessages } from "./messages.js"
import { setupRo } from "./ro.js"

export type { SetupMessages }
export { setupEn, setupEs, setupRo }

const setupCatalogs: Record<string, SetupMessages> = {
  en: setupEn,
  es: setupEs,
  ro: setupRo,
}

export function resolveSetupMessages(locale: string | null | undefined): SetupMessages {
  const language = locale?.toLowerCase().split("-")[0] ?? ""
  return setupCatalogs[language] ?? setupEn
}
