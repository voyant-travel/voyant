export interface FacilitiesListFilters {
  search?: string | undefined
  kind?: string | undefined
  status?: string | undefined
  ownerType?: string | undefined
  ownerId?: string | undefined
  parentFacilityId?: string | undefined
  country?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface FacilityFeaturesListFilters {
  facilityId?: string | undefined
  category?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface FacilityOperationSchedulesListFilters {
  facilityId?: string | undefined
  dayOfWeek?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PropertiesListFilters {
  facilityId?: string | undefined
  propertyType?: string | undefined
  groupName?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PropertyGroupsListFilters {
  parentGroupId?: string | undefined
  groupType?: string | undefined
  status?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PropertyGroupMembersListFilters {
  groupId?: string | undefined
  propertyId?: string | undefined
  membershipRole?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const facilitiesQueryKeys = {
  all: ["facilities"] as const,
  facilities: () => [...facilitiesQueryKeys.all, "facilities"] as const,
  facilitiesList: (filters: FacilitiesListFilters) =>
    [...facilitiesQueryKeys.facilities(), filters] as const,
  facility: (id: string) => [...facilitiesQueryKeys.facilities(), id] as const,
  facilityFeatures: () => [...facilitiesQueryKeys.all, "facility-features"] as const,
  facilityFeaturesList: (filters: FacilityFeaturesListFilters) =>
    [...facilitiesQueryKeys.facilityFeatures(), filters] as const,
  facilityFeature: (id: string) => [...facilitiesQueryKeys.facilityFeatures(), id] as const,
  facilityOperationSchedules: () =>
    [...facilitiesQueryKeys.all, "facility-operation-schedules"] as const,
  facilityOperationSchedulesList: (filters: FacilityOperationSchedulesListFilters) =>
    [...facilitiesQueryKeys.facilityOperationSchedules(), filters] as const,
  facilityOperationSchedule: (id: string) =>
    [...facilitiesQueryKeys.facilityOperationSchedules(), id] as const,
  properties: () => [...facilitiesQueryKeys.all, "properties"] as const,
  propertiesList: (filters: PropertiesListFilters) =>
    [...facilitiesQueryKeys.properties(), filters] as const,
  property: (id: string) => [...facilitiesQueryKeys.properties(), id] as const,
  propertyGroups: () => [...facilitiesQueryKeys.all, "property-groups"] as const,
  propertyGroupsList: (filters: PropertyGroupsListFilters) =>
    [...facilitiesQueryKeys.propertyGroups(), filters] as const,
  propertyGroup: (id: string) => [...facilitiesQueryKeys.propertyGroups(), id] as const,
  propertyGroupMembers: () => [...facilitiesQueryKeys.all, "property-group-members"] as const,
  propertyGroupMembersList: (filters: PropertyGroupMembersListFilters) =>
    [...facilitiesQueryKeys.propertyGroupMembers(), filters] as const,
  propertyGroupMember: (id: string) => [...facilitiesQueryKeys.propertyGroupMembers(), id] as const,
}

export type PlacesListFilters = FacilitiesListFilters
export type PlaceFeaturesListFilters = FacilityFeaturesListFilters
export type PlaceOperationSchedulesListFilters = FacilityOperationSchedulesListFilters
export const placesQueryKeys = facilitiesQueryKeys
