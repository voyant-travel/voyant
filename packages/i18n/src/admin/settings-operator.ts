import type { LocaleMessageSchema } from "../runtime.js"
import { operatorAdminSettingsMessagesEnPart1 } from "./settings-operator/en-part-1.js"
import { operatorAdminSettingsMessagesRoPart1 } from "./settings-operator/ro-part-1.js"

export const operatorAdminSettingsMessages = {
  en: {
    settings: {
      ...operatorAdminSettingsMessagesEnPart1,
    },
  },
  ro: {
    settings: {
      ...operatorAdminSettingsMessagesRoPart1,
    },
  },
}

export type OperatorAdminSettingsMessages = LocaleMessageSchema<
  (typeof operatorAdminSettingsMessages)["en"]
>
