export {
  assertPortConforms,
  definePort,
  providePort,
  requirePort,
  type VoyantPort,
} from "@voyant-travel/core/project"

export type VoyantPortConformanceTest<TProvider> = (provider: TProvider) => void | Promise<void>
export type DefineVoyantPortInput<TProvider> =
  import("@voyant-travel/core/project").VoyantPort<TProvider>
export interface RequireVoyantPortOptions {
  optional?: boolean
}
