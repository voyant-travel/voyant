-- IF EXISTS so this is safe to run on DBs that never created the table
-- (the demo schema briefly lived in the operator template before being
-- moved to apps/flights-demo-api).
DROP TABLE IF EXISTS "demo_flight_orders" CASCADE;