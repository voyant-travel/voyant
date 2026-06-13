import { pgEnum } from "drizzle-orm/pg-core"

export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"])
export const productOptionStatusEnum = pgEnum("product_option_status", [
  "draft",
  "active",
  "archived",
])
export const optionUnitTypeEnum = pgEnum("option_unit_type", [
  "person",
  "group",
  "room",
  "vehicle",
  "service",
  "other",
])
export const productBookingModeEnum = pgEnum("product_booking_mode", [
  "date",
  "date_time",
  "open",
  "stay",
  "transfer",
  "itinerary",
  "other",
])
export const productCapacityModeEnum = pgEnum("product_capacity_mode", [
  "free_sale",
  "limited",
  "on_request",
])
export const productVisibilityEnum = pgEnum("product_visibility", ["public", "private", "hidden"])
export const productActivationModeEnum = pgEnum("product_activation_mode", [
  "manual",
  "scheduled",
  "channel_controlled",
])
export const productTicketFulfillmentEnum = pgEnum("product_ticket_fulfillment", [
  "none",
  "per_booking",
  "per_participant",
  "per_item",
])
export const productDeliveryFormatEnum = pgEnum("product_delivery_format", [
  "voucher",
  "ticket",
  "pdf",
  "qr_code",
  "barcode",
  "email",
  "mobile",
  "none",
])
export const productCapabilityEnum = pgEnum("product_capability", [
  "instant_confirmation",
  "on_request",
  "pickup_available",
  "dropoff_available",
  "guided",
  "private",
  "shared",
  "digital_ticket",
  "voucher_required",
  "external_inventory",
  "multi_day",
  "accommodation",
  "transport",
])
export const productFeatureTypeEnum = pgEnum("product_feature_type", [
  "inclusion",
  "exclusion",
  "highlight",
  "important_information",
  "other",
])
export const productLocationTypeEnum = pgEnum("product_location_type", [
  "start",
  "end",
  "meeting_point",
  "pickup",
  "dropoff",
  "point_of_interest",
  "other",
])
export const serviceTypeEnum = pgEnum("service_type", [
  "accommodation",
  "transfer",
  "experience",
  "guide",
  "meal",
  "other",
])
export const productMediaTypeEnum = pgEnum("product_media_type", ["image", "video", "document"])
