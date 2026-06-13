import {
  renderStructuredTemplate,
  type StructuredTemplateBodyFormat,
} from "@voyantjs/utils/template-renderer"
import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { productDayServices, productDays, productItineraries, products } from "../schema.js"

type ProductDayRecord = typeof productDays.$inferSelect
type ProductDayServiceRecord = typeof productDayServices.$inferSelect
type ProductRecord = typeof products.$inferSelect

export interface ProductBrochureDayContext extends ProductDayRecord {
  services: Array<ProductDayServiceRecord>
}

export interface ProductBrochureTemplateContext {
  product: ProductRecord
  days: ProductBrochureDayContext[]
  generatedAt: Date
}

type TemplateResolver<T> = T | ((context: ProductBrochureTemplateContext) => Promise<T> | T)

export interface ProductBrochureTemplateDefinition {
  bodyFormat: StructuredTemplateBodyFormat
  body: TemplateResolver<string>
  variables?:
    | Record<string, unknown>
    | ((
        context: ProductBrochureTemplateContext,
      ) => Promise<Record<string, unknown>> | Record<string, unknown>)
  title?: TemplateResolver<string>
  filename?: TemplateResolver<string>
  metadataLines?: TemplateResolver<string[]>
}

export interface RenderedProductBrochureTemplate {
  body: string
  bodyFormat: StructuredTemplateBodyFormat
  title: string
  filename: string
  variables: Record<string, unknown>
  metadataLines: string[]
}

async function resolveTemplateValue<T>(
  value: TemplateResolver<T> | undefined,
  context: ProductBrochureTemplateContext,
): Promise<T | undefined> {
  if (typeof value === "function") {
    return await (value as (context: ProductBrochureTemplateContext) => Promise<T> | T)(context)
  }

  return value
}

function normalizeFilename(value: string | undefined, productName: string) {
  const fallback = `${productName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
  const trimmed = value?.trim()
  return trimmed || fallback
}

export async function loadProductBrochureTemplateContext(
  db: PostgresJsDatabase,
  productId: string,
): Promise<ProductBrochureTemplateContext> {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)

  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }

  const [defaultItinerary] = await db
    .select({ id: productItineraries.id })
    .from(productItineraries)
    .where(and(eq(productItineraries.productId, productId), eq(productItineraries.isDefault, true)))
    .limit(1)

  if (!defaultItinerary) {
    return {
      product,
      days: [],
      generatedAt: new Date(),
    }
  }

  const days = await db
    .select()
    .from(productDays)
    .where(eq(productDays.itineraryId, defaultItinerary.id))
    .orderBy(asc(productDays.dayNumber))

  const daysWithServices = await Promise.all(
    days.map(async (day) => {
      const services = await db
        .select()
        .from(productDayServices)
        .where(eq(productDayServices.dayId, day.id))
        .orderBy(asc(productDayServices.sortOrder))

      return {
        ...day,
        services,
      }
    }),
  )

  return {
    product,
    days: daysWithServices,
    generatedAt: new Date(),
  }
}

export function createDefaultProductBrochureTemplate(): ProductBrochureTemplateDefinition {
  return {
    bodyFormat: "markdown",
    title: ({ product }) => product.name,
    filename: ({ product }) => `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    metadataLines: ({ product, generatedAt }) => [
      `Product ID: ${product.id}`,
      `Generated: ${generatedAt.toISOString()}`,
    ],
    body: [
      "# {{ product.name }}",
      "",
      "{% if product.startDate or product.endDate %}",
      "Dates: {{ product.startDate | default: 'TBD' }} - {{ product.endDate | default: 'TBD' }}",
      "{% endif %}",
      "{% if product.pax %}",
      "Travelers: {{ product.pax }}",
      "{% endif %}",
      "{% if product.sellAmountCents %}",
      "Total: {{ product.sellAmountCents | divided_by: 100.0 }} {{ product.sellCurrency }}",
      "{% endif %}",
      "",
      "{% if product.description %}{{ product.description }}{% endif %}",
      "",
      "{% for day in days %}",
      "## Day {{ day.dayNumber }}{% if day.title %}: {{ day.title }}{% endif %}",
      "{% if day.location %}Location: {{ day.location }}{% endif %}",
      "{% if day.description %}{{ day.description }}{% endif %}",
      "",
      "{% for service in day.services %}",
      "- {{ service.name }} ({{ service.serviceType }}){% if service.quantity > 1 %} x{{ service.quantity }}{% endif %}",
      "{% if service.notes %}  {{ service.notes }}{% endif %}",
      "{% endfor %}",
      "",
      "{% endfor %}",
    ].join("\n"),
  }
}

export async function renderProductBrochureTemplate(
  template: ProductBrochureTemplateDefinition,
  context: ProductBrochureTemplateContext,
): Promise<RenderedProductBrochureTemplate> {
  const rawBody = (await resolveTemplateValue(template.body, context)) ?? ""
  const variables = (await resolveTemplateValue(template.variables, context)) ?? {
    product: context.product,
    days: context.days,
    generatedAt: context.generatedAt.toISOString(),
  }
  const title =
    (await resolveTemplateValue(template.title, context))?.trim() || context.product.name
  const filename = normalizeFilename(
    await resolveTemplateValue(template.filename, context),
    context.product.name,
  )
  const metadataLines = (await resolveTemplateValue(template.metadataLines, context)) ?? []

  return {
    body: renderStructuredTemplate(rawBody, template.bodyFormat, variables),
    bodyFormat: template.bodyFormat,
    title,
    filename,
    variables,
    metadataLines,
  }
}
