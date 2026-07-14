import type {
  TypesenseClient,
  TypesenseCollectionSchema,
  TypesenseSearchQuery,
  TypesenseSearchResponse,
} from "./typesense.js"

class TypesenseHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message)
    this.name = "TypesenseHttpError"
  }
}

/** Fetch-based Typesense client used by the Node graph provider. */
export function createTypesenseFetchClient(host: string, apiKey: string): TypesenseClient {
  const baseUrl = host.replace(/\/$/, "")
  const baseHeaders = { "X-TYPESENSE-API-KEY": apiKey }

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set("X-TYPESENSE-API-KEY", apiKey)
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new TypesenseHttpError(
        response.status,
        `Typesense ${init.method ?? "GET"} ${path} ${response.status}: ${body}`,
      )
    }
    return response
  }

  function searchPath(name: string, query: TypesenseSearchQuery) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value))
    }
    return `/collections/${encodeURIComponent(name)}/documents/search?${params.toString()}`
  }

  return {
    collections(name?: string) {
      return {
        async list() {
          return (await request("/collections").then((result) =>
            result.json(),
          )) as TypesenseCollectionSchema[]
        },
        async create(schema: TypesenseCollectionSchema) {
          await request("/collections", { method: "POST", body: JSON.stringify(schema) })
        },
        async update(schema: Partial<TypesenseCollectionSchema>) {
          if (!name) throw new Error("update requires a collection name")
          await request(`/collections/${encodeURIComponent(name)}`, {
            method: "PATCH",
            body: JSON.stringify(schema),
          })
        },
        async delete() {
          if (!name) throw new Error("delete requires a collection name")
          await request(`/collections/${encodeURIComponent(name)}`, { method: "DELETE" })
        },
        async retrieve() {
          if (!name) throw new Error("retrieve requires a collection name")
          return (await request(`/collections/${encodeURIComponent(name)}`).then((result) =>
            result.json(),
          )) as TypesenseCollectionSchema
        },
        documents() {
          if (!name) throw new Error("documents() requires a collection name")
          return {
            import: async (documents: unknown[], options?: { action?: "upsert" | "create" }) => {
              const action = options?.action ?? "create"
              const response = await fetch(
                `${baseUrl}/collections/${encodeURIComponent(name)}/documents/import?action=${action}`,
                {
                  method: "POST",
                  headers: { ...baseHeaders, "Content-Type": "text/plain" },
                  body: documents.map((document) => JSON.stringify(document)).join("\n"),
                },
              )
              if (!response.ok) {
                const body = await response.text().catch(() => "")
                throw new TypesenseHttpError(
                  response.status,
                  `Typesense import ${name} ${response.status}: ${body}`,
                )
              }
              return response.text()
            },
            async delete(query: { filter_by: string }) {
              const params = new URLSearchParams({ filter_by: query.filter_by })
              return request(
                `/collections/${encodeURIComponent(name)}/documents?${params.toString()}`,
                { method: "DELETE" },
              ).then((result) => result.json())
            },
            async search(query: TypesenseSearchQuery): Promise<TypesenseSearchResponse> {
              return request(searchPath(name, query)).then(
                (result) => result.json() as Promise<TypesenseSearchResponse>,
              )
            },
          }
        },
      }
    },
  }
}
