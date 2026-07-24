---
"@voyant-travel/ui": patch
"@voyant-travel/action-ledger-react": patch
---

Guarantee the sticky-footer layout for sheets. `SheetContent` is now
`overflow-hidden` and `SheetHeader`/`SheetFooter` are `shrink-0`, so the header
stays pinned at the top and the actions stay pinned at the bottom while the
scrollable `SheetBody` region scrolls between them — regardless of content
height. This makes the pattern the existing sheets already follow impossible to
break. Also switch the action-ledger entry sheet from a hard-coded
`h-[calc(100vh-9rem)]` scroll area to a `flex-1` one so it participates in the
same frame.
