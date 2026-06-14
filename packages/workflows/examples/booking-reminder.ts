// Spike demo workflow. Exercises step replay, sleep-based waitpoint
// yield, event waits, metadata, deterministic clock + RNG.

import { workflow } from "@voyant-travel/workflows"

interface Input {
  bookingId: string
  customerEmail: string
}

interface Output {
  confirmed: boolean
  remindedAt: number
}

export const sendBookingReminder = workflow({
  id: "send-booking-reminder",

  async run(input: Input, ctx): Promise<Output> {
    ctx.metadata.set("status", "loading-booking")

    const booking = await ctx.step("fetch-booking", async () => ({
      id: input.bookingId,
      email: input.customerEmail,
      startsAt: ctx.now() + 86_400_000,
    }))

    ctx.metadata.set("status", "waiting-for-reminder-window")

    await ctx.sleep("24h")

    ctx.metadata.set("status", "sending-reminder")

    const remindedAt = ctx.now()

    await ctx.step("send-reminder", async () => {
      return { sentTo: booking.email, sentAt: remindedAt }
    })

    ctx.metadata.set("status", "awaiting-confirmation")

    const confirmed = await ctx.waitForEvent<{ bookingId: string }>("booking.confirmed", {
      timeout: "7d",
    })

    ctx.metadata.set("status", "done")
    ctx.metadata.increment("reminders-sent")

    return {
      confirmed: confirmed?.bookingId === input.bookingId,
      remindedAt,
    }
  },
})
