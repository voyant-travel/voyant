// Contract types — McpToolDefinition, McpToolHandler, McpToolContext, results.
export {
  type McpAvailabilityResult,
  type McpCatalogServices,
  type McpQuoteResult,
  type McpResolvedEntity,
  type McpToolContent,
  type McpToolContext,
  type McpToolDefinition,
  McpToolError,
  type McpToolErrorCode,
  type McpToolHandler,
  type McpToolResult,
} from "./contract.js"

// Registry — register tools, dispatch by name, list, lookup.
export {
  type CreateMcpToolRegistryOptions,
  createMcpToolRegistry,
  enforceAudienceAuthorization,
  type McpToolListEntry,
  type McpToolRegistry,
  requireService,
} from "./registry.js"

// The five canonical catalog tools.
export {
  type CheckAvailabilityArgs,
  checkAvailabilityTool,
} from "./tools/check-availability.js"
export { type GetEntityArgs, getEntityTool } from "./tools/get-entity.js"
export { type GetQuoteArgs, getQuoteTool } from "./tools/get-quote.js"
export {
  type SearchCatalogArgs,
  searchCatalogTool,
} from "./tools/search-catalog.js"
export {
  type SuggestAlternativesArgs,
  suggestAlternativesTool,
} from "./tools/suggest-alternatives.js"
