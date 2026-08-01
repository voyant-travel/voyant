import { describe, expect, it } from "vitest"

import { AllocationServiceError } from "../../../src/availability/service-allocation.js"
import { assertVehicleChildCapacity } from "../../../src/availability/service-allocation-resource-crud.js"

describe("vehicle child-seat capacity", () => {
  it("accepts child seats up to the vehicle capacity", () => {
    expect(() =>
      assertVehicleChildCapacity({ capacity: 50, existingSeatCount: 49, seatsToAdd: 1 }),
    ).not.toThrow()
  })

  it("rejects another seat once the vehicle is full", () => {
    expect(() =>
      assertVehicleChildCapacity({ capacity: 2, existingSeatCount: 2, seatsToAdd: 1 }),
    ).toThrowError(AllocationServiceError)
  })

  it("rejects lowering vehicle capacity below its existing seat count", () => {
    try {
      assertVehicleChildCapacity({ capacity: 19, existingSeatCount: 20, seatsToAdd: 0 })
      throw new Error("Expected capacity conflict")
    } catch (error) {
      expect(error).toBeInstanceOf(AllocationServiceError)
      expect(error).toMatchObject({
        status: 409,
        detail: { capacity: 19, existingSeatCount: 20, requestedSeatCount: 0 },
      })
    }
  })
})
