export interface ProgramListFilters {
  status?: string | undefined
  type?: string | undefined
  organizationId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface DelegateListFilters {
  programId: string
  status?: string | undefined
  role?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface RfpListFilters {
  programId: string
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

/** React Query key factory for the MICE admin data layer. */
export const miceQueryKeys = {
  all: ["voyant", "mice"] as const,

  programs: () => [...miceQueryKeys.all, "programs"] as const,
  programsList: (filters: ProgramListFilters) =>
    [...miceQueryKeys.programs(), "list", filters] as const,
  program: (id: string) => [...miceQueryKeys.programs(), "detail", id] as const,
  programCostSheet: (id: string) => [...miceQueryKeys.program(id), "cost-sheet"] as const,

  sessions: () => [...miceQueryKeys.all, "sessions"] as const,
  sessionsList: (programId: string) => [...miceQueryKeys.sessions(), "list", programId] as const,

  delegates: () => [...miceQueryKeys.all, "delegates"] as const,
  delegatesList: (filters: DelegateListFilters) =>
    [...miceQueryKeys.delegates(), "list", filters] as const,
  delegate: (id: string) => [...miceQueryKeys.delegates(), "detail", id] as const,

  rooming: () => [...miceQueryKeys.all, "rooming"] as const,
  roomingList: (programId: string) => [...miceQueryKeys.rooming(), "list", programId] as const,
  roomingAssignment: (id: string) => [...miceQueryKeys.rooming(), "detail", id] as const,

  bookingMiceDetails: (bookingId: string) =>
    [...miceQueryKeys.all, "booking-mice-details", bookingId] as const,

  rfps: () => [...miceQueryKeys.all, "rfps"] as const,
  rfpsList: (filters: RfpListFilters) => [...miceQueryKeys.rfps(), "list", filters] as const,
  rfp: (id: string) => [...miceQueryKeys.rfps(), "detail", id] as const,

  bid: (id: string) => [...miceQueryKeys.all, "bids", "detail", id] as const,
} as const
