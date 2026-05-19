export const travelComposerQueryKeys = {
  all: ["voyant", "travel-composer"] as const,

  trips: () => [...travelComposerQueryKeys.all, "trips"] as const,
  tripList: (filters: Record<string, unknown>) =>
    [...travelComposerQueryKeys.trips(), "list", filters] as const,
  trip: (envelopeId: string) => [...travelComposerQueryKeys.trips(), "detail", envelopeId] as const,

  components: (envelopeId: string) =>
    [...travelComposerQueryKeys.trip(envelopeId), "components"] as const,
  pricing: (envelopeId: string) =>
    [...travelComposerQueryKeys.trip(envelopeId), "pricing"] as const,
  checkout: (envelopeId: string) =>
    [...travelComposerQueryKeys.trip(envelopeId), "checkout"] as const,
} as const
