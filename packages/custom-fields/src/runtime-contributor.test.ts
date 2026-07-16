import {
  type CustomFieldsRuntime,
  customFieldsRuntimePort,
  customFieldValueReaderRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { describe, expect, it } from "vitest"
import { createCustomFieldsRuntimePortContribution } from "./runtime-contributor.js"

function runtimePortValues<T>(values: readonly unknown[]): readonly T[] {
  return values as readonly T[]
}

describe("custom-fields runtime value readers", () => {
  it("delegates visible values to selected entity readers", async () => {
    const readers: unknown[] = []
    const reader = {
      resolveVisibleValues: (_db: unknown, entity: string) =>
        entity === "person" ? { loyalty: "gold" } : undefined,
    }
    const runtime = createCustomFieldsRuntimePortContribution({
      customFieldTargets: [
        {
          id: "person",
          namespace: "relationships",
          label: "Person",
          fieldTypes: ["text"],
          capabilities: ["read", "invoice"],
          ownerUnitId: "@voyant-travel/relationships",
        },
      ],
      getRuntimePorts: <T>(port: { id: string }) =>
        runtimePortValues<T>(port.id === customFieldValueReaderRuntimePort.id ? readers : []),
    })[customFieldsRuntimePort.id] as CustomFieldsRuntime
    readers.push(reader)
    await expect(
      runtime.resolveVisibleValues({}, "person", "person_1", "invoice"),
    ).resolves.toEqual({ loyalty: "gold" })
    await expect(
      runtime.resolveVisibleValues({}, "booking", "booking_1", "invoice"),
    ).resolves.toEqual({})
  })
})
