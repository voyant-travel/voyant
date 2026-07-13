/** Domain-neutral resources available to graph-selected runtime contributors. */
export interface VoyantRuntimeHostPrimitives {
  env(bindings: unknown): Readonly<Record<string, unknown>>
  database: {
    resolve<TDatabase = unknown>(bindings: unknown): TDatabase
    fromContext<TDatabase = unknown>(context: unknown): TDatabase
    transaction<T>(bindings: unknown, operation: (database: unknown) => Promise<T>): Promise<T>
  }
  storage: {
    resolve(bindings: unknown, name: "documents" | "media" | (string & {})): unknown
    read(bindings: unknown, key: string): Promise<string | null>
    downloadUrl(bindings: unknown, key: string): Promise<string | null>
  }
  events: {
    deliver(event: unknown, bindings: unknown): Promise<unknown>
  }
  config: {
    read(bindings: unknown, key: string): unknown
  }
}
