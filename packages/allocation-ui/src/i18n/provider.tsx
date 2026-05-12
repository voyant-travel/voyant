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
}

export const allocationUiEn = {
  pageTitle: "Allocation",
  loading: "Loading allocation...",
  empty: "No travelers on this departure yet.",
  back: "Back",
  addRoom: "Add room",
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
} satisfies AllocationUiMessages

export const allocationUiRo = {
  pageTitle: "Alocare",
  loading: "Se incarca alocarea...",
  empty: "Nu exista calatori pe aceasta plecare.",
  back: "Inapoi",
  addRoom: "Adauga camera",
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
