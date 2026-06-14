import { pgEnum } from "drizzle-orm/pg-core"

export const groundVehicleCategoryEnum = pgEnum("ground_vehicle_category", [
  "car",
  "sedan",
  "suv",
  "van",
  "minibus",
  "bus",
  "boat",
  "train",
  "other",
])

export const groundVehicleClassEnum = pgEnum("ground_vehicle_class", [
  "economy",
  "standard",
  "premium",
  "luxury",
  "accessible",
  "other",
])

export const groundServiceLevelEnum = pgEnum("ground_service_level", [
  "private",
  "shared",
  "vip",
  "shuttle",
  "other",
])

export const groundDispatchStatusEnum = pgEnum("ground_dispatch_status", [
  "draft",
  "scheduled",
  "assigned",
  "en_route",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
  "no_show",
])

export const groundExecutionEventTypeEnum = pgEnum("ground_execution_event_type", [
  "scheduled",
  "assigned",
  "driver_en_route",
  "driver_arrived",
  "pickup_completed",
  "dropoff_completed",
  "cancelled",
  "issue",
  "note",
])

export const groundAssignmentSourceEnum = pgEnum("ground_assignment_source", [
  "manual",
  "suggested",
  "auto",
])

export const groundDispatchLegTypeEnum = pgEnum("ground_dispatch_leg_type", [
  "pickup",
  "stop",
  "dropoff",
  "deadhead",
])

export const groundDriverShiftStatusEnum = pgEnum("ground_driver_shift_status", [
  "scheduled",
  "available",
  "on_duty",
  "completed",
  "cancelled",
])

export const groundIncidentSeverityEnum = pgEnum("ground_incident_severity", [
  "info",
  "warning",
  "critical",
])

export const groundIncidentResolutionStatusEnum = pgEnum("ground_incident_resolution_status", [
  "open",
  "mitigated",
  "resolved",
  "cancelled",
])

export const groundCheckpointStatusEnum = pgEnum("ground_checkpoint_status", [
  "pending",
  "reached",
  "missed",
  "cancelled",
])
