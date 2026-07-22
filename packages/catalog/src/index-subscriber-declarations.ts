export const catalogIndexSubscriberDeclarations = [
  {
    id: "@voyant-travel/catalog#subscriber.index-product-created",
    eventType: "product.created",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-updated",
    eventType: "product.updated",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.delete-product",
    eventType: "product.deleted",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-content-changed",
    eventType: "product.content.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-availability-changed",
    eventType: "availability.slot.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-pricing-changed",
    eventType: "pricing.rule.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-publication-changed",
    eventType: "product.publication.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-product-promotion-changed",
    eventType: "promotion.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
  {
    id: "@voyant-travel/catalog#subscriber.index-entity-overlay-changed",
    eventType: "catalog.entity.overlay.changed",
    source: "@voyant-travel/catalog/index-subscribers",
  },
] as const
