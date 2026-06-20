/**
 * `availability_slots` is owned by `@voyant-travel/availability`. bookings no
 * longer FK-references it at the schema level (availabilitySlotId is a plain
 * indexed id), but the refund workflow still writes back remaining capacity, so
 * this re-export keeps the historical `availabilitySlotsRef` name for those
 * runtime queries. This is a runtime dependency only — bookings does NOT declare
 * availability in `voyant.requiresSchemas` (no migration ordering dependency).
 */
export { availabilitySlots as availabilitySlotsRef } from "@voyant-travel/availability/schema"
