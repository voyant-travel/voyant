export {
  ResourceAllocationDetailPage,
  type ResourceAllocationDetailPageProps,
  ResourceAllocationDetailSkeleton,
} from "./components/resource-allocation-detail-page.js"
export {
  ResourceAssignmentDetailPage,
  type ResourceAssignmentDetailPageProps,
  ResourceAssignmentDetailSkeleton,
} from "./components/resource-assignment-detail-page.js"
export {
  ensureResourceAllocationDetailPageData,
  ensureResourceAssignmentDetailPageData,
  ensureResourceDetailPageData,
  ensureResourcePoolDetailPageData,
  getResourcePoolMembersQueryOptions,
  type ResourcePoolMemberRow,
  useResourcePoolMembers,
} from "./components/resource-detail-data.js"
export {
  ResourceDetailPage,
  type ResourceDetailPageProps,
  ResourceDetailSkeleton,
} from "./components/resource-detail-page.js"
export {
  type ConfirmAction,
  defaultConfirmAction,
  ResourceDetailCard,
  ResourceDetailField,
  ResourceDetailHeader,
  ResourceDetailState,
} from "./components/resource-detail-shared.js"
export {
  PoolAllocationSummary,
  ResourcePoolDetailPage,
  type ResourcePoolDetailPageProps,
  ResourcePoolDetailSkeleton,
} from "./components/resource-pool-detail-page.js"
export { ResourcesOverview } from "./components/resources-overview.js"
export {
  ResourcesPage,
  type ResourcesPageActiveFilter,
  type ResourcesPageBulkDeleteArgs,
  type ResourcesPageBulkDeleteHandler,
  type ResourcesPageBulkUpdateArgs,
  type ResourcesPageBulkUpdateHandler,
  type ResourcesPageProps,
  type ResourcesPageSlots,
  type ResourcesPageTab,
} from "./components/resources-page.js"
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
