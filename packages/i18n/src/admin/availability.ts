import type { LocaleMessageSchema } from "../runtime.js"
import { adminAvailabilityMessagesEnPart1 } from "./availability/en-part-1.js"
import { adminAvailabilityMessagesEnPart2 } from "./availability/en-part-2.js"
import { adminAvailabilityMessagesRoPart1 } from "./availability/ro-part-1.js"
import { adminAvailabilityMessagesRoPart2 } from "./availability/ro-part-2.js"

export const adminAvailabilityMessages = {
  en: {
    availability: {
      ...adminAvailabilityMessagesEnPart1,
      ...adminAvailabilityMessagesEnPart2,
    },
  },
  ro: {
    availability: {
      ...adminAvailabilityMessagesRoPart1,
      ...adminAvailabilityMessagesRoPart2,
    },
  },
}

export type AdminAvailabilityMessages = LocaleMessageSchema<
  (typeof adminAvailabilityMessages)["en"]
>
