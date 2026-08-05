import type { LocaleMessageSchema } from "../runtime.js"
import { adminBookingsMessagesEnPart1 } from "./bookings/en-part-1.js"
import { adminBookingsMessagesEsPart1 } from "./bookings/es-part-1.js"
import { adminBookingsMessagesRoPart1 } from "./bookings/ro-part-1.js"

export const adminBookingsMessages = {
  en: {
    bookings: {
      ...adminBookingsMessagesEnPart1,
    },
  },
  ro: {
    bookings: {
      ...adminBookingsMessagesRoPart1,
    },
  },
  es: {
    bookings: {
      ...adminBookingsMessagesEsPart1,
    },
  },
}

export type AdminBookingsMessages = LocaleMessageSchema<(typeof adminBookingsMessages)["en"]>
