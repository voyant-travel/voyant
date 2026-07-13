import { describe, expect, it } from "vitest"

import { parseOperatorCliArguments } from "./cli-arguments.js"

describe("parseOperatorCliArguments", () => {
  it.each([
    ["start"],
    ["--probe"],
    ["start", "--probe"],
  ])("uses the default port for %j", (...args) => {
    expect(parseOperatorCliArguments(args, {})).toMatchObject({
      command: "start",
      port: 8080,
    })
  })

  it("uses the environment port when no explicit port is present", () => {
    expect(parseOperatorCliArguments(["start"], { PORT: "4400" }).port).toBe(4400)
  })

  it("prefers an explicit port", () => {
    expect(parseOperatorCliArguments(["start", "--port", "5500"], { PORT: "4400" }).port).toBe(5500)
  })
})
