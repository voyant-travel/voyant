import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export const remoteWorkspaceCapabilityNames = [
  "inspect",
  "exec",
  "spawn",
  "exposeHttp",
  "collectArtifacts",
  "dispose",
]

export function resolveRemoteWorkspaceAdapter(descriptor, { adapters = {} } = {}) {
  assertRemoteWorkspaceDescriptor(descriptor)

  const factory = adapters[descriptor.provider]
  if (!factory) {
    return unsupportedRemoteWorkspaceAdapter(descriptor, {
      availableProviders: Object.keys(adapters).sort(),
    })
  }

  return validateRemoteWorkspaceAdapter(factory(descriptor), descriptor)
}

export function unsupportedRemoteWorkspaceAdapter(descriptor, { availableProviders = [] } = {}) {
  assertRemoteWorkspaceDescriptor(descriptor)

  const reason = `remote workspace provider ${descriptor.provider} is not configured`
  const unsupported = (operation) => {
    throw new Error(`${operation} is unavailable: ${reason}`)
  }

  return {
    id: descriptor.id,
    kind: descriptor.kind,
    provider: descriptor.provider,
    ready: false,
    reason,
    reference: descriptor.reference,
    capabilities: {
      inspect: true,
      exec: false,
      spawn: false,
      exposeHttp: false,
      collectArtifacts: false,
      dispose: false,
    },
    async inspect() {
      return {
        availableProviders,
        capabilities: this.capabilities,
        id: this.id,
        kind: this.kind,
        provider: this.provider,
        ready: false,
        reason,
        reference: this.reference,
      }
    },
    async exec() {
      unsupported("exec")
    },
    async spawn() {
      unsupported("spawn")
    },
    async exposeHttp() {
      unsupported("exposeHttp")
    },
    async collectArtifacts() {
      unsupported("collectArtifacts")
    },
    async dispose() {
      unsupported("dispose")
    },
  }
}

export function assertRemoteWorkspaceDescriptor(descriptor) {
  if (descriptor?.kind === "invalid") {
    throw new Error(`invalid remote workspace reference: ${descriptor.reason}`)
  }

  if (!isRemoteWorkspaceDescriptor(descriptor)) {
    throw new Error(
      `remote workspace adapter requires a remote-sandbox reference; got ${
        descriptor?.kind ?? "unknown"
      }`,
    )
  }
}

export function validateRemoteWorkspaceAdapter(adapter, descriptor) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error(`remote workspace adapter ${descriptor.provider} did not return an object`)
  }

  for (const operation of remoteWorkspaceCapabilityNames) {
    if (operation === "inspect") {
      assertFunction(adapter, operation, descriptor)
      continue
    }

    if (adapter.capabilities?.[operation]) {
      assertFunction(adapter, operation, descriptor)
    }
  }

  return {
    id: adapter.id ?? descriptor.id,
    kind: adapter.kind ?? descriptor.kind,
    provider: adapter.provider ?? descriptor.provider,
    ready: Boolean(adapter.ready),
    reason: adapter.reason ?? null,
    reference: adapter.reference ?? descriptor.reference,
    capabilities: normalizeCapabilities(adapter.capabilities),
    inspect: adapter.inspect.bind(adapter),
    exec: bindOptional(adapter, "exec"),
    spawn: bindOptional(adapter, "spawn"),
    exposeHttp: bindOptional(adapter, "exposeHttp"),
    collectArtifacts: bindOptional(adapter, "collectArtifacts"),
    dispose: bindOptional(adapter, "dispose"),
  }
}

function normalizeCapabilities(capabilities = {}) {
  return Object.fromEntries(
    remoteWorkspaceCapabilityNames.map((capability) => [
      capability,
      Boolean(capabilities[capability]),
    ]),
  )
}

function assertFunction(adapter, operation, descriptor) {
  if (typeof adapter[operation] !== "function") {
    throw new Error(
      `remote workspace adapter ${descriptor.provider} declares ${operation} but does not implement it`,
    )
  }
}

function bindOptional(adapter, operation) {
  return typeof adapter[operation] === "function" ? adapter[operation].bind(adapter) : undefined
}
