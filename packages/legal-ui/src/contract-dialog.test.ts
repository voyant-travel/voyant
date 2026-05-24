import { describe, expect, it } from "vitest"

import { buildVariablesPayload, clearedOptionalValue } from "./components/contract-dialog.js"

function booleanRow(overrides: {
  key?: string
  booleanValue: boolean
  includeBooleanValue?: boolean
  required?: boolean
}) {
  return {
    key: overrides.key ?? "accepted",
    label: "Accepted",
    type: "boolean",
    required: overrides.required ?? false,
    value: "",
    booleanValue: overrides.booleanValue,
    includeBooleanValue: overrides.includeBooleanValue ?? false,
  }
}

describe("ContractDialog payload helpers", () => {
  it("preserves explicit false boolean variables", () => {
    expect(
      buildVariablesPayload(
        [
          booleanRow({
            booleanValue: false,
            includeBooleanValue: true,
          }),
        ],
        [],
      ),
    ).toEqual({ accepted: false })
  })

  it("omits untouched optional false boolean variables", () => {
    expect(buildVariablesPayload([booleanRow({ booleanValue: false })], [])).toBeUndefined()
  })

  it("sends null for cleared optional update fields", () => {
    expect(clearedOptionalValue("", true)).toBeNull()
    expect(clearedOptionalValue(undefined, true)).toBeNull()
    expect(clearedOptionalValue(" person_123 ", true)).toBe("person_123")
  })

  it("omits cleared optional create fields", () => {
    expect(clearedOptionalValue("", false)).toBeUndefined()
  })
})
