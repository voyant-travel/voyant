// agent-quality: file-size exception -- owner: flights; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { describe, expect, it } from "vitest"
import type { z } from "zod"

import type {
  AdapterLogger,
  FlightAdapterCapabilities,
  FlightAdapterContext,
  FlightBookResponse,
  FlightCancelResponse,
  FlightGetOrderResponse,
  FlightOrdersListQuery,
  FlightOrdersListResponse,
  FlightPriceRequest,
  FlightPriceResponse,
  FlightSearchResponse,
} from "./adapter.js"
import {
  ancillaryRequestSchema,
  ancillaryResponseSchema,
  type ancillarySelectionSchema,
  type billingAddressSchema,
  checkInRequestSchema,
  checkInResponseSchema,
  type fareBreakdownSchema,
  type fareBundleInclusionsSchema,
  type fareBundleSchema,
  flightAdapterCapabilitiesSchema,
  flightAdapterContextSchema,
  type flightBoardingPassSchema,
  flightBookRequestSchema,
  flightBookResponseSchema,
  flightCancelResponseSchema,
  flightGetOrderResponseSchema,
  type flightItinerarySchema,
  flightModifyRequestSchema,
  flightModifyResponseSchema,
  type flightOfferSchema,
  flightOrdersListQuerySchema,
  flightOrdersListResponseSchema,
  type flightPassengerSchema,
  flightPriceRequestSchema,
  flightPriceResponseSchema,
  flightRefundRequestSchema,
  flightRefundResponseSchema,
  type flightSearchPaginationMetaSchema,
  flightSearchRequestSchema,
  flightSearchResponseSchema,
  type flightSegmentSchema,
  type flightSliceSchema,
  type flightTicketSchema,
  flightVoidResponseSchema,
  moneySchema,
  type passengerCountsSchema,
  paymentIntentSchema,
  type seatAssignmentSchema,
  seatMapRequestSchema,
  seatMapResponseSchema,
  type seatMapSchema,
  type seatRowSchema,
  type seatSchema,
  seatSelectionRequestSchema,
  seatSelectionResponseSchema,
  ssrRequestSchema,
  ssrResponseSchema,
  type travelDocumentSchema,
} from "./schemas.js"
import type {
  AncillaryRequest,
  AncillaryResponse,
  AncillarySelection,
  BillingAddress,
  CheckInRequest,
  CheckInResponse,
  FareBreakdown,
  FareBundle,
  FareBundleInclusions,
  FlightBoardingPass,
  FlightBookRequest,
  FlightModifyRequest,
  FlightModifyResponse,
  FlightOffer,
  FlightPassenger,
  FlightRefundRequest,
  FlightRefundResponse,
  FlightSearchPaginationMeta,
  FlightSearchRequest,
  FlightSegment,
  FlightSlice,
  FlightTicket,
  FlightVoidResponse,
  Itinerary,
  Money,
  PassengerCounts,
  PaymentIntent,
  Seat,
  SeatAssignment,
  SeatMap,
  SeatMapRequest,
  SeatMapResponse,
  SeatRow,
  SeatSelectionRequest,
  SeatSelectionResponse,
  SsrRequest,
  SsrResponse,
  TravelDocument,
} from "./types.js"

type AssertEquivalent<Actual, Expected> = Actual extends Expected
  ? Expected extends Actual
    ? true
    : never
  : never

const typeChecks: [
  AssertEquivalent<z.infer<typeof moneySchema>, Money>,
  AssertEquivalent<z.infer<typeof flightSliceSchema>, FlightSlice>,
  AssertEquivalent<z.infer<typeof passengerCountsSchema>, PassengerCounts>,
  AssertEquivalent<z.infer<typeof flightSegmentSchema>, FlightSegment>,
  AssertEquivalent<z.infer<typeof flightItinerarySchema>, Itinerary>,
  AssertEquivalent<z.infer<typeof fareBreakdownSchema>, FareBreakdown>,
  AssertEquivalent<z.infer<typeof fareBundleInclusionsSchema>, FareBundleInclusions>,
  AssertEquivalent<z.infer<typeof fareBundleSchema>, FareBundle>,
  AssertEquivalent<z.infer<typeof flightOfferSchema>, FlightOffer>,
  AssertEquivalent<z.infer<typeof flightSearchPaginationMetaSchema>, FlightSearchPaginationMeta>,
  AssertEquivalent<z.infer<typeof flightSearchRequestSchema>, FlightSearchRequest>,
  AssertEquivalent<z.infer<typeof flightSearchResponseSchema>, FlightSearchResponse>,
  AssertEquivalent<z.infer<typeof flightPriceRequestSchema>, FlightPriceRequest>,
  AssertEquivalent<z.infer<typeof flightPriceResponseSchema>, FlightPriceResponse>,
  AssertEquivalent<z.infer<typeof paymentIntentSchema>, PaymentIntent>,
  AssertEquivalent<z.infer<typeof billingAddressSchema>, BillingAddress>,
  AssertEquivalent<z.infer<typeof travelDocumentSchema>, TravelDocument>,
  AssertEquivalent<z.infer<typeof flightPassengerSchema>, FlightPassenger>,
  AssertEquivalent<z.infer<typeof ancillarySelectionSchema>, AncillarySelection>,
  AssertEquivalent<z.infer<typeof flightBookRequestSchema>, FlightBookRequest>,
  AssertEquivalent<z.infer<typeof flightBookResponseSchema>, FlightBookResponse>,
  AssertEquivalent<z.infer<typeof flightTicketSchema>, FlightTicket>,
  AssertEquivalent<z.infer<typeof flightGetOrderResponseSchema>, FlightGetOrderResponse>,
  AssertEquivalent<z.infer<typeof flightCancelResponseSchema>, FlightCancelResponse>,
  AssertEquivalent<z.infer<typeof flightOrdersListQuerySchema>, FlightOrdersListQuery>,
  AssertEquivalent<z.infer<typeof flightOrdersListResponseSchema>, FlightOrdersListResponse>,
  AssertEquivalent<z.infer<typeof ancillaryRequestSchema>, AncillaryRequest>,
  AssertEquivalent<z.infer<typeof ancillaryResponseSchema>, AncillaryResponse>,
  AssertEquivalent<z.infer<typeof seatSchema>, Seat>,
  AssertEquivalent<z.infer<typeof seatRowSchema>, SeatRow>,
  AssertEquivalent<z.infer<typeof seatMapSchema>, SeatMap>,
  AssertEquivalent<z.infer<typeof seatMapRequestSchema>, SeatMapRequest>,
  AssertEquivalent<z.infer<typeof seatMapResponseSchema>, SeatMapResponse>,
  AssertEquivalent<z.infer<typeof seatAssignmentSchema>, SeatAssignment>,
  AssertEquivalent<z.infer<typeof seatSelectionRequestSchema>, SeatSelectionRequest>,
  AssertEquivalent<z.infer<typeof seatSelectionResponseSchema>, SeatSelectionResponse>,
  AssertEquivalent<z.infer<typeof flightBoardingPassSchema>, FlightBoardingPass>,
  AssertEquivalent<z.infer<typeof checkInRequestSchema>, CheckInRequest>,
  AssertEquivalent<z.infer<typeof checkInResponseSchema>, CheckInResponse>,
  AssertEquivalent<z.infer<typeof flightModifyRequestSchema>, FlightModifyRequest>,
  AssertEquivalent<z.infer<typeof flightModifyResponseSchema>, FlightModifyResponse>,
  AssertEquivalent<z.infer<typeof flightRefundRequestSchema>, FlightRefundRequest>,
  AssertEquivalent<z.infer<typeof flightRefundResponseSchema>, FlightRefundResponse>,
  AssertEquivalent<z.infer<typeof flightVoidResponseSchema>, FlightVoidResponse>,
  AssertEquivalent<z.infer<typeof ssrRequestSchema>, SsrRequest>,
  AssertEquivalent<z.infer<typeof ssrResponseSchema>, SsrResponse>,
  AssertEquivalent<z.infer<typeof flightAdapterContextSchema>, FlightAdapterContext>,
  AssertEquivalent<z.infer<typeof flightAdapterCapabilitiesSchema>, FlightAdapterCapabilities>,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
]
void typeChecks

const money: Money = { amount: "600.00", currency: "USD" }

const segment: FlightSegment = {
  segmentId: "seg_1",
  carrierCode: "BA",
  flightNumber: "177",
  departure: { iataCode: "LHR", terminal: "5", at: "2026-10-15T11:00:00+00:00" },
  arrival: { iataCode: "JFK", terminal: "8", at: "2026-10-15T14:00:00-04:00" },
  aircraft: "777",
  cabin: "economy",
  providerData: { source: "fixture" },
}

const offer: FlightOffer = {
  offerId: "offer_1",
  source: "test",
  itineraries: [{ segments: [segment], duration: "PT8H" }],
  fareBreakdowns: [
    {
      passengerType: "adult",
      passengerCount: 1,
      baseFare: { amount: "500.00", currency: "USD" },
      taxes: { amount: "100.00", currency: "USD" },
      total: money,
    },
  ],
  totalPrice: money,
  validatingCarrier: "BA",
  expiresAt: "2026-10-01T11:00:00Z",
  lastTicketingDate: "2026-10-02",
  fareBundles: [
    {
      id: "standard",
      label: "Standard",
      tier: "standard",
      priceDelta: { amount: "30.00", currency: "USD" },
      inclusions: {
        cabinBag: { included: true, weightKg: 8 },
        seatSelection: "standard",
      },
    },
  ],
}

const passenger: FlightPassenger = {
  passengerId: "pax_1",
  type: "adult",
  firstName: "Ada",
  lastName: "Lovelace",
  dateOfBirth: "1980-01-01",
  documents: [
    {
      type: "passport",
      number: "123456789",
      countryOfIssue: "GB",
      expiryDate: "2030-01-01",
    },
  ],
}

const order = {
  orderId: "order_1",
  pnr: "ABC123",
  status: "ticketed",
  offer,
  passengers: [passenger],
  contact: { email: "ada@example.com" },
  tickets: [{ ticketNumber: "1250000000001", passengerId: "pax_1", segmentIds: ["seg_1"] }],
  totalPrice: money,
  createdAt: "2026-10-01T10:00:00Z",
  providerData: { locator: "ABC123" },
} satisfies z.infer<typeof flightBookResponseSchema>["order"]

const ancillarySelection: AncillarySelection = {
  baggage: [{ passengerId: "pax_1", sliceIndex: 0, optionId: "bag_20kg", quantity: 1 }],
  seats: [{ passengerId: "pax_1", segmentId: "seg_1", seatNumber: "12A" }],
}

const seatMap: SeatMap = {
  segmentId: "seg_1",
  aircraft: "777",
  cabin: "economy",
  columnLayout: ["A", "B", "C", null, "D", "E", "F"],
  rows: [
    {
      row: 12,
      seats: [
        {
          seatNumber: "12A",
          row: 12,
          column: "A",
          status: "available",
          category: "standard",
          window: true,
        },
      ],
    },
  ],
}

const logger: AdapterLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

const roundTripCases = [
  [
    "flightSearchRequestSchema",
    flightSearchRequestSchema,
    {
      slices: [{ origin: "LHR", destination: "JFK", departureDate: "2026-10-15" }],
      passengers: { adults: 1 },
      cabin: "economy",
    } satisfies FlightSearchRequest,
  ],
  ["flightSearchResponseSchema", flightSearchResponseSchema, { offers: [offer] }],
  ["flightPriceRequestSchema", flightPriceRequestSchema, { offerId: "offer_1", offer }],
  ["flightPriceResponseSchema", flightPriceResponseSchema, { offer, valid: true }],
  ["paymentIntentSchema", paymentIntentSchema, { type: "bank_transfer" }],
  [
    "flightBookRequestSchema",
    flightBookRequestSchema,
    {
      offerId: "offer_1",
      offer,
      passengers: [passenger],
      paymentIntent: { type: "hold" },
      ancillaries: ancillarySelection,
    } satisfies FlightBookRequest,
  ],
  ["flightBookResponseSchema", flightBookResponseSchema, { order }],
  ["flightGetOrderResponseSchema", flightGetOrderResponseSchema, { order }],
  ["flightCancelResponseSchema", flightCancelResponseSchema, { order, refundedAmount: money }],
  [
    "flightOrdersListQuerySchema",
    flightOrdersListQuerySchema,
    { cursor: "next", limit: 20, status: ["ticketed"], search: "ABC" },
  ],
  [
    "flightOrdersListResponseSchema",
    flightOrdersListResponseSchema,
    { orders: [order], pagination: { total: 1, hasMore: false } },
  ],
  ["ancillaryRequestSchema", ancillaryRequestSchema, { offerId: "offer_1", offer }],
  [
    "ancillaryResponseSchema",
    ancillaryResponseSchema,
    {
      catalog: {
        baggage: [{ id: "bag_20kg", label: "20kg bag", category: "checked", price: money }],
        assistance: [{ id: "wchr", label: "Wheelchair", category: "wheelchair" }],
        extras: [{ id: "priority", label: "Priority", category: "boarding", price: money }],
      },
      validUntil: "2026-10-01T11:00:00Z",
    },
  ],
  ["seatMapRequestSchema", seatMapRequestSchema, { offerId: "offer_1", segmentId: "seg_1", offer }],
  ["seatMapResponseSchema", seatMapResponseSchema, { seatMap }],
  [
    "seatSelectionRequestSchema",
    seatSelectionRequestSchema,
    {
      orderId: "order_1",
      selections: [{ passengerId: "pax_1", segmentId: "seg_1", seatNumber: "12A" }],
    },
  ],
  [
    "seatSelectionResponseSchema",
    seatSelectionResponseSchema,
    { order, selections: [{ passengerId: "pax_1", segmentId: "seg_1", seatNumber: "12A" }] },
  ],
  ["checkInRequestSchema", checkInRequestSchema, { orderId: "order_1", passengerIds: ["pax_1"] }],
  [
    "checkInResponseSchema",
    checkInResponseSchema,
    {
      order,
      status: "checked_in",
      boardingPasses: [{ passengerId: "pax_1", segmentId: "seg_1", seatNumber: "12A" }],
    },
  ],
  [
    "flightModifyRequestSchema",
    flightModifyRequestSchema,
    { orderId: "order_1", ancillaries: ancillarySelection },
  ],
  [
    "flightModifyResponseSchema",
    flightModifyResponseSchema,
    { order, priceDifference: { amount: "-25.00", currency: "USD" } },
  ],
  [
    "flightRefundRequestSchema",
    flightRefundRequestSchema,
    { orderId: "order_1", reason: "customer_request" },
  ],
  ["flightRefundResponseSchema", flightRefundResponseSchema, { order, refundedAmount: money }],
  [
    "flightVoidResponseSchema",
    flightVoidResponseSchema,
    { order, voidedAt: "2026-10-01T11:00:00Z" },
  ],
  [
    "ssrRequestSchema",
    ssrRequestSchema,
    { orderId: "order_1", code: "WCHR", passengerIds: ["pax_1"] },
  ],
  ["ssrResponseSchema", ssrResponseSchema, { order, status: "requested" }],
  [
    "flightAdapterContextSchema",
    flightAdapterContextSchema,
    { connectionId: "conn_1", logger, environment: "sandbox" },
  ],
  [
    "flightAdapterCapabilitiesSchema",
    flightAdapterCapabilitiesSchema,
    { provider: "demo", declared: ["flight/holds"], maxSlicesPerSearch: 2 },
  ],
] as const

const invalidCases = [
  ["moneySchema", moneySchema, { amount: 600, currency: "USD" }],
  [
    "flightSearchRequestSchema",
    flightSearchRequestSchema,
    { slices: [], passengers: { adults: -1 } },
  ],
  ["flightSearchResponseSchema", flightSearchResponseSchema, { offers: [{ totalPrice: money }] }],
  ["flightPriceRequestSchema", flightPriceRequestSchema, { offerId: 123 }],
  ["flightPriceResponseSchema", flightPriceResponseSchema, { offer, valid: "yes" }],
  ["flightBookRequestSchema", flightBookRequestSchema, { offerId: "offer_1", passengers: [{}] }],
  [
    "flightBookResponseSchema",
    flightBookResponseSchema,
    { order: { ...order, status: "unknown" } },
  ],
  [
    "flightGetOrderResponseSchema",
    flightGetOrderResponseSchema,
    { order: { ...order, totalPrice: { amount: "x", currency: "USD" } } },
  ],
  [
    "flightCancelResponseSchema",
    flightCancelResponseSchema,
    { order, refundedAmount: { amount: "1.00", currency: "US" } },
  ],
  ["flightOrdersListQuerySchema", flightOrdersListQuerySchema, { limit: 0 }],
  [
    "flightOrdersListResponseSchema",
    flightOrdersListResponseSchema,
    { orders: [order], pagination: { total: -1, hasMore: false } },
  ],
  ["ancillaryRequestSchema", ancillaryRequestSchema, { offerId: 123 }],
  [
    "ancillaryResponseSchema",
    ancillaryResponseSchema,
    { catalog: { baggage: [], assistance: [] } },
  ],
  ["seatMapRequestSchema", seatMapRequestSchema, { offerId: "offer_1" }],
  ["seatMapResponseSchema", seatMapResponseSchema, { seatMap: { ...seatMap, cabin: "sofa" } }],
  [
    "seatSelectionRequestSchema",
    seatSelectionRequestSchema,
    { orderId: "order_1", selections: [{ seatNumber: "12A" }] },
  ],
  [
    "seatSelectionResponseSchema",
    seatSelectionResponseSchema,
    { order, selections: [{ passengerId: "pax_1" }] },
  ],
  ["checkInRequestSchema", checkInRequestSchema, { passengerIds: ["pax_1"] }],
  ["checkInResponseSchema", checkInResponseSchema, { order, status: "done" }],
  [
    "flightModifyRequestSchema",
    flightModifyRequestSchema,
    { orderId: "order_1", reason: "vacation" },
  ],
  [
    "flightModifyResponseSchema",
    flightModifyResponseSchema,
    { order, penalties: [{ amount: "1.00", currency: "US" }] },
  ],
  [
    "flightRefundRequestSchema",
    flightRefundRequestSchema,
    { orderId: "order_1", reason: "changed_mind" },
  ],
  [
    "flightRefundResponseSchema",
    flightRefundResponseSchema,
    { order, refundedAmount: { amount: "x", currency: "USD" } },
  ],
  ["flightVoidResponseSchema", flightVoidResponseSchema, { order }],
  ["ssrRequestSchema", ssrRequestSchema, { orderId: "order_1", code: "NOPE" }],
  ["ssrResponseSchema", ssrResponseSchema, { order, status: "done" }],
  [
    "flightAdapterCapabilitiesSchema",
    flightAdapterCapabilitiesSchema,
    { provider: "demo", declared: ["flight/nope"] },
  ],
  [
    "flightAdapterContextSchema",
    flightAdapterContextSchema,
    { connectionId: "conn_1", logger: {} },
  ],
] as const

describe("flight contract schemas", () => {
  it.each(roundTripCases)("parses %s fixtures without changing shape", (_name, schema, value) => {
    expect(schema.parse(value)).toEqual(value)
  })

  it.each(invalidCases)("rejects invalid %s fixtures", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })
})
