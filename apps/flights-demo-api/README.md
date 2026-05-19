# `flights-demo-api`

Standalone HTTP service that mocks a flight supplier/GDS provider so templates
and examples can exercise the full flight booking flow without external
credentials. This is a demo/reference supplier-integration surface, not an
airline or flight-operator deployment. Mirrors `FlightConnectorAdapter` 1:1 over REST; the
`@voyantjs/plugin-flights-demo` package is a thin fetch client that
implements the adapter interface against this service.

Owns its own Postgres database — orders persist here, not in the
template's primary DB. Replace it with a real GDS connector by swapping
the plugin, no template tables to drop.

## Run

```bash
cp .env.example .env        # default points at the docker-compose Postgres
docker compose up -d        # spins up Postgres on :5435
pnpm db:migrate             # creates demo_flight_orders
pnpm dev                    # listens on :3320 by default
```

Then in your template (e.g. `templates/operator/.dev.vars`):

```
FLIGHTS_DEMO_API_URL=http://localhost:3320
```

The service fails fast on startup if its Postgres isn't reachable, so a
missing or misconfigured `FLIGHTS_DEMO_DATABASE_URL` surfaces immediately
rather than at first request.

## Endpoints

| Method | Path                              | Adapter method   |
| ------ | --------------------------------- | ---------------- |
| POST   | `/search`                         | `searchFlights`  |
| POST   | `/price`                          | `priceOffer`     |
| POST   | `/book`                           | `bookFlight`     |
| GET    | `/orders?cursor&limit&q&status`   | `listOrders`     |
| GET    | `/orders/:orderId`                | `getOrder`       |
| POST   | `/orders/:orderId/cancel`         | `cancelOrder`    |
| POST   | `/ancillaries`                    | `getAncillaries` |
| POST   | `/seatmap`                        | `getSeatMap`     |
| GET    | `/health`                         | (liveness probe) |
