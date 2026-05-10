"use client"

import { usePeople } from "@voyantjs/crm-react"
import { Button } from "@voyantjs/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@voyantjs/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { ChevronDown, UserPlus, Users } from "lucide-react"
import { useState } from "react"

import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import type { PassengerPrefill } from "./flight-passenger-form.js"

export interface PassengerContactPickerProps {
  /** Called when the user picks a CRM person; fields get merged into the passenger card. */
  onPick: (prefill: PassengerPrefill) => void
  /** Optional CRM route callback. When omitted, the "add contact" action is hidden. */
  onAddContact?: () => void
  /** Exposes the selected CRM person id to parent flows such as saved-payment lookup. */
  onPersonSelected?: (personId: string | null) => void
}

/**
 * Passenger card "Pick from contacts" trigger. Opens a popover with a
 * searchable list of CRM people and maps the picked person into the
 * `PassengerPrefill` shape expected by `FlightPassengerForm`.
 */
export function PassengerContactPicker({
  onPick,
  onAddContact,
  onPersonSelected,
}: PassengerContactPickerProps) {
  const messages = useFlightsUiMessagesOrDefault().passengerContactPicker
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const peopleQuery = usePeople({
    search: search.trim() || undefined,
    limit: 30,
    enabled: open,
  })
  const people = peopleQuery.data?.data ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="h-8 gap-2" />}
      >
        <Users className="h-3.5 w-3.5" />
        {messages.trigger}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={messages.searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>
              {peopleQuery.isLoading ? messages.searching : messages.empty}
            </CommandEmpty>
            <CommandGroup>
              {people.map((person) => {
                const fullName = `${person.firstName} ${person.lastName}`.trim()
                return (
                  <CommandItem
                    key={person.id}
                    value={`${fullName} ${person.email ?? ""}`}
                    onSelect={() => {
                      onPick({
                        firstName: person.firstName,
                        ...(person.middleName ? { middleName: person.middleName } : {}),
                        lastName: person.lastName,
                        email: person.email ?? undefined,
                        phone: person.phone ?? undefined,
                        ...(person.gender ? { gender: person.gender } : {}),
                        ...(person.birthday ? { dateOfBirth: person.birthday } : {}),
                      })
                      onPersonSelected?.(person.id)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-medium text-sm">
                        {fullName || messages.emptyName}
                      </span>
                      {person.email && (
                        <span className="truncate text-muted-foreground text-xs">
                          {person.email}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {onAddContact && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__add-new"
                    onSelect={() => {
                      onAddContact()
                      setOpen(false)
                    }}
                    className="text-primary"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {messages.addNewContact}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
