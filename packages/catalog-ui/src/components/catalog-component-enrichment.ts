export interface CatalogDetailComponent {
  id: string
  title: string
  kind: string
  summary?: string | null
  description?: string | null
  selection?: string | null
  commitmentBoundary?: string | null
  priceDisposition?: string | null
  required?: boolean | null
  quantity?: number | null
  sortOrder?: number | null
  tags?: string[]
  choices?: ReadonlyArray<{
    id: string
    title: string
    description?: string | null
    isDefault?: boolean | null
  }>
  media?: ReadonlyArray<{ url: string; type?: string; caption?: string | null }>
  bindingType?: string | null
  ref?: {
    entityModule?: string | null
    entityId?: string | null
    sourceKind?: string | null
  } | null
  detailLines?: string[]
}

export interface ProductComponentPayload {
  id: string
  title: string
  component_kind: string
  summary?: string | null
  description?: string | null
  selection?: string | null
  commitment_boundary?: string | null
  price_disposition?: string | null
  required?: boolean | null
  quantity?: number | null
  sort_order?: number | null
  tags?: string[]
  choices?: Array<{
    id: string
    title: string
    description?: string | null
    is_default?: boolean | null
  }>
  media?: Array<{ url: string; type?: string; caption?: string | null }>
  binding?: ProductComponentBindingPayload
}

type ProductComponentBindingPayload =
  | {
      type: "ref"
      ref: {
        entity_module?: string | null
        entity_id?: string | null
        source_kind?: string | null
      }
      summary?: ProductGenericComponentContentPayload
    }
  | {
      type: "inline"
      content:
        | ProductAccommodationComponentContentPayload
        | ProductTransportComponentContentPayload
        | ProductGenericComponentContentPayload
    }

interface ProductGenericComponentContentPayload {
  title?: string | null
  description?: string | null
  inclusions?: string[]
  media?: Array<{ url: string; type?: string; caption?: string | null }>
  metadata?: Record<string, unknown>
}

interface ProductAccommodationComponentContentPayload {
  property?: {
    name?: string | null
    description?: string | null
    star_rating?: number | null
    hero_image_url?: string | null
    location?: { name?: string | null; city?: string | null; country?: string | null }
    amenities?: string[]
    media?: Array<{ url: string; type?: string; caption?: string | null }>
  }
  room_type?: {
    name?: string | null
    room_class?: string | null
    view?: string | null
    max_occupancy?: number | null
  }
  rate_plan?: {
    name?: string | null
    board_basis?: string | null
    inclusions?: string[]
    cancellation_summary?: string | null
  }
  board_basis?: string | null
  nights?: number | null
}

interface ProductTransportComponentContentPayload {
  legs?: Array<{
    mode?: string | null
    carrier?: string | null
    number?: string | null
    service_class?: string | null
    from?: { name?: string | null; city?: string | null; country?: string | null }
    to?: { name?: string | null; city?: string | null; country?: string | null }
    starts_at?: string | null
    ends_at?: string | null
    duration_minutes?: number | null
    notes?: string | null
  }>
  summary?: string | null
}

export function mapProductComponentToDetailComponent(
  component: ProductComponentPayload,
): CatalogDetailComponent {
  const binding = component.binding
  const bindingSummary =
    binding?.type === "ref"
      ? (binding.summary ?? null)
      : binding?.type === "inline"
        ? binding.content
        : null
  const summary =
    component.summary ??
    (isGenericComponentContent(bindingSummary) ? (bindingSummary.title ?? null) : null)
  const description =
    component.description ??
    (isGenericComponentContent(bindingSummary) ? (bindingSummary.description ?? null) : null)

  return {
    id: component.id,
    title: component.title,
    kind: component.component_kind,
    summary,
    description,
    selection: component.selection ?? null,
    commitmentBoundary: component.commitment_boundary ?? null,
    priceDisposition: component.price_disposition ?? null,
    required: component.required ?? null,
    quantity: component.quantity ?? null,
    sortOrder: component.sort_order ?? null,
    tags: component.tags ?? [],
    choices: (component.choices ?? []).map((choice) => ({
      id: choice.id,
      title: choice.title,
      description: choice.description ?? null,
      isDefault: choice.is_default ?? null,
    })),
    media: component.media?.length ? component.media : componentMediaFromBinding(component),
    bindingType: binding?.type ?? null,
    ref:
      binding?.type === "ref"
        ? {
            entityModule: binding.ref.entity_module ?? null,
            entityId: binding.ref.entity_id ?? null,
            sourceKind: binding.ref.source_kind ?? null,
          }
        : null,
    detailLines: componentDetailLines(component),
  }
}

function componentDetailLines(component: ProductComponentPayload): string[] {
  const binding = component.binding
  if (!binding) return []
  if (binding.type === "ref") {
    return compactStrings([
      [binding.ref.entity_module, binding.ref.entity_id].filter(Boolean).join("/"),
      binding.ref.source_kind ?? null,
      ...(binding.summary?.inclusions ?? []),
    ])
  }
  switch (component.component_kind) {
    case "accommodation":
      return accommodationDetailLines(
        binding.content as ProductAccommodationComponentContentPayload,
      )
    case "transport":
      return transportDetailLines(binding.content as ProductTransportComponentContentPayload)
    default:
      return genericDetailLines(binding.content as ProductGenericComponentContentPayload)
  }
}

function accommodationDetailLines(content: ProductAccommodationComponentContentPayload): string[] {
  const property = content.property
  const room = content.room_type
  const rate = content.rate_plan
  const location = locationLabel(property?.location)
  const boardBasis = content.board_basis ?? rate?.board_basis ?? null
  return compactStrings([
    property?.name ?? null,
    location,
    room?.name ?? room?.room_class ?? null,
    rate?.name ?? null,
    boardBasis ? boardBasis.replace(/_/g, " ") : null,
    typeof content.nights === "number" ? `${content.nights} nights` : null,
    ...(rate?.inclusions ?? []),
    ...(property?.amenities ?? []),
  ])
}

function transportDetailLines(content: ProductTransportComponentContentPayload): string[] {
  const lines = compactStrings([content.summary ?? null])
  for (const leg of content.legs ?? []) {
    const origin = locationLabel(leg.from)
    const destination = locationLabel(leg.to)
    const route = origin && destination ? `${origin} to ${destination}` : (origin ?? destination)
    const service = compactStrings([
      leg.mode ?? null,
      leg.carrier ?? null,
      leg.number ?? null,
    ]).join(" ")
    lines.push(compactStrings([service, route, leg.service_class ?? null]).join(" - "))
    if (leg.notes) lines.push(leg.notes)
  }
  return lines.filter((line) => line.length > 0)
}

function genericDetailLines(content: ProductGenericComponentContentPayload): string[] {
  return compactStrings([content.title ?? null, ...(content.inclusions ?? [])])
}

function componentMediaFromBinding(
  component: ProductComponentPayload,
): CatalogDetailComponent["media"] {
  const binding = component.binding
  if (!binding || binding.type !== "inline") return []
  switch (component.component_kind) {
    case "accommodation": {
      const content = binding.content as ProductAccommodationComponentContentPayload
      const property = content.property
      return compactMedia([
        property?.hero_image_url ? { url: property.hero_image_url, type: "image" } : null,
        ...(property?.media ?? []),
      ])
    }
    default: {
      const content = binding.content as ProductGenericComponentContentPayload
      return compactMedia(content.media ?? [])
    }
  }
}

function isGenericComponentContent(
  content:
    | ProductGenericComponentContentPayload
    | ProductAccommodationComponentContentPayload
    | ProductTransportComponentContentPayload
    | null,
): content is ProductGenericComponentContentPayload {
  return (
    content != null && ("title" in content || "description" in content || "inclusions" in content)
  )
}

function locationLabel(location?: {
  name?: string | null
  city?: string | null
  country?: string | null
}): string | null {
  if (!location) return null
  return compactStrings([location.name ?? null, location.city ?? null, location.country ?? null])
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(", ")
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
}

function compactMedia(
  values: Array<{ url: string; type?: string; caption?: string | null } | null | undefined>,
): Array<{ url: string; type?: string; caption?: string | null }> {
  return values.filter(
    (value): value is { url: string; type?: string; caption?: string | null } =>
      value != null && value.url.length > 0,
  )
}
