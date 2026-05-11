import { existsSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export const remoteWorkspaceCapabilityNames = [
  "inspect",
  "exec",
  "spawn",
  "exposeHttp",
  "collectArtifacts",
  "dispose",
]

const providerNamePattern = /^[a-z][a-z0-9-]{0,31}$/

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

export async function loadRemoteWorkspaceAdapters({
  configPath,
  env = process.env,
  repoRoot,
} = {}) {
  const adapterConfigPath = remoteWorkspaceAdapterConfigPath({ configPath, env, repoRoot })
  if (!adapterConfigPath) return {}

  const moduleExports = await import(pathToFileURL(adapterConfigPath).href)
  const configuredAdapters = moduleExports.remoteWorkspaceAdapters ?? moduleExports.default
  const adapters =
    typeof configuredAdapters === "function"
      ? await configuredAdapters({ env, repoRoot })
      : configuredAdapters

  return validateRemoteWorkspaceAdapters(adapters, adapterConfigPath)
}

export function remoteWorkspaceAdapterConfigPath({ configPath, env = process.env, repoRoot } = {}) {
  const configuredPath = configPath ?? env.VOYANT_AGENT_REMOTE_ADAPTER_CONFIG
  if (configuredPath) {
    const resolvedPath = path.resolve(repoRoot ?? process.cwd(), configuredPath)
    if (!existsSync(resolvedPath)) {
      throw new Error(`remote workspace adapter config does not exist: ${resolvedPath}`)
    }
    return resolvedPath
  }

  if (!repoRoot) return null

  const defaultPath = path.join(repoRoot, ".agents", "remote-workspaces.mjs")
  return existsSync(defaultPath) ? defaultPath : null
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

function validateRemoteWorkspaceAdapters(adapters, adapterConfigPath) {
  if (!adapters || typeof adapters !== "object" || Array.isArray(adapters)) {
    throw new Error(
      `remote workspace adapter config must export an adapter map: ${adapterConfigPath}`,
    )
  }

  for (const [provider, factory] of Object.entries(adapters)) {
    if (!providerNamePattern.test(provider)) {
      throw new Error(`remote workspace adapter provider is invalid: ${provider}`)
    }

    if (typeof factory !== "function") {
      throw new Error(`remote workspace adapter ${provider} must be a factory function`)
    }
  }

  return adapters
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
