import type {
  EventEnvelope,
  EventFilterDescriptor,
  SubscriberRuntimeDescriptor,
  WorkflowDescriptor,
} from "@voyant-travel/core"
import {
  isGraphRuntimeFactory,
  type VoyantGraphRuntimeFactoryContext,
  type VoyantPort,
} from "@voyant-travel/core/project"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"

import type { VoyantGraphRuntime, VoyantGraphRuntimeUnitLoader } from "./runtime-lowering.js"

export interface VoyantGraphRuntimeBindingContext<TCapabilities> {
  capabilities: TCapabilities
  unit: VoyantGraphRuntimeUnitLoader
  runtimeExports: readonly unknown[]
}

export type VoyantGraphRuntimeBinding<TCapabilities> = (
  context: VoyantGraphRuntimeBindingContext<TCapabilities>,
) =>
  | HonoModule
  | readonly HonoModule[]
  | HonoExtension
  | readonly HonoExtension[]
  | undefined
  | Promise<
      HonoModule | readonly HonoModule[] | HonoExtension | readonly HonoExtension[] | undefined
    >

export type VoyantGraphRuntimeBindings<TCapabilities> = Readonly<
  Record<string, VoyantGraphRuntimeBinding<TCapabilities>>
>

export type VoyantGraphRuntimePorts = Readonly<Record<string, unknown>>

/** Conforming, fail-on-use port shapes for graph inspection and boot probes. */
export function createVoyantGraphRuntimePortStubs(
  runtime: VoyantGraphRuntime,
): VoyantGraphRuntimePorts {
  const ids = new Set(
    [...runtime.modules, ...runtime.extensions, ...runtime.plugins].flatMap(
      (unit) => unit.requiredRuntimePorts,
    ),
  )
  return Object.fromEntries([...ids].map((id) => [id, runtimePortStub(id)]))
}

function runtimePortStub(id: string): unknown {
  if (id === "trips.routes-runtime" || id === "commerce.checkout-api-options") return () => ({})
  const unavailable = () => {
    throw new Error(`Runtime port ${id} requires project-specific provider configuration.`)
  }
  const unavailableAsync = async () => unavailable()
  const registrySurface = { resolveRegistry: unavailableAsync }
  return {
    options: {},
    booking: {},
    publicRoutes: { resolveProductSnapshot: unavailableAsync },
    admin: registrySurface,
    public: registrySurface,
    email: { subject: "Verification code" },
    bootstrap: async () => {},
    register: () => {},
    registerWorkflowService: () => {},
    withDb: unavailableAsync,
    createRuntime: () => runtimeServiceStub(id),
    createService: () => runtimeServiceStub(id),
    resolveRuntime: unavailableAsync,
    resolveRegistry: unavailableAsync,
    getProductContent: unavailableAsync,
    listAvailabilitySlots: unavailableAsync,
    getOwnedProductById: unavailableAsync,
    resolveConnectClient: unavailableAsync,
    fetchIndexFields: unavailableAsync,
    resolveDynamicHotelIds: unavailableAsync,
    resolveAirportLabels: unavailableAsync,
    resolveAdapter: unavailable,
    startCardPayment: unavailableAsync,
    resolveStorage: unavailable,
    signVideoUploadTicket: unavailableAsync,
    checkBookingDrift: unavailableAsync,
    checkFinanceDrift: unavailableAsync,
    checkProductDrift: unavailableAsync,
    resolveParticipantPersonById: unavailableAsync,
    resolveDelegatePersonById: unavailableAsync,
    resolveDb: unavailable,
    resolveProviders: () => [],
    resolveReminderWorkflowRuntime: () => runtimeServiceStub(id),
    resolveDocumentDownloadUrl: unavailableAsync,
    resolveDocumentStorage: unavailable,
    resolveDocumentGenerator: () => undefined,
    resolveBookingPiiService: async () => null,
    generateContract: unavailableAsync,
    previewContract: unavailableAsync,
    guessMimeType: () => "application/octet-stream",
    resolvePublicProposalBaseUrl: () => "http://localhost:8080",
    reserveTripDeps: () => runtimeServiceStub(id),
    startCheckoutDeps: () => runtimeServiceStub(id),
    cancelTripComponentsDeps: () => runtimeServiceStub(id),
    resolveOperatorProfile: unavailableAsync,
    resolveBookingTaxSettings: unavailableAsync,
    updateBookingTaxSettings: unavailableAsync,
    getContract: unavailableAsync,
    listSignatures: unavailableAsync,
    sendContract: unavailableAsync,
    signContract: unavailableAsync,
    generate: unavailableAsync,
  }
}

function runtimeServiceStub(id: string): Record<string, (...args: unknown[]) => Promise<never>> {
  return new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error(`Runtime port ${id} requires project-specific provider configuration.`)
      },
    },
  )
}

export interface ComposeVoyantGraphRuntimeInput<TCapabilities> {
  runtime: VoyantGraphRuntime
  capabilities: TCapabilities
  /**
   * Deployment-owned option wiring and local units, keyed by stable graph unit
   * id. A binding only runs when its unit is selected by the generated graph.
   */
  bindings?: VoyantGraphRuntimeBindings<TCapabilities>
  /** Deployment implementations keyed by package-declared port id. */
  ports?: VoyantGraphRuntimePorts
  /** Node-owned durable boundary for graph-selected outbound webhook events. */
  outboundWebhooks?: {
    enqueue: (event: EventEnvelope, bindings: unknown) => Promise<unknown>
  }
}

export interface VoyantGraphRuntimeComposition {
  modules: HonoModule[]
  extensions: HonoExtension[]
  accessResources: { path: string; resource: string }[]
  routePosture: VoyantGraphRuntimeRoutePosture
}

/** Absolute path posture derived only from selected graph API bundles. */
export interface VoyantGraphRuntimeRoutePosture {
  publicPaths: string[]
  transactionalPaths: string[]
}

/** Load graph-owned workflow/subscriber metadata without composing API routes. */
export async function composeVoyantGraphRuntimeFacetModules(
  runtime: VoyantGraphRuntime,
  ports?: VoyantGraphRuntimePorts,
): Promise<HonoModule[]> {
  return composeRuntimeFacetModules(runtime, createRuntimeFactoryContexts(runtime, ports))
}

async function composeRuntimeFacetModules(
  runtime: VoyantGraphRuntime,
  factoryContexts: ReadonlyMap<VoyantGraphRuntimeUnitLoader, VoyantGraphRuntimeFactoryContext>,
): Promise<HonoModule[]> {
  const modules: HonoModule[] = []
  for (const unit of [...runtime.modules, ...runtime.extensions, ...runtime.plugins]) {
    const module = await resolveRuntimeFacetModule(
      unit,
      requireRuntimeFactoryContext(factoryContexts, unit),
    )
    if (module) modules.push(module)
  }
  return modules
}

/**
 * Resolve selected graph runtime exports into the arrays consumed by mountApp.
 * Duplicate API facets are collapsed by the lowered unit loader before a
 * factory or deployment binding is invoked.
 */
export async function composeVoyantGraphRuntime<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
): Promise<VoyantGraphRuntimeComposition> {
  const modules: HonoModule[] = []
  const extensions: HonoExtension[] = []
  const factoryContexts = createRuntimeFactoryContexts(input.runtime, input.ports)

  for (const unit of input.runtime.modules) {
    const outputs = await resolveRuntimeUnit(
      input,
      unit,
      requireRuntimeFactoryContext(factoryContexts, unit),
    )
    assertWebhookRoutePosture(input.runtime, unit, outputs)
    const routePosture = deriveUnitRoutePosture(unit)
    for (const output of outputs) {
      if (!isHonoModule(output)) {
        throw invalidRuntimeOutput(unit, "HonoModule", output)
      }
      modules.push(applyModuleRoutePosture(output, routePosture))
    }
  }

  for (const unit of input.runtime.extensions) {
    const outputs = await resolveRuntimeUnit(
      input,
      unit,
      requireRuntimeFactoryContext(factoryContexts, unit),
    )
    assertWebhookRoutePosture(input.runtime, unit, outputs)
    const routePosture = deriveUnitRoutePosture(unit)
    for (const output of outputs) {
      if (!isHonoExtension(output)) {
        throw invalidRuntimeOutput(unit, "HonoExtension", output)
      }
      extensions.push(applyExtensionRoutePosture(output, routePosture))
    }
  }

  for (const unit of input.runtime.plugins) {
    const outputs = await resolveRuntimeUnit(
      input,
      unit,
      requireRuntimeFactoryContext(factoryContexts, unit),
    )
    assertWebhookRoutePosture(input.runtime, unit, outputs)
    const routePosture = deriveUnitRoutePosture(unit)
    for (const output of outputs) {
      if (isHonoModule(output)) {
        modules.push(applyModuleRoutePosture(output, routePosture))
      } else if (isHonoExtension(output)) {
        extensions.push(applyExtensionRoutePosture(output, routePosture))
      } else {
        throw invalidRuntimeOutput(unit, "HonoModule or HonoExtension", output)
      }
    }
  }

  modules.push(...(await composeRuntimeFacetModules(input.runtime, factoryContexts)))
  const outboundWebhookModule = createGraphOutboundWebhookModule(input)
  if (outboundWebhookModule) modules.push(outboundWebhookModule)

  return {
    modules,
    extensions,
    accessResources: deriveAccessResources(input.runtime),
    routePosture: mergeRoutePostures(
      [...input.runtime.modules, ...input.runtime.extensions, ...input.runtime.plugins].map(
        deriveUnitRoutePosture,
      ),
    ),
  }
}

function deriveAccessResources(runtime: VoyantGraphRuntime): { path: string; resource: string }[] {
  return [...runtime.modules, ...runtime.extensions, ...runtime.plugins]
    .flatMap((unit) =>
      unit.routes.flatMap(({ route }) =>
        route.resource
          ? [{ path: resolveVoyantGraphRouteMountPath(unit, route), resource: route.resource }]
          : [],
      ),
    )
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) || left.resource.localeCompare(right.resource),
    )
}

interface UnitRoutePosture extends VoyantGraphRuntimeRoutePosture {
  publicMount?: string
  anonymous: boolean | readonly string[] | undefined
}

function deriveUnitRoutePosture(unit: VoyantGraphRuntimeUnitLoader): UnitRoutePosture {
  const publicRoutes = unit.routes.filter(({ route }) => route.surface === "public")
  const publicMounts = sortedUnique(
    publicRoutes.map(({ route }) => resolveVoyantGraphRouteMountPath(unit, route)),
  )
  const publicPaths = sortedUnique(
    unit.routes.flatMap(({ route }) => {
      const mount = resolveVoyantGraphRouteMountPath(unit, route)
      if (route.anonymous === true) return [mount]
      if (!route.anonymous) return []
      return route.anonymous.map((path) => resolveRoutePosturePath(mount, path))
    }),
  )
  const transactionalPaths = sortedUnique(
    unit.routes.flatMap(({ route }) => {
      const mount = resolveVoyantGraphRouteMountPath(unit, route)
      if (route.transactional === true) return [mount]
      if (!route.transactional) return []
      return route.transactional.map((path) => resolveRoutePosturePath(mount, path))
    }),
  )
  const publicMount = publicMounts.length === 1 ? publicMounts[0] : undefined
  const anonymous = publicMount ? anonymousForPublicMount(publicMount, publicPaths) : undefined

  return { publicPaths, transactionalPaths, publicMount, anonymous }
}

export function resolveVoyantGraphRouteMountPath(
  unit: Pick<VoyantGraphRuntimeUnitLoader, "id" | "localId">,
  route: VoyantGraphRuntimeUnitLoader["routes"][number]["route"],
): string {
  if (route.mount?.startsWith("/v1/")) return normalizeAbsolutePath(route.mount)
  const segment = route.mount ?? unit.localId ?? unit.id.split("#").at(-1) ?? unit.id
  const mount = segment.replace(/^\/+|\/+$/g, "")
  if (route.surface === "admin") return appendPath("/v1/admin", mount)
  if (route.surface === "public") return appendPath("/v1/public", mount)
  if (route.surface === "webhook") return appendPath("/v1", mount)
  return `/${mount}`
}

function resolveRoutePosturePath(mount: string, path: string): string {
  const normalizedPath = normalizeAbsolutePath(path)
  if (normalizedPath === mount || normalizedPath.startsWith(`${mount}/`)) return normalizedPath
  return appendPath(mount, path.replace(/^\/+|\/+$/g, ""))
}

function appendPath(mount: string, relative: string): string {
  return relative ? `${normalizeAbsolutePath(mount)}/${relative}` : normalizeAbsolutePath(mount)
}

function anonymousForPublicMount(
  publicMount: string,
  publicPaths: readonly string[],
): boolean | readonly string[] | undefined {
  if (publicPaths.includes(publicMount)) return true
  const prefix = `${publicMount}/`
  const relative = publicPaths
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(publicMount.length))
  return relative.length > 0 ? relative : undefined
}

function applyModuleRoutePosture(output: HonoModule, posture: UnitRoutePosture): HonoModule {
  return {
    ...output,
    ...(posture.publicMount ? { publicPath: publicPathFromMount(posture.publicMount) } : {}),
    ...(posture.anonymous !== undefined ? { anonymous: posture.anonymous } : {}),
    ...(posture.transactionalPaths.length > 0
      ? {
          transactionalPaths: sortedUnique([
            ...(output.transactionalPaths ?? []),
            ...posture.transactionalPaths,
          ]),
        }
      : {}),
  }
}

function applyExtensionRoutePosture(
  output: HonoExtension,
  posture: UnitRoutePosture,
): HonoExtension {
  return {
    ...output,
    ...(posture.publicMount ? { publicPath: publicPathFromMount(posture.publicMount) } : {}),
    ...(posture.anonymous !== undefined ? { anonymous: posture.anonymous } : {}),
    ...(posture.transactionalPaths.length > 0
      ? {
          transactionalPaths: sortedUnique([
            ...(output.transactionalPaths ?? []),
            ...posture.transactionalPaths,
          ]),
        }
      : {}),
  }
}

function publicPathFromMount(mount: string): string {
  if (mount === "/v1/public") return "/"
  const prefix = "/v1/public/"
  return mount.startsWith(prefix) ? mount.slice(prefix.length) : mount
}

function mergeRoutePostures(
  postures: readonly VoyantGraphRuntimeRoutePosture[],
): VoyantGraphRuntimeRoutePosture {
  return {
    publicPaths: sortedUnique(postures.flatMap(({ publicPaths }) => publicPaths)),
    transactionalPaths: sortedUnique(
      postures.flatMap(({ transactionalPaths }) => transactionalPaths),
    ),
  }
}

function normalizeAbsolutePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/g, "")
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function createGraphOutboundWebhookModule<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
): HonoModule | undefined {
  const enqueue = input.outboundWebhooks?.enqueue
  const eventTypes = input.runtime.webhooks.outboundEventTypes
  if (!enqueue || eventTypes.length === 0) return undefined

  return {
    module: {
      name: "graph-outbound-webhooks",
      bootstrap: ({ bindings, eventBus }) => {
        for (const eventType of eventTypes) {
          eventBus.subscribe(eventType, async (event) => {
            await enqueue(event, bindings)
          })
        }
      },
    },
  }
}

function assertWebhookRoutePosture(
  runtime: VoyantGraphRuntime,
  unit: VoyantGraphRuntimeUnitLoader,
  outputs: readonly unknown[],
): void {
  const declared = runtime.webhooks.inbound.some((entry) => entry.apiUnitId === unit.id)
  const executable = outputs.some(
    (output) => isRecord(output) && output.webhookRoutes !== undefined,
  )
  if (declared === executable) return

  throw new Error(
    declared
      ? `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" declares an inbound webhook plan but its runtime output has no webhookRoutes.`
      : `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" returned webhookRoutes without an inbound webhook declaration in the selected graph.`,
  )
}

async function resolveRuntimeFacetModule(
  unit: VoyantGraphRuntimeUnitLoader,
  factoryContext: VoyantGraphRuntimeFactoryContext,
): Promise<HonoModule | undefined> {
  const workflows =
    unit.workflows.length > 0
      ? await Promise.all(unit.workflows.map((workflow) => workflow.load<WorkflowDescriptor>()))
      : await loadFacetReferences<WorkflowDescriptor>(unit, "workflows.runtime")
  const subscriberFacets = await loadSubscriberFacets(unit, factoryContext)
  if (
    workflows.length === 0 &&
    subscriberFacets.eventFilters.length === 0 &&
    subscriberFacets.subscribers.length === 0
  ) {
    return undefined
  }

  return {
    module: {
      name: `${unit.localId ?? unit.id}.graph-runtime`,
      ...(workflows.length > 0 ? { workflows } : {}),
      ...(subscriberFacets.eventFilters.length > 0
        ? { eventFilters: subscriberFacets.eventFilters }
        : {}),
      ...(subscriberFacets.subscribers.length > 0
        ? {
            bootstrap: async (context) => {
              for (const subscriber of subscriberFacets.subscribers) {
                await subscriber.register(context)
              }
            },
          }
        : {}),
    },
  }
}

async function loadSubscriberFacets(
  unit: VoyantGraphRuntimeUnitLoader,
  factoryContext: VoyantGraphRuntimeFactoryContext,
): Promise<{
  eventFilters: EventFilterDescriptor[]
  subscribers: SubscriberRuntimeDescriptor[]
}> {
  const eventFilters: EventFilterDescriptor[] = []
  const subscribers: SubscriberRuntimeDescriptor[] = []

  for (const reference of unit.references.filter(
    (candidate) => candidate.facet === "subscribers.runtime",
  )) {
    const runtimeExport = await reference.load<unknown>()
    const value = isGraphRuntimeFactory(runtimeExport)
      ? await runtimeExport(factoryContext)
      : runtimeExport
    if (isSubscriberRuntimeDescriptor(value)) {
      if (value.id !== reference.entityId) {
        throw new Error(
          `composeVoyantGraphRuntime: subscriber runtime "${value.id}" does not match graph subscriber "${reference.entityId}".`,
        )
      }
      subscribers.push(value)
      continue
    }
    if (isEventFilterDescriptor(value)) {
      eventFilters.push(value)
      continue
    }
    throw new Error(
      `composeVoyantGraphRuntime: subscriber runtime "${reference.entityId}" must export a SubscriberRuntimeDescriptor or EventFilterDescriptor.`,
    )
  }

  return { eventFilters, subscribers }
}

async function loadFacetReferences<T>(
  unit: VoyantGraphRuntimeUnitLoader,
  facet: "workflows.runtime" | "subscribers.runtime",
): Promise<T[]> {
  return Promise.all(
    unit.references
      .filter((reference) => reference.facet === facet)
      .map((reference) => reference.load<T>()),
  )
}

async function resolveRuntimeUnit<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
  unit: VoyantGraphRuntimeUnitLoader,
  factoryContext: VoyantGraphRuntimeFactoryContext,
): Promise<unknown[]> {
  const runtimeExports = uniqueRuntimeExports(await unit.load())
  const binding = input.bindings?.[unit.id]
  if (binding) {
    return normalizeRuntimeOutputs(
      await binding({ capabilities: input.capabilities, unit, runtimeExports }),
    )
  }

  const outputs: unknown[] = []
  for (const runtimeExport of runtimeExports) {
    const output = isGraphRuntimeFactory(runtimeExport)
      ? await runtimeExport(factoryContext)
      : typeof runtimeExport === "function"
        ? await runtimeExport()
        : runtimeExport
    outputs.push(...normalizeRuntimeOutputs(output))
  }
  return outputs
}

function createRuntimeFactoryContext(
  ports: VoyantGraphRuntimePorts | undefined,
  unit: VoyantGraphRuntimeUnitLoader,
): VoyantGraphRuntimeFactoryContext {
  return {
    unitId: unit.id,
    projectConfig: unit.projectConfig,
    api: unit.routes.map(({ route }) => ({ id: route.id, surface: route.surface })),
    hasPort: <TProvider>(port: VoyantPort<TProvider>): boolean => {
      assertDeclaredRuntimePort(unit, port)
      return Object.hasOwn(ports ?? {}, port.id)
    },
    getPort: async <TProvider>(port: VoyantPort<TProvider>): Promise<TProvider> => {
      assertDeclaredRuntimePort(unit, port)
      if (!Object.hasOwn(ports ?? {}, port.id)) {
        const requirement = unit.requiredRuntimePorts.includes(port.id)
          ? "requires runtime port"
          : "optional runtime port"
        throw new Error(
          `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" ${requirement} "${port.id}", but the deployment did not bind it.`,
        )
      }
      const provider = await (ports![port.id] as TProvider | Promise<TProvider>)
      await port.test(provider)
      return provider
    },
  }
}

function createRuntimeFactoryContexts(
  runtime: VoyantGraphRuntime,
  ports: VoyantGraphRuntimePorts | undefined,
): ReadonlyMap<VoyantGraphRuntimeUnitLoader, VoyantGraphRuntimeFactoryContext> {
  return new Map(
    [...runtime.modules, ...runtime.extensions, ...runtime.plugins].map((unit) => [
      unit,
      createRuntimeFactoryContext(ports, unit),
    ]),
  )
}

function requireRuntimeFactoryContext(
  contexts: ReadonlyMap<VoyantGraphRuntimeUnitLoader, VoyantGraphRuntimeFactoryContext>,
  unit: VoyantGraphRuntimeUnitLoader,
): VoyantGraphRuntimeFactoryContext {
  const context = contexts.get(unit)
  if (!context) {
    throw new Error(
      `composeVoyantGraphRuntime: no runtime factory context for ${unit.kind} "${unit.id}".`,
    )
  }
  return context
}

function assertDeclaredRuntimePort<TProvider>(
  unit: VoyantGraphRuntimeUnitLoader,
  port: VoyantPort<TProvider>,
): void {
  if (!unit.runtimePorts.includes(port.id)) {
    throw new Error(
      `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" requested undeclared port "${port.id}".`,
    )
  }
}

function uniqueRuntimeExports(runtimeExports: readonly unknown[]): unknown[] {
  const seen = new Set<unknown>()
  return runtimeExports.filter((runtimeExport) => {
    if (seen.has(runtimeExport)) return false
    seen.add(runtimeExport)
    return true
  })
}

function normalizeRuntimeOutputs(output: unknown): unknown[] {
  if (output === undefined) return []
  return Array.isArray(output) ? output : [output]
}

function isHonoModule(value: unknown): value is HonoModule {
  return isRecord(value) && isRecord(value.module) && isNonEmptyString(value.module.name)
}

function isHonoExtension(value: unknown): value is HonoExtension {
  return (
    isRecord(value) &&
    isRecord(value.extension) &&
    isNonEmptyString(value.extension.name) &&
    isNonEmptyString(value.extension.module)
  )
}

function isSubscriberRuntimeDescriptor(value: unknown): value is SubscriberRuntimeDescriptor {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.eventType) &&
    typeof value.register === "function"
  )
}

function isEventFilterDescriptor(value: unknown): value is EventFilterDescriptor {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.eventType) &&
    typeof value.register !== "function"
  )
}

function invalidRuntimeOutput(
  unit: VoyantGraphRuntimeUnitLoader,
  expected: "HonoModule" | "HonoExtension" | "HonoModule or HonoExtension",
  output: unknown,
): Error {
  return new Error(
    `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" must resolve to ${expected} output, got ${describeValue(output)}.`,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}
