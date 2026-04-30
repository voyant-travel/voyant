// Embedding contract + standard error codes.
export {
  chunkForBatch,
  EMBEDDING_BATCH_TOO_LARGE,
  EMBEDDING_INPUT_TOO_LONG,
  EMBEDDING_PROVIDER_ERROR,
  type EmbeddingProvider,
  type EmbeddingProviderCapabilities,
  EmbeddingProviderError,
} from "./embeddings/contract.js"
// Model registry helpers — validation + migration planning.
export {
  type EmbeddingMigrationPlan,
  isActiveEmbeddingModel,
  planEmbeddingMigration,
  stampEmbeddingModelId,
  validateEmbeddingCompatibility,
} from "./embeddings/model-registry.js"
// Default OpenAI provider.
export {
  createOpenAIEmbeddingProvider,
  embedBatched,
  OPENAI_MODELS,
  type OpenAIEmbeddingModel,
  type OpenAIEmbeddingProviderOptions,
} from "./embeddings/openai.js"
export {
  type FederatedSearchOptions,
  federateAudienceSearch,
  mergeAndDedupe,
} from "./search/federate.js"
// Search orchestration — semantic / hybrid / BYO-vector + federated.
export {
  executeBYOVectorSearch,
  executeSemanticSearch,
  type SemanticSearchOptions,
} from "./search/semantic.js"
