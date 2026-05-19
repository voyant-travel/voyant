import type { CreateTripComponentInput } from "./validation.js"

export const CRUISE_EXTENSION_METADATA_KIND = "cruise_extension"

export type CruiseExtensionTargetKind = "cruise" | "cruise_sailing"
export type CruiseExtensionPlacement = "pre" | "post" | "either"
export type CruiseExtensionLifecycle = "dependent_extra" | "independent_component"

export interface CruiseExtensionLinkInput {
  extensionProductId: string
  targetKind: CruiseExtensionTargetKind
  targetId: string
  linkKey?: string
}

export interface CruiseExtensionLinkCommand {
  linkKey: string
  leftId: string
  rightId: string
}

export interface CruiseExtensionSelection {
  extensionProductId: string
  targetKind: CruiseExtensionTargetKind
  targetId: string
  placement: CruiseExtensionPlacement
  lifecycle: CruiseExtensionLifecycle
  quantity?: number
  metadata?: Record<string, unknown>
}

export interface CruiseExtensionExtra {
  kind: typeof CRUISE_EXTENSION_METADATA_KIND
  productId: string
  targetKind: CruiseExtensionTargetKind
  targetId: string
  placement: CruiseExtensionPlacement
  quantity: number
  metadata: Record<string, unknown>
}

export type CruiseExtensionRepresentation =
  | {
      mode: "nested_extra"
      extra: CruiseExtensionExtra
    }
  | {
      mode: "sibling_component"
      component: CreateTripComponentInput
    }

export function cruiseExtensionLinkKey(targetKind: CruiseExtensionTargetKind): string {
  return targetKind === "cruise"
    ? "cruiseProductExtensionLink"
    : "cruiseSailingProductExtensionLink"
}

export function createCruiseExtensionLinkCommand(
  input: CruiseExtensionLinkInput,
): CruiseExtensionLinkCommand {
  return {
    linkKey: input.linkKey ?? cruiseExtensionLinkKey(input.targetKind),
    leftId: input.targetId,
    rightId: input.extensionProductId,
  }
}

export function createCruiseExtensionExtra(
  selection: CruiseExtensionSelection,
): CruiseExtensionExtra {
  return {
    kind: CRUISE_EXTENSION_METADATA_KIND,
    productId: selection.extensionProductId,
    targetKind: selection.targetKind,
    targetId: selection.targetId,
    placement: selection.placement,
    quantity: selection.quantity ?? 1,
    metadata: selection.metadata ?? {},
  }
}

export function createCruiseExtensionComponent(
  envelopeId: string,
  selection: CruiseExtensionSelection,
  sequence = 0,
): CreateTripComponentInput {
  return {
    envelopeId,
    sequence,
    kind: "catalog_booking",
    catalogRef: {
      entityModule: "products",
      entityId: selection.extensionProductId,
      sourceKind: "owned",
    },
    metadata: {
      kind: CRUISE_EXTENSION_METADATA_KIND,
      targetKind: selection.targetKind,
      targetId: selection.targetId,
      placement: selection.placement,
      lifecycle: selection.lifecycle,
      quantity: selection.quantity ?? 1,
      ...(selection.metadata ?? {}),
    },
  }
}

export function representCruiseExtensionSelection(
  envelopeId: string,
  selection: CruiseExtensionSelection,
  sequence = 0,
): CruiseExtensionRepresentation {
  if (selection.lifecycle === "dependent_extra") {
    return {
      mode: "nested_extra",
      extra: createCruiseExtensionExtra(selection),
    }
  }

  return {
    mode: "sibling_component",
    component: createCruiseExtensionComponent(envelopeId, selection, sequence),
  }
}

export function groupCruiseExtensionLinksByProduct(
  links: CruiseExtensionLinkInput[],
): Map<string, CruiseExtensionLinkInput[]> {
  const grouped = new Map<string, CruiseExtensionLinkInput[]>()
  for (const link of links) {
    const existing = grouped.get(link.extensionProductId) ?? []
    existing.push(link)
    grouped.set(link.extensionProductId, existing)
  }
  return grouped
}
