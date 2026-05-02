"use client"

import { usePeople } from "@voyantjs/crm-react"
import type { PassengerPrefill } from "@voyantjs/flights-ui"
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

export interface PassengerContactPickerProps {
  /** Called when the user picks a CRM person — fields get merged into the card. */
  onPick: (prefill: PassengerPrefill) => void
}

/**
 * Passenger card "Pick from contacts" trigger. Opens a popover with a
 * searchable list of CRM people (via `usePeople`); selecting one merges
 * their name + email + phone into the passenger card. CRM doesn't store
 * birth date or gender, so the user still fills those in.
 *
 * "Add new contact" links to /people/new in a new tab — keeps the booking
 * journey intact while the operator adds the contact, then they switch
 * back, search, and pick.
 */
export function PassengerContactPicker({ onPick }: PassengerContactPickerProps) {
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
        Pick from contacts
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search contacts…" />
          <CommandList>
            <CommandEmpty>{peopleQuery.isLoading ? "Searching…" : "No contacts."}</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const fullName = `${p.firstName} ${p.lastName}`.trim()
                return (
                  <CommandItem
                    key={p.id}
                    value={`${fullName} ${p.email ?? ""}`}
                    onSelect={() => {
                      onPick({
                        firstName: p.firstName,
                        ...(p.middleName ? { middleName: p.middleName } : {}),
                        lastName: p.lastName,
                        email: p.email ?? undefined,
                        phone: p.phone ?? undefined,
                        ...(p.gender ? { gender: p.gender } : {}),
                        ...(p.birthday ? { dateOfBirth: p.birthday } : {}),
                      })
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{fullName || "—"}</span>
                      {p.email && (
                        <span className="truncate text-xs text-muted-foreground">{p.email}</span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add-new"
                onSelect={() => {
                  window.open("/people", "_blank")
                  setOpen(false)
                }}
                className="text-primary"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add new contact in CRM
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
