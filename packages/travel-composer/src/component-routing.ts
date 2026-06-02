import { type BookingDraftV1, bookingDraftV1 } from "@voyantjs/catalog/booking-engine"
import type { ComponentRef, TravelComponent } from "@voyantjs/travel-components-contracts"

import type { CreateTripComponentBodyInput } from "./validation.js"

export interface ComponentSelectionInput {
  componentId: string
  choiceId?: string
  quantity?: number
}

export interface ProjectIndependentCatalogComponentsInput {
  components: ReadonlyArray<TravelComponent>
  selections?: ReadonlyArray<ComponentSelectionInput>
  baseBookingDraft?: Partial<BookingDraftV1>
  startSequence?: number
}

export interface ProjectedIndependentCatalogComponent extends CreateTripComponentBodyInput {
  metadata: CreateTripComponentBodyInput["metadata"] & {
    bookingDraftV1: BookingDraftV1
    productComponent: {
      componentId: string
      componentKind: TravelComponent["component_kind"]
      choiceId?: string
      commitmentBoundary: "independent_component"
      priceDisposition: TravelComponent["price_disposition"]
      quantity: number
    }
  }
}

export function projectIndependentCatalogComponents(
  input: ProjectIndependentCatalogComponentsInput,
): ProjectedIndependentCatalogComponent[] {
  const selectedByComponentId = groupSelections(input.selections)
  const output: ProjectedIndependentCatalogComponent[] = []

  for (const component of input.components) {
    if (component.commitment_boundary !== "independent_component") continue

    const selections = selectedByComponentId.get(component.id) ?? []
    const routed = routeComponent(component, selections)

    for (const route of routed) {
      const catalogRef = catalogRefFromComponentRef(route.ref)
      const bookingDraft = bookingDraftV1.parse({
        ...input.baseBookingDraft,
        entity: {
          module: catalogRef.entityModule,
          id: catalogRef.entityId,
          sourceKind: catalogRef.sourceKind,
          ...(catalogRef.sourceConnectionId
            ? { sourceConnectionId: catalogRef.sourceConnectionId }
            : {}),
          ...(catalogRef.sourceRef ? { sourceRef: catalogRef.sourceRef } : {}),
        },
        configure: {
          ...(input.baseBookingDraft?.configure ?? {}),
          pax: input.baseBookingDraft?.configure?.pax ?? {},
          componentSelections: undefined,
        },
      })

      output.push({
        kind: "catalog_booking",
        sequence: (input.startSequence ?? 0) + output.length,
        description: component.summary ?? component.description ?? undefined,
        catalogRef,
        metadata: {
          bookingDraftV1: bookingDraft,
          productComponent: {
            componentId: component.id,
            componentKind: component.component_kind,
            ...(route.choiceId ? { choiceId: route.choiceId } : {}),
            commitmentBoundary: "independent_component",
            priceDisposition: component.price_disposition,
            quantity: route.quantity,
          },
        },
      })
    }
  }

  return output
}

function routeComponent(
  component: TravelComponent,
  selections: ReadonlyArray<ComponentSelectionInput>,
): Array<{ ref: ComponentRef; choiceId?: string; quantity: number }> {
  if (component.choices.length === 0) {
    if (component.selection !== "fixed" && selections.length === 0) return []
    return component.binding.type === "ref"
      ? [{ ref: component.binding.ref, quantity: positiveQuantity(selections[0]?.quantity) }]
      : []
  }

  const selectedChoices =
    selections.length > 0
      ? selections.flatMap((selection) => {
          const choice = component.choices.find((candidate) => candidate.id === selection.choiceId)
          return choice ? [{ choice, quantity: positiveQuantity(selection.quantity) }] : []
        })
      : component.required
        ? component.choices
            .filter((choice) => choice.is_default)
            .map((choice) => ({ choice, quantity: positiveQuantity(component.quantity) }))
        : []

  return selectedChoices.flatMap(({ choice, quantity }) => {
    const ref = choice.ref ?? (component.binding.type === "ref" ? component.binding.ref : undefined)
    return ref ? [{ ref, choiceId: choice.id, quantity }] : []
  })
}

function groupSelections(
  selections: ReadonlyArray<ComponentSelectionInput> | undefined,
): Map<string, ComponentSelectionInput[]> {
  const grouped = new Map<string, ComponentSelectionInput[]>()
  for (const selection of selections ?? []) {
    if (!selection.componentId) continue
    const bucket = grouped.get(selection.componentId) ?? []
    bucket.push(selection)
    grouped.set(selection.componentId, bucket)
  }
  return grouped
}

function catalogRefFromComponentRef(
  ref: ComponentRef,
): NonNullable<CreateTripComponentBodyInput["catalogRef"]> {
  return {
    entityModule: ref.entity_module,
    entityId: ref.entity_id,
    sourceKind: ref.source_kind ?? "owned",
    ...(ref.source_connection_id ? { sourceConnectionId: ref.source_connection_id } : {}),
    ...(ref.source_ref ? { sourceRef: ref.source_ref } : {}),
  }
}

function positiveQuantity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}
