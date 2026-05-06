export { ResourcesOverview } from "./components/resources-overview.js"
export { ResourcesSectionHeader } from "./components/resources-section-header.js"
export { AllocationsTab, PoolsTab, ResourcesTab } from "./components/resources-tabs-primary.js"
export { AssignmentsTab, CloseoutsTab } from "./components/resources-tabs-secondary.js"
export {
  type AllocationMode,
  type AssignmentStatus,
  getResourcesUiI18n,
  type ResourceKind,
  type ResourcesUiMessageOverrides,
  type ResourcesUiMessages,
  ResourcesUiMessagesProvider,
  resolveResourcesUiMessages,
  resourcesUiEn,
  resourcesUiMessageDefinitions,
  resourcesUiRo,
  useResourcesUiI18n,
  useResourcesUiI18nOrDefault,
  useResourcesUiMessages,
  useResourcesUiMessagesOrDefault,
} from "./i18n/index.js"
