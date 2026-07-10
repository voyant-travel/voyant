import type { VoyantGraphPortDeclaration } from "./deployment-graph.js"

export interface VoyantPort<TProvider> {
  readonly id: string
  readonly test: VoyantPortConformanceTest<TProvider>
}

export type VoyantPortConformanceTest<TProvider> = (provider: TProvider) => void | Promise<void>

export interface DefineVoyantPortInput<TProvider> {
  id: string
  test: VoyantPortConformanceTest<TProvider>
}

export interface RequireVoyantPortOptions {
  optional?: boolean
}

/**
 * Define a public provider port together with the conformance test every
 * replacement must pass before it is advertised by a deployment graph.
 */
export function definePort<TProvider>(
  input: DefineVoyantPortInput<TProvider>,
): VoyantPort<TProvider> {
  if (!PORT_ID_PATTERN.test(input.id)) {
    throw new Error(`Port id "${input.id}" must use dot-case namespace segments.`)
  }
  if (typeof input.test !== "function") {
    throw new Error(`Port "${input.id}" must provide a conformance test kit.`)
  }
  return Object.freeze({ id: input.id, test: input.test })
}

/** Lower a provided typed port to the serializable deployment graph contract. */
export function providePort<TProvider>(port: VoyantPort<TProvider>): VoyantGraphPortDeclaration {
  return { id: port.id }
}

/** Lower a required typed port to the serializable deployment graph contract. */
export function requirePort<TProvider>(
  port: VoyantPort<TProvider>,
  options: RequireVoyantPortOptions = {},
): VoyantGraphPortDeclaration {
  return {
    id: port.id,
    ...(options.optional ? { optional: true } : {}),
  }
}

/** Run the public conformance kit for a provider implementation. */
export async function assertPortConforms<TProvider>(
  port: VoyantPort<TProvider>,
  provider: TProvider,
): Promise<void> {
  await port.test(provider)
}

const PORT_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
