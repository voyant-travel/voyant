/**
 * The in-deployment MCP server (voyant#2792). Exposes a `@voyant-travel/tools`
 * `ToolRegistry` as a real Model Context Protocol server, mounted as a Hono
 * route group inside the operator app at `/v1/admin/mcp` — stateless, no Durable
 * Object (see the Sub-issue 0 spike). External MCP clients connect over the wire.
 *
 * Transport: `@modelcontextprotocol/sdk` `McpServer` connected to `@hono/mcp`'s
 * web-standard `StreamableHTTPTransport`. A fresh server + transport per request
 * keeps it stateless, so the lazy-route `c.var` hydration (db lease / actor /
 * scopes / audience) is all the context we need.
 *
 * Authorization (D2): each tool's `requiredScopes` are checked against the
 * caller's granted scopes with **AND** semantics. Unauthorized tools are neither
 * listed nor registered on the per-request server, so they cannot be called.
 */
import { StreamableHTTPTransport } from "@hono/mcp"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import {
  createToolRegistry,
  TOOL_CONTEXT_CONTRIBUTION_EXPORT,
  TOOL_CONTRACT_VERSION,
  type ToolContext,
  type ToolContextContribution,
  ToolError,
  type ToolRegistry,
} from "@voyant-travel/tools"
import {
  type AccessCatalog,
  type ApiKeyPermissions,
  hasApiKeyPermission,
  permissionStringsToPermissions,
} from "@voyant-travel/types/api-keys"
import { type Context, Hono } from "hono"
import { z } from "zod"

export interface McpServerInfo {
  name: string
  version: string
}

export interface McpHonoAppOptions {
  /** The tool registry to expose. */
  registry: ToolRegistry
  /** Build the per-request tool context from the Hono context (db/actor/audience/scope). */
  buildContext(c: Context): ToolContext | Promise<ToolContext>
  /** Selected graph authority for wildcard and explicit-action policy. */
  accessCatalog: AccessCatalog
  /** MCP server identity advertised in `initialize`. */
  serverInfo?: McpServerInfo
}

export interface GraphMcpHonoAppOptions {
  runtime: GraphMcpRuntime
  buildContext(c: Context): ToolContext
  buildResources?(c: Context): Readonly<Record<string, unknown>>
  /** Context keys supplied by the deployment while packages migrate to contributions. */
  providedContext?: readonly string[]
  serverInfo?: McpServerInfo
}

export interface GraphMcpRuntime {
  accessCatalog: AccessCatalog
  tools: readonly {
    referenceId: string
    context?: readonly string[]
    load<T = unknown>(): Promise<T>
  }[]
  references: readonly {
    id: string
    importEntry: string
    loadModule<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>
  }[]
}

const DEFAULT_SERVER_INFO: McpServerInfo = { name: "voyant-mcp", version: "0.1.0" }

/**
 * Build the MCP Hono sub-app. Mount at `/v1/admin/mcp`:
 * - `POST /` — MCP JSON-RPC (`initialize` / `tools/list` / `tools/call`).
 * - `GET /manifest` — the tool discovery manifest (contract-versioned), filtered
 *   to what the caller is authorized for.
 */
export function createMcpHonoApp(options: McpHonoAppOptions): Hono {
  const { accessCatalog, registry, buildContext } = options
  const serverInfo = options.serverInfo ?? DEFAULT_SERVER_INFO
  const app = new Hono()

  app.get("/manifest", (c) => {
    const permissions = callerPermissions(c)
    const tools = registry
      .list()
      .filter((tool) => isAuthorized(tool.requiredScopes, permissions, accessCatalog))
    return c.json({ version: TOOL_CONTRACT_VERSION, serverInfo, tools })
  })

  app.all("/", async (c) => {
    const permissions = callerPermissions(c)
    const ctx = await buildContext(c)
    const server = new McpServer(serverInfo)

    for (const entry of registry.list()) {
      if (!isAuthorized(entry.requiredScopes, permissions, accessCatalog)) continue
      const def = registry.get(entry.name)
      if (!def) continue
      server.tool(entry.name, entry.description, toRawShape(def.inputSchema), (args) =>
        dispatchToResult(registry, entry.name, args, ctx),
      )
    }

    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    return transport.handleRequest(c)
  })

  return app
}

/** Compose selected tools and their package-owned context contributors from one graph. */
export async function createGraphMcpHonoApp(options: GraphMcpHonoAppOptions): Promise<Hono> {
  const registry = createToolRegistry()
  const contributions = new Map<string, ToolContextContribution>()
  const requiredContext = new Set<string>()

  for (const tool of options.runtime.tools) {
    registry.register(await tool.load<Parameters<ToolRegistry["register"]>[0]>())
    for (const key of tool.context ?? []) requiredContext.add(key)

    const reference = options.runtime.references.find(({ id }) => id === tool.referenceId)
    if (!reference || contributions.has(reference.importEntry)) continue
    const namespace = await reference.loadModule()
    const contribution = namespace[TOOL_CONTEXT_CONTRIBUTION_EXPORT]
    if (contribution !== undefined) {
      assertToolContextContribution(contribution, reference.importEntry)
      contributions.set(reference.importEntry, contribution)
    }
  }

  const contextOwners = new Map<string, string>()
  for (const [importEntry, contribution] of contributions) {
    for (const key of contribution.context) {
      const owner = contextOwners.get(key)
      if (owner && owner !== importEntry) {
        throw new Error(
          `Selected MCP runtimes "${owner}" and "${importEntry}" both contribute context "${key}".`,
        )
      }
      contextOwners.set(key, importEntry)
    }
  }
  const contributedContext = new Set(contextOwners.keys())
  const providedContext = new Set(options.providedContext ?? [])
  const missing = [...requiredContext]
    .filter((key) => !contributedContext.has(key) && !providedContext.has(key))
    .sort()
  if (missing.length > 0) {
    throw new Error(`Selected MCP tools have no context contribution for: ${missing.join(", ")}.`)
  }

  return createMcpHonoApp({
    accessCatalog: options.runtime.accessCatalog,
    registry,
    ...(options.serverInfo ? { serverInfo: options.serverInfo } : {}),
    buildContext: (c) => buildContributedContext(c, options, contributions.values()),
  })
}

async function buildContributedContext(
  c: Context,
  options: GraphMcpHonoAppOptions,
  contributions: Iterable<ToolContextContribution>,
): Promise<ToolContext> {
  const base = await options.buildContext(c)
  const resources = options.buildResources?.(c) ?? {}
  let context: ToolContext & Record<string, unknown> = base as ToolContext & Record<string, unknown>
  for (const contribution of contributions) {
    const contributed = await contribution.contribute({ request: c, context, resources })
    const undeclared = Object.keys(contributed).filter((key) => !contribution.context.includes(key))
    if (undeclared.length > 0) {
      throw new Error(
        `Tool context contribution returned undeclared keys: ${undeclared.sort().join(", ")}.`,
      )
    }
    context = {
      ...context,
      ...contributed,
    }
  }
  return context
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertToolContextContribution(
  value: unknown,
  importEntry: string,
): asserts value is ToolContextContribution {
  if (
    !isRecord(value) ||
    !Array.isArray(value.context) ||
    value.context.some((key) => typeof key !== "string" || key.length === 0) ||
    typeof value.contribute !== "function"
  ) {
    throw new Error(
      `MCP runtime entry "${importEntry}" exports an invalid ${TOOL_CONTEXT_CONTRIBUTION_EXPORT}.`,
    )
  }
}

/** Resolve the caller's granted permissions from `c.var.scopes`. */
function callerPermissions(c: Context): ApiKeyPermissions {
  const scopes = (c.var as { scopes?: string[] | null }).scopes ?? []
  return permissionStringsToPermissions(scopes)
}

/** AND semantics — the caller must hold every one of the tool's required scopes. */
function isAuthorized(
  requiredScopes: readonly string[],
  permissions: ApiKeyPermissions,
  accessCatalog: AccessCatalog,
): boolean {
  return requiredScopes.every((scope) => {
    const [resource, action] = scope.split(":")
    return Boolean(
      resource && action && hasApiKeyPermission(permissions, resource, action, accessCatalog),
    )
  })
}

/** Extract a Zod raw shape for the MCP SDK. Tool inputs are objects by convention. */
function toRawShape(schema: z.ZodType): z.ZodRawShape {
  if (schema instanceof z.ZodObject) return schema.shape as z.ZodRawShape
  return {}
}

/** Dispatch through the registry (validates in + out) and wrap pure data in an MCP envelope. */
async function dispatchToResult(
  registry: ToolRegistry,
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<CallToolResult> {
  try {
    const data = await registry.dispatch(name, args, ctx)
    return {
      content: [{ type: "text", text: safeStringify(data) }],
      structuredContent: toStructuredContent(data),
    }
  } catch (err) {
    const code = err instanceof ToolError ? err.code : "PROVIDER_ERROR"
    const message = err instanceof Error ? err.message : String(err)
    return { isError: true, content: [{ type: "text", text: `[${code}] ${message}` }] }
  }
}

function toStructuredContent(data: unknown): Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : { result: data }
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
