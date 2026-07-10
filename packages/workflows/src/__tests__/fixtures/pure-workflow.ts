import { defineWorkflow } from "../../index.js"

export default defineWorkflow<{ bookingId: string }, string>({
  id: "fixture.pure-workflow",
  schedule: { cron: "0 8 * * *", timezone: "Europe/Bucharest" },
  retry: { max: 3 },
  async run(input) {
    return input.bookingId
  },
})
