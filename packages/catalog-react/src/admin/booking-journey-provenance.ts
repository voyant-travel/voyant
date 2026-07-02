export interface BookingJourneyProvenanceInput {
  sourceKind?: string | null
  sourceConnectionId?: string | null
  sourceRef?: string | null
}

export function bookingJourneyProvenanceSearchParams(
  input: BookingJourneyProvenanceInput,
): Record<string, string> {
  const sourceKind = cleaned(input.sourceKind)
  const sourceConnectionId = cleaned(input.sourceConnectionId)
  const sourceRef = cleaned(input.sourceRef)

  // `voyant-connect` is a catalog provenance kind, but it is not always a
  // registered booking-engine adapter in local/demo deployments. Without a
  // connection id, let the booking route resolve the registered source from
  // (entityModule, entityId) instead of pinning the URL to an adapter kind that
  // may not exist in this deployment.
  const shouldPinSourceKind =
    sourceKind !== undefined &&
    (sourceKind !== "voyant-connect" || sourceConnectionId !== undefined)

  return {
    ...(shouldPinSourceKind ? { sourceKind } : {}),
    ...(sourceConnectionId ? { sourceConnectionId } : {}),
    ...(sourceRef ? { sourceRef } : {}),
  }
}

function cleaned(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
