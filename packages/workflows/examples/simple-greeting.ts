// A no-wait demo workflow: proves `voyant workflows run` works
// end-to-end without any fixture setup.

import { workflow } from "@voyant-travel/workflows"

export const greet = workflow({
  id: "greet",
  description: "Returns a greeting for the given name.",
  async run(input: { name: string }, ctx) {
    const normalised = await ctx.step("normalise", async () => input.name.trim())
    const message = await ctx.step("compose", async () => `Hello, ${normalised}!`)
    ctx.metadata.set("status", "done")
    return { message }
  },
})
