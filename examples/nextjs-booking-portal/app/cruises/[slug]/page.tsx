import { notFound } from "next/navigation"

import { getCruise } from "../../../lib/voyant-client"

export const dynamic = "force-dynamic"

type Params = { slug: string }

/**
 * Cruise detail page. The example fetches the slim summary from the search
 * index for simplicity. A real app would fetch the rich detail payload from
 * `/v1/public/cruises/[slug]` (which dispatches to the local DB or the
 * registered adapter based on the entry's source) and render sailings,
 * pricing grid, and itinerary.
 */
export default async function CruiseDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const cruise = await getCruise(slug)
  if (!cruise) notFound()

  return (
    <>
      <section className="hero">
        <h1>{cruise.name}</h1>
        <div className="card-tags">
          <span className={`tag tag-${cruise.cruiseType}`}>{cruise.cruiseType}</span>
          {cruise.source === "external" && (
            <span className="tag tag-external">
              External · {cruise.sourceProvider ?? "adapter"}
            </span>
          )}
        </div>
        <p>
          {cruise.lineName} · {cruise.shipName} · {cruise.nights} nights
        </p>
      </section>

      <section>
        <h2>Voyage</h2>
        <dl className="kv">
          {cruise.embarkPortName && (
            <>
              <dt>Embark</dt>
              <dd>{cruise.embarkPortName}</dd>
            </>
          )}
          {cruise.disembarkPortName && (
            <>
              <dt>Disembark</dt>
              <dd>{cruise.disembarkPortName}</dd>
            </>
          )}
          {cruise.earliestDeparture && (
            <>
              <dt>Earliest departure</dt>
              <dd>{cruise.earliestDeparture}</dd>
            </>
          )}
          {cruise.latestDeparture && (
            <>
              <dt>Latest departure</dt>
              <dd>{cruise.latestDeparture}</dd>
            </>
          )}
          {cruise.regions.length > 0 && (
            <>
              <dt>Regions</dt>
              <dd>{cruise.regions.join(", ")}</dd>
            </>
          )}
          {cruise.themes.length > 0 && (
            <>
              <dt>Themes</dt>
              <dd>{cruise.themes.join(", ")}</dd>
            </>
          )}
        </dl>
      </section>

      <section>
        <h2>Pricing</h2>
        {cruise.lowestPriceCents != null ? (
          <p>
            From{" "}
            <span className="price">
              {cruise.lowestPriceCurrency} {(cruise.lowestPriceCents / 100).toLocaleString()}
            </span>{" "}
            per person, double occupancy. Single supplement and other rates available — contact us
            for a full quote.
          </p>
        ) : (
          <p>Pricing available on request.</p>
        )}
      </section>

      <section>
        <p>
          <a href="/cruises" className="btn btn-outline">
            ← Back to cruises
          </a>
        </p>
      </section>
    </>
  )
}
