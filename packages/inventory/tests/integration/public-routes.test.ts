// agent-quality: file-size exception -- owner: products; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { publicProductRoutes } from "../../src/routes-public.js"
import {
  productCapabilities,
  productCategories,
  productCategoryProducts,
  productFaqs,
  productFeatures,
  productLocations,
  productMedia,
  products,
  productTagProducts,
  productTags,
  productTranslations,
  productTypes,
  productVisibilitySettings,
} from "../../src/schema.js"
import { catalogProductsService } from "../../src/service-catalog.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const CUSTOMER_TEMPLATE_ID = "ctpl_01j00000000000000000000000"

async function ensureBrochureColumns(db: PostgresJsDatabase) {
  const statements: SQL[] = [
    sql`ALTER TABLE product_media ADD COLUMN IF NOT EXISTS is_brochure_current boolean DEFAULT false NOT NULL`,
    sql`ALTER TABLE product_media ADD COLUMN IF NOT EXISTS brochure_version integer`,
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS inclusions_html text`,
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS exclusions_html text`,
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS terms_html text`,
    sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS contract_template_id text`,
    sql`ALTER TABLE product_translations ADD COLUMN IF NOT EXISTS inclusions_html text`,
    sql`ALTER TABLE product_translations ADD COLUMN IF NOT EXISTS exclusions_html text`,
    sql`CREATE TABLE IF NOT EXISTS destinations (
      id text PRIMARY KEY NOT NULL,
      parent_id text,
      slug text NOT NULL,
      code text,
      canonical_place_id text,
      destination_type text DEFAULT 'destination' NOT NULL,
      latitude double precision,
      longitude double precision,
      sort_order integer DEFAULT 0 NOT NULL,
      active boolean DEFAULT true NOT NULL,
      metadata jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )`,
    sql`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS canonical_place_id text`,
    sql`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS latitude double precision`,
    sql`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS longitude double precision`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_destinations_slug ON destinations (slug)`,
    sql`CREATE TABLE IF NOT EXISTS destination_translations (
      id text PRIMARY KEY NOT NULL,
      destination_id text NOT NULL,
      language_tag text NOT NULL,
      name text NOT NULL,
      description text,
      seo_title text,
      seo_description text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_destination_translations_locale
      ON destination_translations (destination_id, language_tag)`,
    sql`CREATE TABLE IF NOT EXISTS product_destinations (
      product_id text NOT NULL,
      destination_id text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      PRIMARY KEY (product_id, destination_id)
    )`,
  ]

  for (const statement of statements) {
    await db.execute(statement)
  }
}

describe.skipIf(!DB_AVAILABLE)("Public product routes", () => {
  let app: Hono
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await ensureBrochureColumns(db)
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", publicProductRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  it("lists only storefront-visible products with catalog relations", async () => {
    const [productType] = await db
      .insert(productTypes)
      .values({ name: "Tour", code: "tour", active: true })
      .returning()

    const [category] = await db
      .insert(productCategories)
      .values({ name: "City Breaks", slug: "city-breaks", active: true })
      .returning()

    const [tag] = await db.insert(productTags).values({ name: "Family" }).returning()

    const [publicProduct] = await db
      .insert(products)
      .values({
        name: "Barcelona Weekend",
        description: "A curated city break itinerary.",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
        sellAmountCents: 49900,
        productTypeId: productType.id,
        contractTemplateId: CUSTOMER_TEMPLATE_ID,
      })
      .returning()

    await db.insert(productCategoryProducts).values({
      productId: publicProduct.id,
      categoryId: category.id,
    })
    await db.insert(productTagProducts).values({ productId: publicProduct.id, tagId: tag.id })
    await db.insert(productCapabilities).values({
      productId: publicProduct.id,
      capability: "instant_confirmation",
      enabled: true,
    })
    await db.insert(productVisibilitySettings).values({
      productId: publicProduct.id,
      isSearchable: true,
      isBookable: true,
      isFeatured: true,
    })
    await db.insert(productMedia).values({
      productId: publicProduct.id,
      mediaType: "image",
      name: "Cover",
      url: "https://example.com/barcelona.jpg",
      isCover: true,
    })
    await db.insert(productLocations).values({
      productId: publicProduct.id,
      locationType: "start",
      title: "Barcelona Airport",
      city: "Barcelona",
      countryCode: "ES",
    })

    await db.insert(products).values({
      name: "Internal Product",
      status: "active",
      activated: true,
      visibility: "private",
      sellCurrency: "EUR",
    })

    const res = await app.request("/", { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.name).toBe("Barcelona Weekend")
    expect(body.data[0]?.productType?.code).toBe("tour")
    expect(body.data[0]?.categories[0]?.slug).toBe("city-breaks")
    expect(body.data[0]?.tags[0]?.name).toBe("Family")
    expect(body.data[0]?.coverMedia?.url).toContain("barcelona")
    expect(body.data[0]?.locations[0]?.city).toBe("Barcelona")
    expect(body.data[0]?.isFeatured).toBe(true)
    expect(body.data[0]?.contractTemplateId).toBe(CUSTOMER_TEMPLATE_ID)
  })

  it("filters public catalog products by location fields", async () => {
    const [barcelonaProduct] = await db
      .insert(products)
      .values({
        name: "Barcelona Weekend",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [romeProduct] = await db
      .insert(products)
      .values({
        name: "Rome Escape",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(productLocations).values([
      {
        productId: barcelonaProduct.id,
        locationType: "start",
        title: "Barcelona Airport",
        city: "Barcelona",
        countryCode: "ES",
      },
      {
        productId: romeProduct.id,
        locationType: "start",
        title: "Rome Airport",
        city: "Rome",
        countryCode: "IT",
      },
    ])

    const byCityRes = await app.request("/?locationCity=Barcelona", { method: "GET" })
    expect(byCityRes.status).toBe(200)
    const byCityBody = await byCityRes.json()
    expect(byCityBody.total).toBe(1)
    expect(byCityBody.data[0]?.id).toBe(barcelonaProduct.id)

    const byCountryRes = await app.request("/?locationCountryCode=it", { method: "GET" })
    expect(byCountryRes.status).toBe(200)
    const byCountryBody = await byCountryRes.json()
    expect(byCountryBody.total).toBe(1)
    expect(byCountryBody.data[0]?.id).toBe(romeProduct.id)

    const byTypeRes = await app.request("/?locationType=start&locationTitle=Barcelona Airport", {
      method: "GET",
    })
    expect(byTypeRes.status).toBe(200)
    const byTypeBody = await byTypeRes.json()
    expect(byTypeBody.total).toBe(1)
    expect(byTypeBody.data[0]?.id).toBe(barcelonaProduct.id)
  })

  it("filters public catalog products by destination slug and lists localized destinations", async () => {
    const [barcelonaProduct] = await db
      .insert(products)
      .values({
        name: "Barcelona Weekend",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    const [romeProduct] = await db
      .insert(products)
      .values({
        name: "Rome Escape",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.execute(sql`
      INSERT INTO destinations (id, slug, destination_type, sort_order)
      VALUES ('dest_barcelona', 'barcelona', 'city', 0),
             ('dest_rome', 'rome', 'city', 1)
      ON CONFLICT (id) DO NOTHING
    `)
    await db.execute(sql`
      INSERT INTO destination_translations (id, destination_id, language_tag, name)
      VALUES ('dtrn_barcelona_ro', 'dest_barcelona', 'ro', 'Barcelona'),
             ('dtrn_rome_ro', 'dest_rome', 'ro', 'Roma')
      ON CONFLICT (destination_id, language_tag) DO NOTHING
    `)
    await db.execute(sql`
      INSERT INTO product_destinations (product_id, destination_id, sort_order)
      VALUES (${barcelonaProduct.id}, 'dest_barcelona', 0),
             (${romeProduct.id}, 'dest_rome', 0)
      ON CONFLICT (product_id, destination_id) DO NOTHING
    `)

    const bySlugRes = await app.request("/?destinationSlug=barcelona&languageTag=ro", {
      method: "GET",
    })
    expect(bySlugRes.status).toBe(200)
    const bySlugBody = await bySlugRes.json()
    expect(bySlugBody.total).toBe(1)
    expect(bySlugBody.data[0]?.id).toBe(barcelonaProduct.id)
    expect(bySlugBody.data[0]?.destinations[0]?.name).toBe("Barcelona")

    const destinationListRes = await app.request("/destinations?languageTag=ro", { method: "GET" })
    expect(destinationListRes.status).toBe(200)
    const destinationListBody = await destinationListRes.json()
    expect(destinationListBody.total).toBe(2)
    expect(destinationListBody.data[0]?.slug).toBe("barcelona")
  })

  it("returns hydrated public product detail", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Danube Cruise",
        description: "River cruise through major capitals.",
        inclusionsHtml: "<p>Transfers included</p>",
        exclusionsHtml: "<p>Flights excluded</p>",
        termsHtml: "<p>Standard cruise terms</p>",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(productMedia).values({
      productId: product.id,
      mediaType: "image",
      name: "Gallery",
      url: "https://example.com/danube.jpg",
      isCover: true,
    })
    await db.insert(productMedia).values({
      productId: product.id,
      mediaType: "document",
      name: "Danube brochure",
      url: "https://example.com/danube.pdf",
      mimeType: "application/pdf",
      isBrochure: true,
      isBrochureCurrent: true,
      brochureVersion: 2,
    })
    await db.insert(productFeatures).values({
      productId: product.id,
      featureType: "highlight",
      title: "Premium cabin",
    })
    await db.insert(productFaqs).values({
      productId: product.id,
      question: "Are transfers included?",
      answer: "Yes.",
    })
    await db.insert(productLocations).values({
      productId: product.id,
      locationType: "start",
      title: "Budapest Port",
      city: "Budapest",
      countryCode: "HU",
    })

    const res = await app.request(`/${product.id}`, { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(product.id)
    expect(body.data.inclusionsHtml).toBe("<p>Transfers included</p>")
    expect(body.data.exclusionsHtml).toBe("<p>Flights excluded</p>")
    expect(body.data.termsHtml).toBe("<p>Standard cruise terms</p>")
    expect(body.data.brochure?.url).toContain("danube.pdf")
    expect(body.data.media).toHaveLength(1)
    expect(body.data.features[0]?.title).toBe("Premium cabin")
    expect(body.data.faqs[0]?.answer).toBe("Yes.")
    expect(body.data.locations[0]?.city).toBe("Budapest")
  })

  it("returns the canonical public product brochure", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Northern Lights",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(productMedia).values({
      productId: product.id,
      mediaType: "document",
      name: "Northern Lights brochure v1",
      url: "https://example.com/northern-lights-v1.pdf",
      mimeType: "application/pdf",
      isBrochure: true,
      isBrochureCurrent: false,
      brochureVersion: 1,
    })
    await db.insert(productMedia).values({
      productId: product.id,
      mediaType: "document",
      name: "Northern Lights brochure v2",
      url: "https://example.com/northern-lights-v2.pdf",
      mimeType: "application/pdf",
      isBrochure: true,
      isBrochureCurrent: true,
      brochureVersion: 2,
    })

    const res = await app.request(`/${product.id}/brochure`, { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe("Northern Lights brochure v2")
    expect(body.data.isBrochure).toBe(true)
    expect(body.data.isBrochureCurrent).toBe(true)
    expect(body.data.brochureVersion).toBe(2)
  })

  it("returns localized public catalog fields and slug lookup", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Danube Cruise",
        description: "River cruise through major capitals.",
        inclusionsHtml: "<p>Default inclusions</p>",
        exclusionsHtml: "<p>Default exclusions</p>",
        termsHtml: "<p>Default terms</p>",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(productTranslations).values({
      productId: product.id,
      languageTag: "ro",
      slug: "croaziera-dunare",
      name: "Croaziera pe Dunare",
      shortDescription: "Croaziera fluviala prin capitale europene.",
      description: "Itinerar localizat pentru croaziera pe Dunare.",
      inclusionsHtml: "<p>Incluse localizate</p>",
      exclusionsHtml: "<p>Excluse localizate</p>",
      termsHtml: "<p>Termeni localizati</p>",
      seoTitle: "Croaziera pe Dunare",
      seoDescription: "Rezerva croaziera pe Dunare.",
    })

    const detailRes = await app.request(`/${product.id}?languageTag=ro`, { method: "GET" })
    expect(detailRes.status).toBe(200)
    const detailBody = await detailRes.json()
    expect(detailBody.data.name).toBe("Croaziera pe Dunare")
    expect(detailBody.data.slug).toBe("croaziera-dunare")
    expect(detailBody.data.inclusionsHtml).toBe("<p>Incluse localizate</p>")
    expect(detailBody.data.exclusionsHtml).toBe("<p>Excluse localizate</p>")
    expect(detailBody.data.termsHtml).toBe("<p>Termeni localizati</p>")
    expect(detailBody.data.seoTitle).toBe("Croaziera pe Dunare")
    expect(detailBody.data.contentLanguageTag).toBe("ro")

    const slugRes = await app.request("/slug/croaziera-dunare?languageTag=ro", { method: "GET" })
    expect(slugRes.status).toBe(200)
    const slugBody = await slugRes.json()
    expect(slugBody.data.id).toBe(product.id)
    expect(slugBody.data.shortDescription).toBe("Croaziera fluviala prin capitale europene.")
  })

  it("resolves slug lookups through the same locale fallback as public catalog search", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Danube Cruise",
        description: "River cruise through major capitals.",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(productTranslations).values({
      productId: product.id,
      languageTag: "ro",
      slug: "croaziera-dunare",
      name: "Croaziera pe Dunare",
      shortDescription: "Croaziera fluviala premium.",
      description: "Descriere localizata pentru croaziera pe Dunare.",
      seoTitle: "Croaziera pe Dunare",
      seoDescription: "Rezerva croaziera pe Dunare.",
    })

    const searchDocuments = await catalogProductsService.listSearchDocuments(db, {
      languageTag: "fr",
      limit: 50,
      offset: 0,
    })

    expect(searchDocuments.data[0]).toEqual(
      expect.objectContaining({
        productId: product.id,
        languageTag: "ro",
        slug: "croaziera-dunare",
      }),
    )

    const slugRes = await app.request("/slug/croaziera-dunare?languageTag=fr", {
      method: "GET",
    })

    expect(slugRes.status).toBe(200)
    const slugBody = await slugRes.json()
    expect(slugBody.data.id).toBe(product.id)
    expect(slugBody.data.contentLanguageTag).toBe("ro")
    expect(slugBody.data.slug).toBe("croaziera-dunare")
  })

  it("builds localized search documents for indexing with translation fallback", async () => {
    const [product] = await db
      .insert(products)
      .values({
        name: "Danube Cruise",
        description: "River cruise through major capitals.",
        status: "active",
        activated: true,
        visibility: "public",
        sellCurrency: "EUR",
        sellAmountCents: 79900,
      })
      .returning()

    const [category] = await db
      .insert(productCategories)
      .values({ name: "Cruises", slug: "cruises", active: true })
      .returning()
    const [tag] = await db.insert(productTags).values({ name: "River" }).returning()

    await db.insert(productCategoryProducts).values({
      productId: product.id,
      categoryId: category.id,
    })
    await db.insert(productTagProducts).values({ productId: product.id, tagId: tag.id })
    await db.insert(productCapabilities).values({
      productId: product.id,
      capability: "instant_confirmation",
      enabled: true,
    })
    await db.insert(productVisibilitySettings).values({
      productId: product.id,
      isSearchable: true,
      isFeatured: true,
    })
    await db.insert(productMedia).values({
      productId: product.id,
      mediaType: "image",
      name: "Cover",
      url: "https://example.com/danube-cover.jpg",
      isCover: true,
    })
    await db.insert(productLocations).values({
      productId: product.id,
      locationType: "start",
      title: "Budapest",
      city: "Budapest",
      countryCode: "HU",
    })
    await db.insert(productTranslations).values({
      productId: product.id,
      languageTag: "ro",
      slug: "croaziera-dunare",
      name: "Croaziera pe Dunare",
      shortDescription: "Croaziera fluviala premium.",
      description: "Descriere localizata pentru croaziera pe Dunare.",
      seoTitle: "Croaziera pe Dunare",
      seoDescription: "Rezerva croaziera pe Dunare.",
    })

    const result = await catalogProductsService.listSearchDocuments(db, {
      languageTag: "fr",
      limit: 50,
      offset: 0,
    })

    expect(result.total).toBe(1)
    expect(result.data).toEqual([
      expect.objectContaining({
        id: `${product.id}:ro`,
        productId: product.id,
        languageTag: "ro",
        name: "Croaziera pe Dunare",
        slug: "croaziera-dunare",
        shortDescription: "Croaziera fluviala premium.",
        seoTitle: "Croaziera pe Dunare",
        categoryIds: [category.id],
        categoryNames: ["Cruises"],
        categorySlugs: ["cruises"],
        tagIds: [tag.id],
        tagNames: ["River"],
        capabilities: ["instant_confirmation"],
        locationTitles: ["Budapest"],
        locationCities: ["Budapest"],
        locationCountryCodes: ["HU"],
        coverMediaUrl: "https://example.com/danube-cover.jpg",
        isFeatured: true,
      }),
    ])

    const single = await catalogProductsService.getSearchDocumentByProductId(db, product.id, {
      languageTag: "fr",
    })
    expect(single?.id).toBe(`${product.id}:ro`)
  })

  it("lists active public categories and tags", async () => {
    await db.insert(productCategories).values([
      { name: "Beach", slug: "beach", active: true },
      { name: "Hidden", slug: "hidden", active: false },
    ])
    await db.insert(productTags).values([{ name: "Summer" }, { name: "Adventure" }])

    const categoriesRes = await app.request("/categories", { method: "GET" })
    expect(categoriesRes.status).toBe(200)
    const categoriesBody = await categoriesRes.json()
    expect(categoriesBody.total).toBe(1)
    expect(categoriesBody.data[0]?.slug).toBe("beach")

    const tagsRes = await app.request("/tags", { method: "GET" })
    expect(tagsRes.status).toBe(200)
    const tagsBody = await tagsRes.json()
    expect(tagsBody.total).toBe(2)
    expect(tagsBody.data.map((tag: { name: string }) => tag.name)).toEqual(["Adventure", "Summer"])
  })
})
