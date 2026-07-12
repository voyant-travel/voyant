/** Domain-neutral resources available to graph-selected runtime contributors. */
export interface VoyantRuntimeHostPrimitives {
  env(bindings: unknown): Readonly<Record<string, unknown>>
  modules: {
    import<TModule extends Record<string, unknown> = Record<string, unknown>>(
      specifier: string,
    ): Promise<TModule>
  }
  database: {
    resolve<TDatabase = unknown>(bindings: unknown): TDatabase
    fromContext<TDatabase = unknown>(context: unknown): TDatabase
    transaction<T>(bindings: unknown, operation: (database: unknown) => Promise<T>): Promise<T>
  }
  storage: {
    resolve(bindings: unknown): unknown
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
