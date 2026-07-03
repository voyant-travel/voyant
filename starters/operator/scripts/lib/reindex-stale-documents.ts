import { collectionName, type IndexerSlice } from "@voyant-travel/catalog"

interface TypesenseSearchHit {
  document?: {
    id?: string
  }
}

export interface TypesenseSearchPage {
  hits?: TypesenseSearchHit[]
}

export type TypesenseDocumentSearch = (
  collection: string,
  params: URLSearchParams,
) => Promise<TypesenseSearchPage | null>

export function createTypesenseDocumentSearch(
  typesenseHost: string,
  typesenseApiKey: string,
): TypesenseDocumentSearch {
  return async (collection, params) => {
    const url = new URL(`${typesenseHost}/collections/${collection}/documents/search`)
    url.search = params.toString()

    const res = await fetch(url, { headers: { "X-TYPESENSE-API-KEY": typesenseApiKey } })
    if (!res.ok) return null
    return (await res.json()) as TypesenseSearchPage
  }
}

export async function listStaleDocuments(
  slice: IndexerSlice,
  liveIds: ReadonlySet<string>,
  search: TypesenseDocumentSearch,
  options: { perPage?: number } = {},
): Promise<string[]> {
  const staleIds: string[] = []
  const perPage = options.perPage ?? 250
  let page = 1

  while (true) {
    const params = new URLSearchParams()
    params.set("q", "*")
    params.set("query_by", "name")
    params.set("include_fields", "id")
    params.set("per_page", String(perPage))
    params.set("page", String(page))

    const data = await search(collectionName(slice), params)
    if (!data) break

    const hits = data.hits ?? []
    for (const hit of hits) {
      const id = hit.document?.id
      if (id && !liveIds.has(id)) staleIds.push(id)
    }

    if (hits.length < perPage) break
    page += 1
  }

  return staleIds
}
