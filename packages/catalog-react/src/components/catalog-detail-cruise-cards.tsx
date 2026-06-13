"use client"

import { Badge } from "@voyantjs/ui/components/badge"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"

import type { CatalogUiMessages } from "../i18n/messages.js"
import type { CatalogDetailEnrichment } from "../index.js"
import { formatTemplate } from "./catalog-detail-parts.js"
import { MediaGallery } from "./media-gallery.js"

export function CabinCard({
  cabin,
  messages,
}: {
  cabin: NonNullable<CatalogDetailEnrichment["options"]>[number]
  messages: CatalogUiMessages["catalogPage"]["detail"]
}): ReactNode {
  const desc = cabin.description?.trim() ?? ""
  const meta = [
    cabin.squareFeet ? `${cabin.squareFeet} sqft` : null,
    cabin.capacityMax ? `sleeps ${cabin.capacityMax}` : null,
    cabin.gradeCodes && cabin.gradeCodes.length > 0
      ? `grades ${cabin.gradeCodes.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  // The upstream amenity list leads with the cabin size + a copy of the
  // description; drop those so the chips show genuine, non-duplicated perks.
  const amenities = (cabin.amenities ?? []).filter(
    (a) => a.trim() !== desc && !/^stateroom size/i.test(a.trim()),
  )
  return (
    <li className="flex gap-4 rounded-lg border border-border p-3">
      <MediaGallery images={cabin.images ?? []} alt={cabin.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h4 className="font-medium text-sm">{cabin.name}</h4>
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
          {cabin.wheelchairAccessible && (
            <Badge variant="outline" className="text-[10px]">
              {messages.wheelchairAccessible}
            </Badge>
          )}
        </div>
        {desc && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
        {(cabin.floorplanImages?.length ?? 0) > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {messages.floorPlan}
            </div>
            <MediaGallery
              images={cabin.floorplanImages ?? []}
              alt={`${cabin.name} floor plan`}
              className="w-44"
              imageClassName="h-28 w-44 object-contain bg-muted"
            />
          </div>
        )}
        {amenities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {amenities.slice(0, 6).map((a) => (
              <span
                key={a}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {a}
              </span>
            ))}
            {amenities.length > 6 && (
              <span className="px-1 text-[10px] text-muted-foreground">
                +{amenities.length - 6}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The vessel a cruise sails on: gallery + name/type, key specs (capacity,
 * decks, year built) and a description.
 */
export function ShipCard({
  ship,
  messages,
}: {
  ship: NonNullable<CatalogDetailEnrichment["ship"]>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}): ReactNode {
  const desc = ship.description?.trim() ?? ""
  const specs = [
    ship.shipType ? { label: messages.shipSpecs.type, value: ship.shipType } : null,
    ship.capacity
      ? {
          label: messages.shipSpecs.capacity,
          value: formatTemplate(messages.shipSpecs.capacityGuests, { count: ship.capacity }),
        }
      : null,
    ship.decks ? { label: messages.shipSpecs.decks, value: String(ship.decks) } : null,
    ship.yearBuilt ? { label: messages.shipSpecs.yearBuilt, value: String(ship.yearBuilt) } : null,
  ].filter((s): s is { label: string; value: string } => s != null)
  const images = ship.images ?? []
  const deckPlanUrls = [
    ...(ship.deckPlanUrl ? [ship.deckPlanUrl] : []),
    ...(ship.deckPlans ?? []).flatMap((deck) => (deck.imageUrl ? [deck.imageUrl] : [])),
  ]
  const deckPlanImages = Array.from(new Set(deckPlanUrls.filter(isRenderableImageUrl)))
  const deckPlanDocuments = Array.from(
    new Set(deckPlanUrls.filter((url) => !isRenderableImageUrl(url))),
  )
  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <MediaGallery
          images={images}
          alt={ship.name}
          className="w-full max-w-lg"
          imageClassName="h-56 w-full"
        />
      )}
      {deckPlanImages.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {messages.deckPlan}
          </div>
          <MediaGallery
            images={deckPlanImages}
            alt={`${ship.name} deck plan`}
            className="w-full max-w-lg"
            imageClassName="h-56 w-full object-contain bg-muted"
          />
        </div>
      )}
      {deckPlanDocuments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deckPlanDocuments.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" />
              {messages.openDeckPlan}
            </a>
          ))}
        </div>
      )}
      <div>
        <h3 className="text-base font-medium text-foreground">{ship.name}</h3>
        {ship.shipType && <p className="mt-0.5 text-xs text-muted-foreground">{ship.shipType}</p>}
      </div>
      {(ship.deckPlans?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {ship.deckPlans!.map((deck) => (
            <span
              key={`${deck.level ?? ""}-${deck.name}`}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {deck.level != null ? `Deck ${deck.level}: ${deck.name}` : deck.name}
            </span>
          ))}
        </div>
      )}
      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {specs.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </dt>
              <dd className="text-sm text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {desc && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{desc}</p>
      )}
    </div>
  )
}

function isRenderableImageUrl(url: string): boolean {
  if (url.startsWith("data:image/")) return true
  const path = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? ""
  return /\.(avif|gif|jpe?g|png|svg|webp)$/.test(path)
}
