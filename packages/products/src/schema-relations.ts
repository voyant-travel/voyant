import { relations } from "drizzle-orm"

import { optionUnits, productComponents, productOptions, products } from "./schema-core.js"
import {
  productDayServices,
  productDays,
  productItineraries,
  productMedia,
  productNotes,
  productVersions,
} from "./schema-itinerary.js"
import {
  optionUnitTranslations,
  productActivationSettings,
  productCapabilities,
  productDeliveryFormats,
  productFaqs,
  productFeatures,
  productLocations,
  productOptionTranslations,
  productTicketSettings,
  productTranslations,
  productVisibilitySettings,
} from "./schema-settings.js"
import {
  destinations,
  destinationTranslations,
  productCategories,
  productCategoryProducts,
  productDestinations,
  productTagProducts,
  productTags,
  productTypes,
} from "./schema-taxonomy.js"

export const productsRelations = relations(products, ({ one, many }) => ({
  productType: one(productTypes, {
    fields: [products.productTypeId],
    references: [productTypes.id],
  }),
  activationSettings: many(productActivationSettings),
  ticketSettings: many(productTicketSettings),
  visibilitySettings: many(productVisibilitySettings),
  capabilities: many(productCapabilities),
  deliveryFormats: many(productDeliveryFormats),
  features: many(productFeatures),
  faqs: many(productFaqs),
  locations: many(productLocations),
  components: many(productComponents),
  options: many(productOptions),
  itineraries: many(productItineraries),
  translations: many(productTranslations),
  versions: many(productVersions),
  notes: many(productNotes),
  media: many(productMedia),
  categoryLinks: many(productCategoryProducts),
  destinationLinks: many(productDestinations),
  tagLinks: many(productTagProducts),
}))

export const productComponentsRelations = relations(productComponents, ({ one }) => ({
  product: one(products, {
    fields: [productComponents.productId],
    references: [products.id],
  }),
}))

export const productOptionsRelations = relations(productOptions, ({ one, many }) => ({
  product: one(products, { fields: [productOptions.productId], references: [products.id] }),
  translations: many(productOptionTranslations),
  units: many(optionUnits),
}))

export const optionUnitsRelations = relations(optionUnits, ({ one, many }) => ({
  option: one(productOptions, { fields: [optionUnits.optionId], references: [productOptions.id] }),
  translations: many(optionUnitTranslations),
}))

export const productActivationSettingsRelations = relations(
  productActivationSettings,
  ({ one }) => ({
    product: one(products, {
      fields: [productActivationSettings.productId],
      references: [products.id],
    }),
  }),
)

export const productTicketSettingsRelations = relations(productTicketSettings, ({ one }) => ({
  product: one(products, {
    fields: [productTicketSettings.productId],
    references: [products.id],
  }),
}))

export const productVisibilitySettingsRelations = relations(
  productVisibilitySettings,
  ({ one }) => ({
    product: one(products, {
      fields: [productVisibilitySettings.productId],
      references: [products.id],
    }),
  }),
)

export const productCapabilitiesRelations = relations(productCapabilities, ({ one }) => ({
  product: one(products, {
    fields: [productCapabilities.productId],
    references: [products.id],
  }),
}))

export const productDeliveryFormatsRelations = relations(productDeliveryFormats, ({ one }) => ({
  product: one(products, {
    fields: [productDeliveryFormats.productId],
    references: [products.id],
  }),
}))

export const productFeaturesRelations = relations(productFeatures, ({ one }) => ({
  product: one(products, {
    fields: [productFeatures.productId],
    references: [products.id],
  }),
}))

export const productFaqsRelations = relations(productFaqs, ({ one }) => ({
  product: one(products, {
    fields: [productFaqs.productId],
    references: [products.id],
  }),
}))

export const productLocationsRelations = relations(productLocations, ({ one }) => ({
  product: one(products, {
    fields: [productLocations.productId],
    references: [products.id],
  }),
}))

export const productTranslationsRelations = relations(productTranslations, ({ one }) => ({
  product: one(products, {
    fields: [productTranslations.productId],
    references: [products.id],
  }),
}))

export const productOptionTranslationsRelations = relations(
  productOptionTranslations,
  ({ one }) => ({
    option: one(productOptions, {
      fields: [productOptionTranslations.optionId],
      references: [productOptions.id],
    }),
  }),
)

export const optionUnitTranslationsRelations = relations(optionUnitTranslations, ({ one }) => ({
  unit: one(optionUnits, {
    fields: [optionUnitTranslations.unitId],
    references: [optionUnits.id],
  }),
}))

export const productItinerariesRelations = relations(productItineraries, ({ one, many }) => ({
  product: one(products, {
    fields: [productItineraries.productId],
    references: [products.id],
  }),
  days: many(productDays),
}))

export const productDaysRelations = relations(productDays, ({ one, many }) => ({
  itinerary: one(productItineraries, {
    fields: [productDays.itineraryId],
    references: [productItineraries.id],
  }),
  services: many(productDayServices),
  media: many(productMedia),
}))

export const productDayServicesRelations = relations(productDayServices, ({ one }) => ({
  day: one(productDays, { fields: [productDayServices.dayId], references: [productDays.id] }),
}))

export const productVersionsRelations = relations(productVersions, ({ one }) => ({
  product: one(products, { fields: [productVersions.productId], references: [products.id] }),
}))

export const productNotesRelations = relations(productNotes, ({ one }) => ({
  product: one(products, { fields: [productNotes.productId], references: [products.id] }),
}))

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
  day: one(productDays, { fields: [productMedia.dayId], references: [productDays.id] }),
}))

export const productTypesRelations = relations(productTypes, ({ many }) => ({
  products: many(products),
}))

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
  parent: one(destinations, {
    fields: [destinations.parentId],
    references: [destinations.id],
    relationName: "destinationParentChild",
  }),
  children: many(destinations, { relationName: "destinationParentChild" }),
  translations: many(destinationTranslations),
  productLinks: many(productDestinations),
}))

export const destinationTranslationsRelations = relations(destinationTranslations, ({ one }) => ({
  destination: one(destinations, {
    fields: [destinationTranslations.destinationId],
    references: [destinations.id],
  }),
}))

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  parent: one(productCategories, {
    fields: [productCategories.parentId],
    references: [productCategories.id],
    relationName: "parentChild",
  }),
  children: many(productCategories, { relationName: "parentChild" }),
  productLinks: many(productCategoryProducts),
}))

export const productTagsRelations = relations(productTags, ({ many }) => ({
  productLinks: many(productTagProducts),
}))

export const productCategoryProductsRelations = relations(productCategoryProducts, ({ one }) => ({
  product: one(products, {
    fields: [productCategoryProducts.productId],
    references: [products.id],
  }),
  category: one(productCategories, {
    fields: [productCategoryProducts.categoryId],
    references: [productCategories.id],
  }),
}))

export const productTagProductsRelations = relations(productTagProducts, ({ one }) => ({
  product: one(products, {
    fields: [productTagProducts.productId],
    references: [products.id],
  }),
  tag: one(productTags, {
    fields: [productTagProducts.tagId],
    references: [productTags.id],
  }),
}))

export const productDestinationsRelations = relations(productDestinations, ({ one }) => ({
  product: one(products, {
    fields: [productDestinations.productId],
    references: [products.id],
  }),
  destination: one(destinations, {
    fields: [productDestinations.destinationId],
    references: [destinations.id],
  }),
}))
