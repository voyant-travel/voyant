"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  type PackageI18nValue,
  resolvePackageMessages,
} from "@voyantjs/i18n"
import type { ReactNode } from "react"

export type AllocationUiMessages = Record<string, unknown> & {
  pageTitle: string
  loading: string
  empty: string
  back: string
  addRoom: string
  addResource: string
  generateRooms: string
  generatingRooms: string
  generateResources: string
  generatingResources: string
  autoAllocate: string
  autoAllocating: string
  exportPassengers: string
  exportRooming: string
  auditLog: string
  auditLogDescription: string
  auditActions: Record<string, string>
  roomLabel: string
  roomCapacity: string
  createRoom: string
  resourceLabel: string
  resourceCapacity: string
  createResource: string
  cancel: string
  unallocated: string
  unallocatedDescription: string
  rooms: string
  resources: string
  vehicleSeats: string
  cabins: string
  flightSeats: string
  travelers: string
  capacity: string
  lead: string
  sharingGroup: string
  accessibility: string
  dietary: string
  smokingAllowed: string
  remove: string
  overCapacity: string
  dropHere: string
  noRooms: string
  noResources: string
  noSeats: string
  windowSeat: string
  aisleSeat: string
  middleSeat: string
  validationTitle: string
  validationClear: string
  validationUnallocated: string
  validationOverCapacity: string
  validationSplitGroup: string
  allocationFailed: string
  createRoomFailed: string
  createResourceFailed: string
  generateRoomsFailed: string
  generateResourcesFailed: string
  autoAllocateFailed: string
}

export const allocationUiEn = {
  pageTitle: "Allocation",
  loading: "Loading allocation...",
  empty: "No travelers on this departure yet.",
  back: "Back",
  addRoom: "Add room",
  addResource: "Add resource",
  generateRooms: "Generate rooms",
  generatingRooms: "Generating...",
  generateResources: "Generate resources",
  generatingResources: "Generating...",
  autoAllocate: "Auto-allocate",
  autoAllocating: "Allocating...",
  exportPassengers: "Passengers",
  exportRooming: "Rooming",
  auditLog: "Audit log",
  auditLogDescription: "Recent allocation changes for this departure.",
  auditActions: {
    "resource.create": "Resource created",
    "resource.update": "Resource updated",
    "resource.delete": "Resource deleted",
    "traveler.assign": "Traveler assigned",
    "traveler.unassign": "Traveler unassigned",
    "traveler.sharing-group.set": "Sharing group set",
    "traveler.sharing-group.clear": "Sharing group cleared",
    "sharing-group.label.update": "Group label updated",
    "sharing-group.label.clear": "Group label cleared",
    "resources.materialize": "Resources generated",
    "auto-allocate": "Auto-allocate",
  },
  roomLabel: "Room label",
  roomCapacity: "Capacity",
  createRoom: "Create room",
  resourceLabel: "Resource label",
  resourceCapacity: "Capacity",
  createResource: "Create resource",
  cancel: "Cancel",
  unallocated: "Unallocated",
  unallocatedDescription: "Travelers not assigned to this resource kind.",
  rooms: "Rooms",
  resources: "Resources",
  vehicleSeats: "Vehicle seats",
  cabins: "Cabins",
  flightSeats: "Flight seats",
  travelers: "travelers",
  capacity: "Capacity",
  lead: "Lead",
  sharingGroup: "Sharing group",
  accessibility: "Accessibility",
  dietary: "Dietary",
  smokingAllowed: "Smoking",
  remove: "Remove",
  overCapacity: "Resource is full",
  dropHere: "Drop traveler here",
  noRooms: "No rooms have been added for this slot.",
  noResources: "No resources have been added for this slot.",
  noSeats: "No vehicle seats have been generated for this slot.",
  windowSeat: "Window",
  aisleSeat: "Aisle",
  middleSeat: "Middle",
  validationTitle: "Allocation needs attention",
  validationClear: "No validation issues",
  validationUnallocated: "unallocated",
  validationOverCapacity: "is over capacity",
  validationSplitGroup: "Split sharing group",
  allocationFailed: "Could not update allocation.",
  createRoomFailed: "Could not create room.",
  createResourceFailed: "Could not create resource.",
  generateRoomsFailed: "Could not generate rooms.",
  generateResourcesFailed: "Could not generate resources.",
  autoAllocateFailed: "Could not auto-allocate travelers.",
} satisfies AllocationUiMessages

export const allocationUiRo = {
  pageTitle: "Alocare",
  loading: "Se incarca alocarea...",
  empty: "Nu exista calatori pe aceasta plecare.",
  back: "Inapoi",
  addRoom: "Adauga camera",
  addResource: "Adauga resursa",
  generateRooms: "Genereaza camere",
  generatingRooms: "Se genereaza...",
  generateResources: "Genereaza resurse",
  generatingResources: "Se genereaza...",
  autoAllocate: "Auto-aloca",
  autoAllocating: "Se aloca...",
  exportPassengers: "Pasageri",
  exportRooming: "Rooming",
  auditLog: "Istoric",
  auditLogDescription: "Ultimele modificari de alocare pentru aceasta plecare.",
  auditActions: {
    "resource.create": "Resursa creata",
    "resource.update": "Resursa actualizata",
    "resource.delete": "Resursa stearsa",
    "traveler.assign": "Calator alocat",
    "traveler.unassign": "Calator dezalocat",
    "traveler.sharing-group.set": "Grup partaj setat",
    "traveler.sharing-group.clear": "Grup partaj sters",
    "sharing-group.label.update": "Eticheta grup actualizata",
    "sharing-group.label.clear": "Eticheta grup stearsa",
    "resources.materialize": "Resurse generate",
    "auto-allocate": "Auto-alocare",
  },
  roomLabel: "Eticheta camera",
  roomCapacity: "Capacitate",
  createRoom: "Creeaza camera",
  resourceLabel: "Eticheta resursa",
  resourceCapacity: "Capacitate",
  createResource: "Creeaza resursa",
  cancel: "Anuleaza",
  unallocated: "Nealocati",
  unallocatedDescription: "Calatori fara acest tip de resursa alocat.",
  rooms: "Camere",
  resources: "Resurse",
  vehicleSeats: "Locuri vehicul",
  cabins: "Cabine",
  flightSeats: "Locuri zbor",
  travelers: "calatori",
  capacity: "Capacitate",
  lead: "Lead",
  sharingGroup: "Grup partaj",
  accessibility: "Accesibilitate",
  dietary: "Dieta",
  smokingAllowed: "Fumat",
  remove: "Scoate",
  overCapacity: "Resursa este plina",
  dropHere: "Trage calatorul aici",
  noRooms: "Nu exista camere adaugate pentru acest slot.",
  noResources: "Nu exista resurse adaugate pentru acest slot.",
  noSeats: "Nu exista locuri generate pentru acest slot.",
  windowSeat: "Geam",
  aisleSeat: "Culoar",
  middleSeat: "Mijloc",
  validationTitle: "Alocarea necesita atentie",
  validationClear: "Fara probleme de validare",
  validationUnallocated: "nealocati",
  validationOverCapacity: "depaseste capacitatea",
  validationSplitGroup: "Grup partaj impartit",
  allocationFailed: "Alocarea nu a putut fi actualizata.",
  createRoomFailed: "Camera nu a putut fi creata.",
  createResourceFailed: "Resursa nu a putut fi creata.",
  generateRoomsFailed: "Camerele nu au putut fi generate.",
  generateResourcesFailed: "Resursele nu au putut fi generate.",
  autoAllocateFailed: "Calatorii nu au putut fi auto-alocati.",
} satisfies AllocationUiMessages

const fallbackLocale = "en"

export const allocationUiMessageDefinitions = {
  en: allocationUiEn,
  ro: allocationUiRo,
} satisfies LocaleMessageDefinitions<AllocationUiMessages>

export type AllocationUiMessageOverrides = LocaleMessageOverrides<AllocationUiMessages>

const allocationUiContext =
  createPackageMessagesContext<AllocationUiMessages>("AllocationUiMessages")

const defaultAllocationUiI18n: PackageI18nValue<AllocationUiMessages> = {
  messages: allocationUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function resolveAllocationUiMessages({
  locale,
  overrides,
}: {
  locale: string | null | undefined
  overrides?: AllocationUiMessageOverrides | null
}) {
  return resolvePackageMessages({
    definitions: allocationUiMessageDefinitions,
    fallbackLocale,
    locale,
    overrides,
  })
}

export function getAllocationUiI18n({
  locale,
  overrides,
}: {
  locale?: string | null | undefined
  overrides?: AllocationUiMessageOverrides | null
}): PackageI18nValue<AllocationUiMessages> {
  const resolvedLocale = locale ?? fallbackLocale

  return {
    messages: resolveAllocationUiMessages({
      locale: resolvedLocale,
      overrides,
    }),
    ...createLocaleFormatters(resolvedLocale),
  }
}

export function AllocationUiMessagesProvider({
  children,
  locale,
  overrides,
}: {
  children: ReactNode
  locale: string | null | undefined
  overrides?: AllocationUiMessageOverrides | null
}) {
  return (
    <allocationUiContext.ResolvedMessagesProvider
      definitions={allocationUiMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
      overrides={overrides}
    >
      {children}
    </allocationUiContext.ResolvedMessagesProvider>
  )
}

export const useAllocationUiI18n = allocationUiContext.useI18n
export const useAllocationUiMessages = allocationUiContext.useMessages

export function useAllocationUiI18nOrDefault() {
  return allocationUiContext.useOptionalI18n() ?? defaultAllocationUiI18n
}

export function useAllocationUiMessagesOrDefault() {
  return useAllocationUiI18nOrDefault().messages
}
