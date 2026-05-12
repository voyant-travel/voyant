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
  generateRooms: string
  generatingRooms: string
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
  cancel: string
  unallocated: string
  unallocatedDescription: string
  rooms: string
  travelers: string
  capacity: string
  lead: string
  sharingGroup: string
  accessibility: string
  dietary: string
  remove: string
  overCapacity: string
  dropHere: string
  noRooms: string
  allocationFailed: string
  createRoomFailed: string
  generateRoomsFailed: string
  autoAllocateFailed: string
}

export const allocationUiEn = {
  pageTitle: "Allocation",
  loading: "Loading allocation...",
  empty: "No travelers on this departure yet.",
  back: "Back",
  addRoom: "Add room",
  generateRooms: "Generate rooms",
  generatingRooms: "Generating...",
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
  cancel: "Cancel",
  unallocated: "Unallocated",
  unallocatedDescription: "Travelers not assigned to a room.",
  rooms: "Rooms",
  travelers: "travelers",
  capacity: "Capacity",
  lead: "Lead",
  sharingGroup: "Sharing group",
  accessibility: "Accessibility",
  dietary: "Dietary",
  remove: "Remove",
  overCapacity: "Room is full",
  dropHere: "Drop traveler here",
  noRooms: "No rooms have been added for this slot.",
  allocationFailed: "Could not update allocation.",
  createRoomFailed: "Could not create room.",
  generateRoomsFailed: "Could not generate rooms.",
  autoAllocateFailed: "Could not auto-allocate travelers.",
} satisfies AllocationUiMessages

export const allocationUiRo = {
  pageTitle: "Alocare",
  loading: "Se incarca alocarea...",
  empty: "Nu exista calatori pe aceasta plecare.",
  back: "Inapoi",
  addRoom: "Adauga camera",
  generateRooms: "Genereaza camere",
  generatingRooms: "Se genereaza...",
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
  cancel: "Anuleaza",
  unallocated: "Nealocati",
  unallocatedDescription: "Calatori fara camera alocata.",
  rooms: "Camere",
  travelers: "calatori",
  capacity: "Capacitate",
  lead: "Lead",
  sharingGroup: "Grup partaj",
  accessibility: "Accesibilitate",
  dietary: "Dieta",
  remove: "Scoate",
  overCapacity: "Camera este plina",
  dropHere: "Trage calatorul aici",
  noRooms: "Nu exista camere adaugate pentru acest slot.",
  allocationFailed: "Alocarea nu a putut fi actualizata.",
  createRoomFailed: "Camera nu a putut fi creata.",
  generateRoomsFailed: "Camerele nu au putut fi generate.",
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
