import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Trips Cruise date picker accessibility", () => {
  it("keeps Cruise embarkation and Flight departure on the shared DatePicker", () => {
    const cruiseSource = readFileSync("src/admin/trips-panels/manual-configurators.tsx", "utf8")
    const flightSource = readFileSync("src/admin/trips-panels/flight-configurator.tsx", "utf8")

    expect(cruiseSource).toContain(
      'import { DatePicker } from "@voyant-travel/ui/components/date-picker"',
    )
    expect(flightSource).toContain(
      'import { DatePicker } from "@voyant-travel/ui/components/date-picker"',
    )
    expect(cruiseSource).toMatch(/<DatePicker[\s\S]*placeholder=\{t\.pickDate\}/)
    expect(cruiseSource).not.toMatch(/type\s*=\s*["']date["']/)
  })
})
