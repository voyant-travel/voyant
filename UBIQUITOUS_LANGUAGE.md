# Ubiquitous Language

The canonical domain vocabulary for Voyant - an OTA, tour-operator, and DMC
platform. Terms are grouped by subdomain. Use the **bold** term; treat
*italic* aliases as smells.

---

## Actors & people

| Term              | Definition                                                                                            | Aliases to avoid                |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Person**        | An individual contact known to the operator — the canonical CRM identity record.                      | *customer, client, contact*     |
| **Organization** | A company or legal entity — represents a buyer, supplier, agency, or other counterparty.             | *account, company, client*      |
| **Traveler**      | A person who actually travels on a booking; carries category (adult/child/infant/senior) and PII.     | *guest, pax, passenger*         |
| **Participant**   | A role-bearer on an opportunity, offer, order, or booking item (traveler, booker, decision-maker, finance). | *contact-on-deal*          |
| **User**          | An authentication identity in the system; orthogonal to Person — staff and customers can both be Users. | *login, account*              |
| **Supplier**      | An operational vendor we contract directly for delivery of owned or assembled products.                | *vendor, provider, source*      |
| **Channel**       | A distribution counterparty selling our inventory (direct, OTA, affiliate, reseller, marketplace, API partner). | *partner, distributor*    |
| **Actor type**    | The authorization role of the caller: `staff`, `customer`, `partner`, or `supplier`.                  | *role, audience*                |

## Commercial network & sourcing

| Term                 | Definition                                                                                         | Aliases to avoid                    |
| -------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Operator**         | The organization accountable for commercial control and, when applicable, operational fulfillment. | *agency, tenant, seller*            |
| **Reseller**         | A commercial role where an Operator sells inventory another Operator or Supplier fulfills.         | *channel (when used as a role)*     |
| **Operating party**  | The party that actually runs and fulfills the travel service day to day.                           | *supplier (when the party is an operator)* |
| **Inventory Source** | A technical upstream source of inventory data or booking capability (Connect, GDS, direct API, CSV import). | *supplier, provider, feed*   |
| **Operator Link**    | A capability-bearing relationship between an Operator and a counterparty for catalog, availability, booking, or sync. | *connection, partnership* |
| **Catalog Item**     | A normalized sellable discovery and booking record used by admin search, storefront, composer, or CMS sync regardless of provenance. | *product, listing*          |
| **Operated Inventory** | Inventory the Operator owns or manages operationally in optional local module-owned records.     | *local product*                      |
| **Sourced Inventory** | Inventory the Operator sells but does not operate, reached through an Inventory Source.           | *external product, imported product* |
| **Catalog Projection** | A derived read model that interleaves Operated Inventory and Sourced Inventory for search and sync. | *master catalog, product table*  |

## Sales pipeline (pre-commitment)

| Term            | Definition                                                                                       | Aliases to avoid       |
| --------------- | ------------------------------------------------------------------------------------------------ | ---------------------- |
| **Opportunity** | A tracked sales deal with a Person/Organization — moves through Stages, may close won/lost.       | *lead, deal*           |
| **Pipeline**    | An ordered set of Stages a deal moves through.                                                   | *funnel, board*        |
| **Stage**       | A step within a Pipeline (e.g. Qualified → Proposal → Negotiation), with win/lost flags.         | *step, status*         |
| **Quote**       | A pre-sales pricing proposal attached to an Opportunity; informational, not transactable.        | *proposal, estimate*   |
| **Activity**    | A logged interaction (call, email, meeting, task, follow-up) on an Opportunity or Person.        | *event, log entry*     |
| **Segment**     | A named list of People or Organizations grouped by criteria, used for targeting or bulk action.  | *list, group*          |

## Catalog (what we sell)

| Term                  | Definition                                                                                       | Aliases to avoid               |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| **Product**           | A sellable travel offering — has a booking mode (date, date-time, open, stay, transfer, itinerary), capacity mode, and visibility. | *tour, trip, experience, package* |
| **Product Option**    | A configurable variant of a Product (e.g. "English Guided", "Private Group"); composed of Option Units. | *variant, sub-product*    |
| **Option Unit**       | A pricing/age dimension within an Option (e.g. "Adult", "Child 3–11", "Group 1–4").              | *price band, ticket type*      |
| **Product Day**       | A day in a multi-day Product's itinerary.                                                        | *day, leg*                     |
| **Product Day Service** | A scheduled service on a Product Day (transfer, meal, guided activity, accommodation reference). | *itinerary item*             |
| **Accommodation Component** | A lodging component sold or arranged inside a Product, package, itinerary, cruise extension, or sourced catalog entry. | *hotel module, property ops* |
| **Room Option**       | A bookable accommodation option for resale or trip composition, usually with occupancy and board/rate choices. | *room unit (unless physical ops)* |
| **Rate Plan**         | A resale/commercial accommodation price and policy choice, usually from a Supplier or Inventory Source. | *tariff*                      |
| **Board Basis**       | The included-meals tier for an accommodation component (breakfast, half-board, full-board, all-inclusive). | *meal plan (when ambiguous)* |
| **Stay Component**    | A date-range accommodation line within a Product, Offer, Booking, or sourced Catalog Item.        | *hotel reservation*            |
| **Product Version**   | An immutable snapshot of a Product's structure at a point in time.                               | *revision, snapshot*           |
| **Product Media**     | An image, video, or document attached to a Product or one of its Days.                           | *asset, attachment*            |
| **Operated Group Departure** | A fixed Product instance/departure with capacity and product-internal components such as bus transport, stays, included excursions, guide assignment, rooming list, and dependent Extras. | *package when used for the aggregate* |
| **Trip / Package Envelope** | A customer-facing aggregate that groups one or more Component Bookings/Orders into one itinerary, checkout, support, document, and cancellation-preview experience. Not necessarily one Booking. | *Product, Booking* |
| **Composed FIT Trip** | An individually composed Trip / Package Envelope assembled from independent commitments such as a product, stay, flight, transfer, cruise, or staff-confirmed placeholder. | *custom product, mega-booking* |
| **Component Booking / Order** | One independently committed part of a Trip / Package Envelope, with its own supplier/provider reference, cancellation rules, tax treatment, fulfillment state, and operational owner. | *line when lifecycle is independent* |
| **Extra** | A child line that modifies or extends a Component Booking and shares that component's lifecycle closely enough to be cancelled, fulfilled, taxed, and supported with it. | *add-on, addon, extension, separate booking when dependent* |
| **Cruise Extension** | A cruise-specific pre/post-cruise hotel or land program. The offer definition can be shared across multiple cruises/sailings; a selected extension is an Extra when cruise-owned and lifecycle-dependent, or a sibling Component Booking / Order when independently supplied, confirmed, cancelled, taxed, or supported. | *generic extension* |

## Inventory & availability

| Term                  | Definition                                                                                       | Aliases to avoid           |
| --------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| **Availability Rule** | A recurring capacity definition (RFC 5545 recurrence) that generates concrete Slots.             | *schedule, recurrence*     |
| **Slot**              | A concrete dated inventory unit (date or date-time) with remaining capacity.                     | *departure, instance, occurrence* |
| **Closeout**          | An explicit block on a date or date range (holiday, maintenance, sold-out override).             | *blackout, exception*      |
| **Allotment**         | A block of inventory reserved for a specific Channel.                                            | *contingent, allocation-to-channel* |
| **Capacity**          | The numeric upper bound on a Slot, Allotment, or Vehicle. Always a quantity, never a status.     | *limit, max*               |
| **Pickup Point**      | A geographic location where Travelers can be collected or dropped off.                           | *stop, meeting place*      |
| **Pickup Group**      | A named cluster of Pickup Points with a kind (`pickup`, `dropoff`, `meeting`).                   | *zone, cluster*            |

## Pricing

| Term                   | Definition                                                                                      | Aliases to avoid       |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| **Market**             | A geographic + economic region (e.g. "EU", "US East Coast") that anchors currency and pricing.  | *region, territory*    |
| **FX Rate Set**        | A timestamped snapshot of exchange rates used to resolve prices in non-native currency.         | *forex table*          |
| **Price Catalog**      | A versioned master price list.                                                                  | *price book*           |
| **Price Schedule**     | A seasonal/temporal pricing window with effective-from / effective-to.                          | *seasonal price, calendar* |
| **Cost**               | The amount we pay a Supplier — input to margin.                                                 | *buy price, net*       |
| **Rate**               | A Supplier's per-unit tariff (per_person, per_night, per_vehicle, flat).                        | *supplier price*       |
| **Price**              | The customer-facing sell amount.                                                                | *sell, retail*         |
| **Cancellation Policy** | An ordered rule set defining refund percentages by cutoff window before service date.           | *refund schedule*      |
| **Sellability**        | The resolved answer to "is this Product buyable now for this date / pax / market / channel?" — combines Availability, Pricing, Allotments, and Policies. | *bookability* |

## Transaction chain (the commitment ladder)

The five-step ladder is **Quote → Offer → Order → Booking → Fulfillment**. Each step hardens the commitment.

| Term                    | Definition                                                                                       | Aliases to avoid         |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| **Offer**               | A priced, dated, sellability-resolved proposal — sendable, acceptable, convertible to an Order.  | *quote (overloaded)*     |
| **Order**               | A confirmed commitment to deliver — created from an accepted Offer or directly; hosts Order Terms. | *purchase order*       |
| **Booking**             | The fulfillment-side record of an Order: Travelers, Allocations, Fulfillments, redemptions.      | *reservation, booking-record* |
| **Offer Item / Order Item / Booking Item** | A line-item on its parent (unit, service, extra, fee, tax, discount, accommodation, transport). | *line, row*  |
| **Allocation**          | A capacity hold against a Slot, Pickup, or Resource — `held` → `confirmed` → `fulfilled`.        | *reservation-line, hold-record* |
| **Order Term**          | A legal/commercial term attached to an Order (T&C, cancellation, guarantee, payment, commission) requiring acceptance. | *clause*       |
| **Hold**                | A temporary, time-limited claim on inventory before Booking confirmation; expires.               | *option, soft-hold*      |

## Fulfillment & operations

| Term                  | Definition                                                                                       | Aliases to avoid              |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Fulfillment**       | Issuance of a deliverable artifact (voucher, ticket, PDF, QR, barcode) for a Booking Item.       | *ticket-event, issuance*      |
| **Voucher / Ticket**  | The artifact a Traveler presents at the service — output of a Fulfillment.                       | *confirmation, document*      |
| **Redemption**        | The act of consuming a Fulfillment at the point of service (scan, manual check-in).              | *check-in, scan*              |
| **Dispatch**          | An operational order in Ground to move passengers from A to B at a time, assigned to a Driver and Vehicle. | *job, run*           |
| **Vehicle**           | A transport asset (car, van, bus, coach) with capacity, class, and accessibility flags.          | *car, unit*                   |
| **Driver**            | A crew member assigned to Vehicles and Dispatches.                                               | *operator, chauffeur*         |
| **Resource**          | A finite assignable asset (guide, equipment, room, driver, vehicle) with a type and availability. | *asset, person-resource*     |
| **Resource Pool**     | A named collection of interchangeable Resources (e.g. "French-speaking guides – Cairo").         | *team, group*                 |
| **Accommodation Facility** | A Facility used as a lodging, meeting, pickup, dining, attraction, or operational location in an OTA, tour-operator, or DMC workflow. | *property ops*          |
| **Rooming List**      | Traveler-to-room grouping or assignment data for a Booking.                                      | *hotel room management*       |
| **Facility**          | The shared base venue concept — Properties, transfer hubs, attractions, restaurants, airports all specialize Facility. | *location, place* |

## Money

| Term                  | Definition                                                                                       | Aliases to avoid              |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Invoice**           | A billing document issued to a payer; lifecycle `draft → sent → partially_paid / paid / overdue / void`. | *bill*                |
| **Invoice Number Series** | A configured numbering sequence (per legal entity / year / type) Invoices draw from.         | *sequence*                    |
| **Credit Note**       | A reversal or adjustment document referencing an Invoice.                                        | *refund-doc, reversal*        |
| **Payment**           | A recorded inbound transfer of money (bank transfer, card, cash, voucher, direct bill).          | *receipt, transaction*        |
| **Supplier Payment**  | A recorded outbound transfer to a Supplier.                                                      | *payout, AP*                  |
| **Payment Schedule**  | An installment plan attached to a Booking (deposit, installment, balance, hold) with due dates.  | *plan, instalments*           |
| **Guarantee**         | A security hold (deposit, pre-auth, card-on-file, agency letter, voucher) ensuring eventual payment. | *deposit (overloaded)*    |
| **Payment Session**   | An active payment attempt against a target (Booking, Order, Invoice, Schedule line, Guarantee). | *checkout, intent*            |
| **Collection Plan**   | A preview of what will be collected from the customer and when.                                  | *quote-of-collections*        |

## Distribution

| Term                       | Definition                                                                                       | Aliases to avoid           |
| -------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| **Channel Contract**       | The agreed terms with a Channel.                                                                 | *agreement*                |
| **Commission Rule**        | A scoped (booking / product / rate / category) fixed-or-percentage rule for what a Channel earns. | *cut, fee-rule*           |
| **Settlement**             | An accounting run reconciling Booking-side amounts owed to or from a Channel.                    | *payout-run*               |
| **Reconciliation**         | Comparison of expected vs. actual Bookings/amounts against a Channel; produces Issues.           | *audit, match*             |
| **Reconciliation Issue**   | A flagged mismatch (`missing_booking`, `status_mismatch`, `amount_mismatch`, `cancel_mismatch`, `missing_payout`). | *discrepancy* |

## Legal & compliance

| Term                  | Definition                                                                                       | Aliases to avoid          |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| **Contract**          | A signed legal document instance bound to a Booking, Order, or Product.                          | *agreement (overloaded)*  |
| **Contract Template** | A reusable contract form with variable placeholders, rendered per instance.                      | *form, boilerplate*       |
| **Signature**         | A record of a Contract being signed (signer, method, IP, timestamp).                             | *sign-event*              |
| **Policy**            | A scoped rule set (cancellation, payment, T&C, guarantee, commission); versioned.                | *terms*                   |
| **Policy Version**    | An immutable snapshot of a Policy's rules — `published` or `retired`.                            | *revision*                |
| **Policy Acceptance** | A recorded confirmation that a Person or Booking accepted a specific Policy Version.             | *consent, sign-off*       |
| **PII**               | Personally Identifiable Information; reads/writes to PII fields are audit-logged.                | *personal data (loose)*   |

## Identity & external references

| Term                | Definition                                                                                       | Aliases to avoid          |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| **Contact Point**   | An email, phone, or website attached to a Person, Organization, or Supplier.                     | *contact (overloaded)*    |
| **Address**         | A postal address attached to a Person or Organization.                                           | —                         |
| **Named Contact**   | A titled point-of-contact role at an Organization (e.g. "Procurement Manager Jane Doe").         | *role-contact*            |
| **External Ref**    | A mapping between a Voyant entity and an ID in a third-party system (PMS, OTA, channel manager). | *external id, sync key*   |

---

## Lifecycle verbs (canonical actions)

| Verb           | Meaning                                                                                          | Used on                                  |
| -------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Hold**       | Place a time-limited claim on inventory.                                                         | Booking, Allocation                      |
| **Confirm**    | Promote from draft/held to a binding state.                                                      | Booking, Order, Allocation, Supplier status |
| **Start**      | Mark a confirmed Booking as in-progress — service is underway.                                   | Booking                                  |
| **Complete**   | Mark an in-progress Booking as fully delivered.                                                  | Booking                                  |
| **Issue**      | Produce a deliverable artifact (voucher, invoice, contract, policy version).                     | Fulfillment, Invoice, Contract, Policy Version |
| **Fulfill**    | Mark operational delivery complete.                                                              | Booking Item, Allocation                 |
| **Deliver**    | Push an issued artifact to the recipient over a channel (email, download, wallet, API).          | Fulfillment, Notification                |
| **Redeem**     | Consume a Fulfillment at point of service.                                                       | Fulfillment                              |
| **Cancel**     | Operationally reverse a commitment.                                                              | Booking, Order, Allocation, Supplier status |
| **Void**       | Financially reverse a document — distinct from Cancel.                                           | Invoice, Payment                         |
| **Close**      | End an Opportunity with an outcome (won/lost/archived).                                          | Opportunity                              |
| **Convert**    | Promote one entity to the next on the commitment ladder.                                         | Offer → Order, Product → Booking         |
| **Reconcile**  | Compare expected vs. actual and emit Issues.                                                     | Channel Settlement                       |
| **Settle**     | Post the financial outcome of Reconciliation.                                                    | Channel Settlement                       |
| **Override**   | Manually set a Booking's status, bypassing the transition graph. Admin-only; always audit-logged with a required reason. | Booking |

## Relationships (the domain laws)

- A **Person** may belong to zero or more **Organizations**; both can appear on Bookings and Orders.
- An **Opportunity** belongs to one Person and/or Organization; produces zero or more **Quotes**.
- A **Quote** is informational; an **Offer** is the transactable equivalent — a Quote does not become an Offer automatically.
- An **Offer** converts to exactly one **Order**; an Order may be created without a prior Offer (direct booking).
- An **Order** produces one or more **Bookings**; a Booking is the fulfillment side of one Order.
- A **Booking** holds **Allocations** against **Slots** (or Pickups, or Resources); each Allocation belongs to exactly one Booking Item.
- Accommodation may be sold as **Sourced Inventory** or as a component of a **Product**, but hotel/property operations are not a first-party implementation scenario.
- A **Booking Item** produces zero or more **Fulfillments**; each Fulfillment is delivered over exactly one channel.
- An **Order** produces one or more **Invoices**; an Invoice belongs to exactly one Order (and may reference its Booking).
- A **Payment Schedule** belongs to a Booking; each schedule line resolves via a **Payment Session** to one or more **Payments**.
- A **Channel** sells via an **Allotment** (its reserved inventory) and earns via **Commission Rules**; **Settlement** runs reconcile its activity.
- A **Policy** is assigned by scope (Product, Channel, Market, Booking); a **Policy Acceptance** binds a specific Policy Version to a Person or Booking.
- **Cost** ≠ **Rate** ≠ **Price**: Cost is what we pay, Rate is the Supplier's per-unit tariff input, Price is what the customer sees.
- A **Product** is canonical module-owned truth; a **Catalog Item** is a derived sellable read model that may resolve to a Product or to Sourced Inventory.
- An **Operator Link** grants one or more capabilities (catalog, availability, booking, sync) between counterparties; an **Inventory Source** is one technical adapter behind that link.
- An Operator can be both an **Operating party** for some inventory and a **Reseller** for other inventory at the same time.
- A **Trip / Package Envelope** groups Component Bookings/Orders for customer experience and checkout; it does not erase the lifecycle boundaries of those components.
- Product-internal bundles and dependent **Extras** stay inside their Component Booking. Customer-composed additions with independent supplier/cancellation/tax/fulfillment state become sibling Component Bookings/Orders under the same Trip / Package Envelope.
- A **Cruise Extension** is a vertical-specific category, not a generic synonym for Extra. Its catalog definition may be reused across cruises; apply the same lifecycle boundary rule to the selected extension to decide whether it is nested under the cruise booking or split into its own Component Booking / Order.

## Example dialogue

> **Sales agent:** "I've got a hot **Opportunity** with the Henderson family — eight **Travelers**, two weeks in Egypt. I sent them a **Quote** last week."

> **Operations manager:** "Good. If they're ready to commit, build them an **Offer** — that pulls live **Sellability** for the dates and locks the **Cost** from our Cairo **Suppliers**. Once they accept, it converts to an **Order**."

> **Sales agent:** "And the **Booking** is created from the **Order**?"

> **Operations manager:** "Yes - the Order is the commercial commitment with the **Order Terms** they have to accept. The **Booking** is operational: it holds **Allocations** against the **Slots** for each guided day, includes a **Stay Component** in Aswan, and sets up **Dispatches** with **Vehicles** and **Drivers** for the transfers."

> **Sales agent:** "What about the cancellation thing they asked about?"

> **Operations manager:** "That's the **Cancellation Policy** assigned to the Product. We'll record a **Policy Acceptance** against the specific **Policy Version** when they sign the **Contract**. If they later cancel, we **Cancel** the Booking — that's an operational reversal — and **Void** any Invoices that were never paid. If they paid, we issue a **Credit Note** instead."

> **Finance:** "Don't forget the **Payment Schedule**. Deposit at booking, balance 30 days out. The deposit is also our **Guarantee**. Each line goes through a **Payment Session** when collected."

> **Sales agent:** "What about the Viking sailings we're selling but not actually operating? They don't feel like our own **Products**."

> **Operations manager:** "Right — those are **Sourced Inventory**. Viking is the **Operating party**, we are the **Reseller**, and the feed comes through an **Inventory Source** behind an **Operator Link**."

> **Sales agent:** "So what shows up in search and in the storefront?"

> **Operations manager:** "A **Catalog Item**. For our own tours the Catalog Item resolves to a local **Product**. For Viking it resolves to sourced inventory. Same discovery surface, different source of truth."

## Flagged ambiguities

These terms are used loosely in conversation. Pick the canonical form below; treat the rest as smells when you see them in code or docs.

- **Customer / client / buyer** — none are first-class entities. The canonical CRM record is **Person** (with optional **Organization**). On a Booking, the buyer is captured as `personId` + `organizationId` snapshot fields. Avoid "customer" / "client" except in UI copy facing the operator's own staff.
- **Tour / experience** — usually collapse to **Product**. **Trip** and **package** are overloaded: use **Product** for an operator-sold offering, **Operated Group Departure** for a fixed-capacity product instance, and **Trip / Package Envelope** for a customer-facing aggregate of multiple component commitments.
- **Accommodation vs. hotel operations** — accommodation is valid as catalog inventory, sourced resale, or trip composition. Hotel/property operations are not a first-party Voyant implementation scenario.
- **Quote vs. Offer** — both look like "a price proposal". **Quote** is a CRM artifact attached to an Opportunity (informational, pre-sales). **Offer** is the transactional, sellability-resolved, sendable, acceptable document on the commitment ladder. They are not synonyms.
- **Order vs. Booking** — both are post-sale. **Order** is the commercial commitment (with Order Terms, links to Invoices); **Booking** is the operational record (Travelers, Allocations, Fulfillments). One Order produces one Booking in normal flows; do not use them interchangeably.
- **Reservation** — overloaded between "Hold" (a temporary inventory claim) and "Booking" (the persistent record). Use **Hold** or **Booking** — never "Reservation".
- **Cancel vs. Void vs. Close** — different verbs for different domains. **Cancel** = operational reversal (Booking, Order, Allocation). **Void** = financial reversal (Invoice, Payment). **Close** = end an Opportunity with an outcome. Don't blend them.
- **Hold vs. Allocation vs. Reservation** — **Hold** is the temporal status of a Booking before confirmation (`hold_expires_at`). **Allocation** is the inventory-line entity (`held` → `confirmed` → `fulfilled`). Avoid "Reservation".
- **Supplier vs. Partner vs. Provider** — **Supplier** is the entity that sells us services. **Partner** is a relationship type on Organizations. **Provider** is for tech integrations (notification provider, storage provider) — do not call a hotel a "provider".
- **Channel vs. Distribution vs. Partner** — **Channel** is the entity (the OTA, the affiliate, the marketplace). **Distribution** is the subdomain. Don't say "Partner" when you mean Channel.
- **Supplier vs. Operator vs. Inventory Source** — **Supplier** is an operational vendor in local managed operations. **Operator** is the principal commercial/operational party in the network. **Inventory Source** is the technical integration path. TUI or Viking may be the upstream Operating party while Connect or a GDS is only the Inventory Source.
- **Product vs. Catalog Item** — **Product** is canonical local truth with admin ownership and operational modeling. **Catalog Item** is the normalized discovery projection that can represent either a local Product or Sourced Inventory. Do not import external inventory into Product just to make it searchable.
- **Reseller vs. Channel** — **Reseller** is a role an Operator can play relative to inventory. **Channel** is a distribution entity that sells our inventory. They overlap in commerce but are not the same record.
- **Contact** — too overloaded to use raw. Pick: **Person** (CRM record), **Contact Point** (email/phone/website on identity), **Named Contact** (titled role at an Organization), or **Participant** (role on a deal/order/booking).
- **Traveler vs. Participant vs. Guest** — **Traveler** is the person actually traveling (booking_travelers, with category and PII). **Participant** is the broader role-bearer on a transaction (booker, decision-maker, finance, traveler). Avoid "Guest"; use **Traveler** in bookings and rooming lists.
- **Capacity** is always a number, never a status. Slots have a capacity *and* a status — don't conflate them.
- **Cost / Rate / Price** — three distinct money concepts. **Cost** = our outflow to a Supplier. **Rate** = the Supplier's per-unit tariff (per_person, per_night, etc.). **Price** = what the customer pays. Never use them interchangeably even when numerically equal.
- **Issue vs. Fulfill vs. Deliver** — **Issue** = produce the artifact (Fulfillment, Invoice, Contract). **Fulfill** = mark operational completion of a Booking Item or Allocation. **Deliver** = transmit an issued artifact over a channel (email, download, wallet, API). Three steps, not synonyms.
