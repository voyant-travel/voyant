import { listCruises } from "../../lib/voyant-client"

export const dynamic = "force-dynamic"

/**
 * Cruise listing page — reads from Voyant's `/v1/public/cruises` surface,
 * which is backed by `cruise_search_index` and includes both self-managed
 * and adapter-sourced (external) entries in a unified list. The "External"
 * badge surfaces the provenance to shoppers in case the operator wants
 * different visual treatment.
 */
export default async function CruisesPage() {
  const { data, total } = await listCruises({ limit: 24 })

  return (
    <>
      <section className="hero">
        <h1>Cruises</h1>
        <p>
          Ocean, river, and expedition voyages — both our own boutique boats and a curated selection
          from our cruise-line partners.
        </p>
      </section>
      <section>
        <h2>{total === 0 ? "No cruises available right now" : `${total} sailings`}</h2>
        <div className="grid">
          {data.map((cruise) => (
            <a key={cruise.id} href={`/cruises/${encodeURIComponent(cruise.slug)}`}>
              <article className="card">
                {cruise.heroImageUrl && (
                  <div
                    className="card-image"
                    style={{ backgroundImage: `url(${cruise.heroImageUrl})` }}
                    role="img"
                    aria-label={cruise.name}
                  />
                )}
                <div className="card-body">
                  <div className="card-tags">
                    <span className={`tag tag-${cruise.cruiseType}`}>{cruise.cruiseType}</span>
                    {cruise.source === "external" && (
                      <span
                        className="tag tag-external"
                        title={`Sourced via ${cruise.sourceProvider ?? "external adapter"}`}
                      >
                        External
                      </span>
                    )}
                  </div>
                  <h3>{cruise.name}</h3>
                  <div className="card-meta">
                    {cruise.lineName} · {cruise.shipName} · {cruise.nights} nights
                  </div>
                  {cruise.embarkPortName && (
                    <p className="card-summary">
                      {cruise.embarkPortName}
                      {cruise.disembarkPortName &&
                      cruise.disembarkPortName !== cruise.embarkPortName
                        ? ` → ${cruise.disembarkPortName}`
                        : " (round trip)"}
                    </p>
                  )}
                  <div className="card-footer">
                    <div>
                      {cruise.lowestPriceCents != null ? (
                        <>
                          <span className="price">
                            {cruise.lowestPriceCurrency}{" "}
                            {(cruise.lowestPriceCents / 100).toLocaleString()}
                          </span>{" "}
                          <span className="price-unit">from / pp</span>
                        </>
                      ) : (
                        <span className="price-unit">Pricing on request</span>
                      )}
                    </div>
                    <span className="btn btn-outline">View cruise</span>
                  </div>
                </div>
              </article>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
