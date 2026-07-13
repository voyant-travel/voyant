// Collection tables
export {
  collectionCoreColumns,
  collectionItemsCoreColumns,
  collectionTranslationsCoreColumns,
} from "./collection.js"
// Cruise tables
export { shipCabinCategoryCoreColumns, shipCabinCoreColumns } from "./cruise.js"
export { departureCoreColumns } from "./departure.js"
// Departure sub-tables
export {
  departureCabinCategoriesCoreColumns,
  departureCabinsCoreColumns,
  departureDaysCoreColumns,
  departureDayTasksCoreColumns,
  departureGroupMembersCoreColumns,
  departureGroupsCoreColumns,
  departureOverridesCoreColumns,
  departurePortCallsCoreColumns,
  departureRoomPricesCoreColumns,
  departureRoomsCoreColumns,
  departureTranslationsCoreColumns,
  departureTransportOptionsCoreColumns,
  departureTransportSeatingCoreColumns,
  departureTransportSegmentsCoreColumns,
} from "./departure-sub-tables.js"
// Destinations tables
export { destinationsCoreColumns } from "./destinations.js"
export { itineraryCoreColumns } from "./itinerary.js"
// Itinerary sub-tables
export {
  itineraryDaysCoreColumns,
  itineraryDayTranslationsCoreColumns,
  itinerarySegmentsCoreColumns,
  itinerarySegmentTranslationsCoreColumns,
  itineraryTranslationsCoreColumns,
  itineraryVersionsCoreColumns,
} from "./itinerary-sub-tables.js"
// Lodging tables
export {
  lodgingPropertyCoreColumns,
  lodgingPropertyDailyRateCoreColumns,
  lodgingPropertyMediaCoreColumns,
  lodgingPropertyRoomMediaCoreColumns,
  lodgingPropertyRoomRatePlanCoreColumns,
  lodgingPropertyRoomsCoreColumns,
  lodgingPropertyRoomTranslationCoreColumns,
  lodgingPropertyTranslationCoreColumns,
  lodgingRatePlansCoreColumns,
  lodgingRatePlanTranslationCoreColumns,
} from "./lodging.js"
// Offers tables
export { offerCoreColumns } from "./offers.js"
// Pricing tables
export {
  priceSchedulesCoreColumns,
  productBasePricesCoreColumns,
  productDeparturePriceOverridesCoreColumns,
  productPaymentOverridesCoreColumns,
  ratePlansCoreColumns,
} from "./pricing.js"
export { productCoreColumns, timestampColumns } from "./product.js"
// Product accommodation
export {
  productAccommodationOptionRoomsCoreColumns,
  productAccommodationOptionsCoreColumns,
  productAccommodationSetItemsCoreColumns,
  productAccommodationSetsCoreColumns,
} from "./product-accommodation.js"
// Product addons
export { productAddonsCoreColumns } from "./product-addons.js"
// Product availability
export { productAvailabilityCoreColumns } from "./product-availability.js"
// Product availability states
export {
  availabilitySessionsCoreColumns,
  blackoutDatesCoreColumns,
  departureAvailabilityStatesCoreColumns,
  productAvailabilityConfigCoreColumns,
} from "./product-availability-states.js"
// Product booking rules
export { productBookingRulesCoreColumns } from "./product-booking-rules.js"
// Product category assignments
export { productCategoryAssignmentsCoreColumns } from "./product-category-assignments.js"
// Product extensions
export { productExtensionsCoreColumns } from "./product-extensions.js"
// Product media
export { productMediaCoreColumns } from "./product-media.js"
// Product overrides
export { productOverridesCoreColumns } from "./product-overrides.js"
// Product preferences
export { productPreferencesCoreColumns } from "./product-preferences.js"
// Product publish settings
export { productPublishSettingsCoreColumns } from "./product-publish-settings.js"
// Product rate plans
export {
  productRatePlanChannelsCoreColumns,
  productRatePlansCoreColumns,
} from "./product-rate-plans.js"
// Product translations
export { productTranslationsCoreColumns } from "./product-translations.js"
// Product versions
export { productVersionsCoreColumns } from "./product-versions.js"
// Product visibility
export { productVisibilityCoreColumns } from "./product-visibility.js"
// Room tables
export {
  productRoomAvailabilityCoreColumns,
  productRoomListingMediaCoreColumns,
  productRoomListingsCoreColumns,
  productRoomSpecRatePlansCoreColumns,
  productRoomSpecsCoreColumns,
  roomPricesCoreColumns,
} from "./room.js"
export { shipCoreColumns } from "./ship.js"
// Tags tables
export { entityTagColumns } from "./tags.js"
// Transport tables
export {
  transportAddonsCoreColumns,
  transportConfigLegsCoreColumns,
  transportConfigsCoreColumns,
  transportFareClassesCoreColumns,
} from "./transport.js"
