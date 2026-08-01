import { AllocationServiceError } from "./service-allocation-errors.js"

/**
 * Shared invariant for manual and template-driven vehicle-seat writes.
 * Callers performing persistence must hold the parent vehicle row lock until
 * their seat insert/update commits.
 */
export function assertVehicleChildCapacity({
  capacity,
  existingSeatCount,
  seatsToAdd,
}: {
  capacity: number
  existingSeatCount: number
  seatsToAdd: number
}) {
  if (existingSeatCount + seatsToAdd <= capacity) return
  throw new AllocationServiceError("Vehicle seat count exceeds vehicle capacity", 409, {
    capacity,
    existingSeatCount,
    requestedSeatCount: seatsToAdd,
  })
}
