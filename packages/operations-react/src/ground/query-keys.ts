export interface GroundOperatorsListFilters {
  supplierId?: string | undefined
  facilityId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface GroundVehiclesListFilters {
  resourceId?: string | undefined
  operatorId?: string | undefined
  category?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface GroundDriversListFilters {
  resourceId?: string | undefined
  operatorId?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const groundQueryKeys = {
  all: ["ground"] as const,
  operators: () => [...groundQueryKeys.all, "operators"] as const,
  operatorsList: (filters: GroundOperatorsListFilters) =>
    [...groundQueryKeys.operators(), filters] as const,
  operator: (id: string) => [...groundQueryKeys.operators(), id] as const,
  vehicles: () => [...groundQueryKeys.all, "vehicles"] as const,
  vehiclesList: (filters: GroundVehiclesListFilters) =>
    [...groundQueryKeys.vehicles(), filters] as const,
  vehicle: (id: string) => [...groundQueryKeys.vehicles(), id] as const,
  drivers: () => [...groundQueryKeys.all, "drivers"] as const,
  driversList: (filters: GroundDriversListFilters) =>
    [...groundQueryKeys.drivers(), filters] as const,
  driver: (id: string) => [...groundQueryKeys.drivers(), id] as const,
}
