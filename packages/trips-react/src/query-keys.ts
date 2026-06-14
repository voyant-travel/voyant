export const tripsQueryKeys = {
  all: ["voyant", "trips"] as const,

  trips: () => [...tripsQueryKeys.all, "trips"] as const,
  tripList: (filters: Record<string, unknown>) =>
    [...tripsQueryKeys.trips(), "list", filters] as const,
  trip: (envelopeId: string) => [...tripsQueryKeys.trips(), "detail", envelopeId] as const,

  components: (envelopeId: string) => [...tripsQueryKeys.trip(envelopeId), "components"] as const,
  pricing: (envelopeId: string) => [...tripsQueryKeys.trip(envelopeId), "pricing"] as const,
  checkout: (envelopeId: string) => [...tripsQueryKeys.trip(envelopeId), "checkout"] as const,
} as const
