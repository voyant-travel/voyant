import {
  brochureBodyToHtmlFragment,
  isBasicPdfProductBrochurePrinter,
  type ProductBrochurePrinter,
} from "./brochure-printers.js"
import type {
  ProductBrochureTemplateContext,
  RenderedProductBrochureTemplate,
} from "./brochure-templates.js"
import { renderThemedBrochureStyles } from "./brochure-themed-styles.js"

export interface ThemedBrochureTheme {
  brandName?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
  surfaceColor?: string | null
  textColor?: string | null
  mutedTextColor?: string | null
  borderColor?: string | null
  fontFamily?: string | null
  footerText?: string | null
}

type ResolvedThemedBrochureTheme = {
  [Key in keyof Required<ThemedBrochureTheme>]: string
}

export interface ThemedBrochureRenderInput {
  template: RenderedProductBrochureTemplate
  context: ProductBrochureTemplateContext
  theme: ResolvedThemedBrochureTheme
}

export interface ThemedBrochureSection {
  id: string
  render: (input: ThemedBrochureRenderInput) => string | null | undefined
}

export interface RenderThemedBrochureHtmlOptions {
  theme?: ThemedBrochureTheme
  /**
   * Replaces the default brochure section set. Use this for a full redesign
   * while keeping the shared print pipeline.
   */
  sections?: ReadonlyArray<ThemedBrochureSection>
  /** Appends sections after the default or replacement section set. */
  additionalSections?: ReadonlyArray<ThemedBrochureSection>
}

export interface CreateThemedBrochurePrinterOptions extends RenderThemedBrochureHtmlOptions {
  printer: ProductBrochurePrinter
}

const DEFAULT_THEME: ResolvedThemedBrochureTheme = {
  brandName: "Voyant",
  logoUrl: "",
  primaryColor: "#172554",
  accentColor: "#0f766e",
  backgroundColor: "#f8fafc",
  surfaceColor: "#ffffff",
  textColor: "#111827",
  mutedTextColor: "#64748b",
  borderColor: "#dbe3ef",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  footerText: "",
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function safeCssValue(value: string) {
  return value.replace(/[<>{};]/g, "").trim()
}

function resolveTheme(theme?: ThemedBrochureTheme): ResolvedThemedBrochureTheme {
  return {
    brandName: theme?.brandName?.trim() || DEFAULT_THEME.brandName,
    logoUrl: theme?.logoUrl?.trim() || DEFAULT_THEME.logoUrl,
    primaryColor: safeCssValue(theme?.primaryColor || DEFAULT_THEME.primaryColor),
    accentColor: safeCssValue(theme?.accentColor || DEFAULT_THEME.accentColor),
    backgroundColor: safeCssValue(theme?.backgroundColor || DEFAULT_THEME.backgroundColor),
    surfaceColor: safeCssValue(theme?.surfaceColor || DEFAULT_THEME.surfaceColor),
    textColor: safeCssValue(theme?.textColor || DEFAULT_THEME.textColor),
    mutedTextColor: safeCssValue(theme?.mutedTextColor || DEFAULT_THEME.mutedTextColor),
    borderColor: safeCssValue(theme?.borderColor || DEFAULT_THEME.borderColor),
    fontFamily: safeCssValue(theme?.fontFamily || DEFAULT_THEME.fontFamily),
    footerText: theme?.footerText?.trim() || DEFAULT_THEME.footerText,
  }
}

function safeUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) return null

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatMoney(amountCents: number | null | undefined, currency: string | null | undefined) {
  if (amountCents == null || !currency) return null

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amountCents / 100)
}

function renderCoverSection({ context, theme }: ThemedBrochureRenderInput) {
  const { product } = context
  const cover = context.media.find((item) => item.mediaType === "image" && item.isCover)
  const coverUrl = safeUrl(cover?.url)
  const logoUrl = safeUrl(theme.logoUrl)
  const dates = [formatDate(product.startDate), formatDate(product.endDate)]
    .filter(Boolean)
    .join(" - ")
  const price = formatMoney(product.sellAmountCents, product.sellCurrency)

  return [
    '<section class="brochure-cover">',
    coverUrl
      ? `<img class="cover-image" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(cover?.altText || cover?.name || product.name)}" />`
      : "",
    '<div class="cover-copy">',
    '<div class="brand-row">',
    logoUrl
      ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(theme.brandName)}" />`
      : "",
    `<span>${escapeHtml(theme.brandName)}</span>`,
    "</div>",
    `<h1>${escapeHtml(product.name)}</h1>`,
    product.description ? `<p class="dek">${escapeHtml(product.description)}</p>` : "",
    '<dl class="cover-facts">',
    dates ? `<div><dt>Dates</dt><dd>${escapeHtml(dates)}</dd></div>` : "",
    product.pax ? `<div><dt>Travelers</dt><dd>${escapeHtml(String(product.pax))}</dd></div>` : "",
    price ? `<div><dt>From</dt><dd>${escapeHtml(price)}</dd></div>` : "",
    "</dl>",
    "</div>",
    "</section>",
  ].join("")
}

function renderOverviewSection({ template }: ThemedBrochureRenderInput) {
  const body = brochureBodyToHtmlFragment(template.body, template.bodyFormat)

  if (!body.trim()) return null

  return [
    '<section class="brochure-section overview">',
    "<h2>Overview</h2>",
    `<div class="rich-body">${body}</div>`,
    "</section>",
  ].join("")
}

function renderMediaSection({ context }: ThemedBrochureRenderInput) {
  const images = context.media
    .filter((item) => item.mediaType === "image" && !item.isBrochure)
    .map((item) => ({ item, url: safeUrl(item.url) }))
    .filter((entry): entry is { item: (typeof context.media)[number]; url: string } =>
      Boolean(entry.url),
    )

  if (images.length === 0) return null

  return [
    '<section class="brochure-section media-grid-section">',
    "<h2>Gallery</h2>",
    '<div class="media-grid">',
    ...images
      .slice(0, 6)
      .map(
        ({ item, url }) =>
          `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(item.altText || item.name)}" /><figcaption>${escapeHtml(item.name)}</figcaption></figure>`,
      ),
    "</div>",
    "</section>",
  ].join("")
}

function renderItinerarySection({ context }: ThemedBrochureRenderInput) {
  if (context.days.length === 0) return null

  return [
    '<section class="brochure-section itinerary">',
    "<h2>Itinerary</h2>",
    ...context.days.map((day) =>
      [
        '<article class="day">',
        `<div class="day-number">Day ${escapeHtml(String(day.dayNumber))}</div>`,
        '<div class="day-content">',
        `<h3>${escapeHtml(day.title || day.location || `Day ${day.dayNumber}`)}</h3>`,
        day.location ? `<p class="muted">${escapeHtml(day.location)}</p>` : "",
        day.description ? `<p>${escapeHtml(day.description)}</p>` : "",
        day.services.length > 0
          ? [
              "<ul>",
              ...day.services.map((service) =>
                [
                  "<li>",
                  `<strong>${escapeHtml(service.name)}</strong>`,
                  ` <span>${escapeHtml(service.serviceType)}</span>`,
                  service.quantity > 1
                    ? ` <span>x${escapeHtml(String(service.quantity))}</span>`
                    : "",
                  service.notes ? `<p>${escapeHtml(service.notes)}</p>` : "",
                  "</li>",
                ].join(""),
              ),
              "</ul>",
            ].join("")
          : "",
        "</div>",
        "</article>",
      ].join(""),
    ),
    "</section>",
  ].join("")
}

function renderPricingSection({ context }: ThemedBrochureRenderInput) {
  if (context.pricingTiers.length === 0) return null

  return [
    '<section class="brochure-section pricing">',
    "<h2>Pricing</h2>",
    "<table>",
    "<thead><tr><th>Occupancy</th><th>Price per traveler</th><th>Promotional price</th><th>Valid</th></tr></thead>",
    "<tbody>",
    ...context.pricingTiers.map((tier) => {
      const effective = [formatDate(tier.effectiveFrom), formatDate(tier.effectiveTo)]
        .filter(Boolean)
        .join(" - ")

      return [
        "<tr>",
        `<td>${escapeHtml(String(tier.tierPax))}</td>`,
        `<td>${escapeHtml(formatMoney(tier.pricePerPaxCents, context.product.sellCurrency) ?? "On request")}</td>`,
        `<td>${escapeHtml(formatMoney(tier.promoPricePerPaxCents, context.product.sellCurrency) ?? "-")}</td>`,
        `<td>${escapeHtml(effective || "Always")}</td>`,
        "</tr>",
      ].join("")
    }),
    "</tbody>",
    "</table>",
    "</section>",
  ].join("")
}

function renderHtmlListSection(title: string, html: string | null | undefined) {
  if (!html?.trim()) return null

  return [
    '<section class="brochure-section policy">',
    `<h2>${escapeHtml(title)}</h2>`,
    `<div class="rich-body">${brochureBodyToHtmlFragment(html, "markdown")}</div>`,
    "</section>",
  ].join("")
}

export const defaultThemedBrochureSections: ReadonlyArray<ThemedBrochureSection> = [
  { id: "cover", render: renderCoverSection },
  { id: "overview", render: renderOverviewSection },
  { id: "media", render: renderMediaSection },
  { id: "itinerary", render: renderItinerarySection },
  { id: "pricing", render: renderPricingSection },
  {
    id: "inclusions",
    render: ({ context }) => renderHtmlListSection("Inclusions", context.product.inclusionsHtml),
  },
  {
    id: "exclusions",
    render: ({ context }) => renderHtmlListSection("Exclusions", context.product.exclusionsHtml),
  },
  {
    id: "terms",
    render: ({ context }) => renderHtmlListSection("Terms", context.product.termsHtml),
  },
]

export function renderThemedBrochureHtml(
  template: RenderedProductBrochureTemplate,
  context: ProductBrochureTemplateContext,
  options: RenderThemedBrochureHtmlOptions = {},
) {
  const theme = resolveTheme(options.theme)
  const sections = [
    ...(options.sections ?? defaultThemedBrochureSections),
    ...(options.additionalSections ?? []),
  ]
  const input = { template, context, theme }
  const content = sections
    .map((section) => section.render(input))
    .filter((section): section is string => Boolean(section?.trim()))
    .join("")
  const footer = theme.footerText
    ? `<footer class="brochure-footer">${escapeHtml(theme.footerText)}</footer>`
    : ""

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(template.title)}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<style>${renderThemedBrochureStyles(theme)}</style>`,
    "</head>",
    `<body>${content}${footer}</body>`,
    "</html>",
  ].join("")
}

export function createThemedBrochurePrinter(
  options: CreateThemedBrochurePrinterOptions,
): ProductBrochurePrinter {
  if (isBasicPdfProductBrochurePrinter(options.printer)) {
    throw new Error(
      "createThemedBrochurePrinter requires an HTML-capable browser printer. The built-in basic PDF printer strips HTML tags and cannot render themed brochure styles.",
    )
  }

  return async ({ template, context }) => {
    const html = renderThemedBrochureHtml(template, context, options)
    const printed = await options.printer({
      template: {
        ...template,
        body: html,
        bodyFormat: "html",
      },
      context,
    })

    return {
      ...printed,
      metadata: {
        ...printed.metadata,
        layout: "themed-brochure",
      },
    }
  }
}

export const createThemedProductBrochurePrinter = createThemedBrochurePrinter
