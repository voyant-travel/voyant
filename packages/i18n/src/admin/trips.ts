import type { LocaleMessageSchema } from "../runtime.js"
import { adminTripsMessagesEnPart1 } from "./trips/en-part-1.js"
import { adminTripsMessagesEnPart2 } from "./trips/en-part-2.js"
import { adminTripsMessagesRoPart1 } from "./trips/ro-part-1.js"
import { adminTripsMessagesRoPart2 } from "./trips/ro-part-2.js"

export const adminTripsMessages = {
  en: {
    trips: {
      ...adminTripsMessagesEnPart1,
      ...adminTripsMessagesEnPart2,
    },
  },
  ro: {
    trips: {
      ...adminTripsMessagesRoPart1,
      ...adminTripsMessagesRoPart2,
    },
  },
}

export type AdminTripsMessages = LocaleMessageSchema<(typeof adminTripsMessages)["en"]>
