import { setupEn } from "./en.js"
import type { SetupMessages } from "./messages.js"
import { setupRo } from "./ro.js"

export type { SetupMessages }
export { setupEn, setupRo }

export function resolveSetupMessages(locale: string | null | undefined): SetupMessages {
  return locale?.toLowerCase().startsWith("ro") ? setupRo : setupEn
}
