export const tripComposerQueryKeys = {
  all: ["voyant", "trip-composer"] as const,

  trips: () => [...tripComposerQueryKeys.all, "trips"] as const,
  tripList: (filters: Record<string, unknown>) =>
    [...tripComposerQueryKeys.trips(), "list", filters] as const,
  trip: (envelopeId: string) => [...tripComposerQueryKeys.trips(), "detail", envelopeId] as const,

  components: (envelopeId: string) =>
    [...tripComposerQueryKeys.trip(envelopeId), "components"] as const,
  pricing: (envelopeId: string) => [...tripComposerQueryKeys.trip(envelopeId), "pricing"] as const,
  checkout: (envelopeId: string) =>
    [...tripComposerQueryKeys.trip(envelopeId), "checkout"] as const,
} as const
