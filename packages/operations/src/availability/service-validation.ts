import { RequestValidationError } from "@voyant-travel/hono"
import { validateRRule } from "./rrule.js"
import { instantToSlotLocal } from "./slot-timezone.js"

export function assertAvailabilityRecurrenceRule(recurrenceRule: string) {
  const result = validateRRule(recurrenceRule)
  if (!result.ok) {
    throw new RequestValidationError("Availability recurrence rule is invalid", {
      recurrenceRule,
      reason: result.message,
    })
  }
}

export function assertSlotTimingAndCapacity(input: {
  dateLocal: string
  startsAt: string | Date
  endsAt?: string | Date | null
  timezone: string
  unlimited?: boolean | null
  initialPax?: number | null
  remainingPax?: number | null
}) {
  const startsAt = input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) {
    throw new RequestValidationError("Availability slot startsAt must be a valid instant", {
      startsAt: String(input.startsAt),
    })
  }

  if (input.endsAt) {
    const endsAt = input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt)
    if (Number.isNaN(endsAt.getTime())) {
      throw new RequestValidationError("Availability slot endsAt must be a valid instant", {
        endsAt: String(input.endsAt),
      })
    }
    if (endsAt < startsAt) {
      throw new RequestValidationError(
        "Availability slot endsAt must be greater than or equal to startsAt",
        {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      )
    }
  }

  if (
    input.unlimited !== true &&
    input.initialPax !== undefined &&
    input.initialPax !== null &&
    input.remainingPax !== undefined &&
    input.remainingPax !== null &&
    input.remainingPax > input.initialPax
  ) {
    throw new RequestValidationError(
      "Availability slot remainingPax must be less than or equal to initialPax",
      {
        initialPax: input.initialPax,
        remainingPax: input.remainingPax,
      },
    )
  }

  let startsAtDateLocal: string
  try {
    startsAtDateLocal = instantToSlotLocal(startsAt, input.timezone).date
  } catch {
    throw new RequestValidationError("Availability slot timezone must be a valid IANA timezone", {
      timezone: input.timezone,
    })
  }

  if (input.dateLocal !== startsAtDateLocal) {
    throw new RequestValidationError(
      "Availability slot dateLocal must match startsAt in the slot timezone",
      {
        dateLocal: input.dateLocal,
        startsAt: startsAt.toISOString(),
        timezone: input.timezone,
        expectedDateLocal: startsAtDateLocal,
      },
    )
  }
}
