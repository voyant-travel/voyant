DELETE FROM "resource_pool_members"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "pool_id", "resource_id"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS rn
    FROM "resource_pool_members"
  ) ranked
  WHERE ranked.rn > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_resource_pool_members_pool_resource" ON "resource_pool_members" USING btree ("pool_id","resource_id");--> statement-breakpoint
