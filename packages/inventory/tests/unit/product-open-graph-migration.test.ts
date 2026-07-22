import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("../../migrations/20260722072000_product_open_graph_media.sql", import.meta.url),
  "utf8",
)
const previousSnapshot = JSON.parse(
  readFileSync(
    new URL("../../migrations/meta/20260720104007_snapshot.json", import.meta.url),
    "utf8",
  ),
)
const snapshot = JSON.parse(
  readFileSync(
    new URL("../../migrations/meta/20260722072000_snapshot.json", import.meta.url),
    "utf8",
  ),
)

describe("product Open Graph media migration", () => {
  it("keeps the snapshot chain and schema metadata aligned with the SQL", () => {
    expect(snapshot.prevId).toBe(previousSnapshot.id)
    const media = snapshot.tables["public.product_media"]
    expect(media.columns.width).toMatchObject({ type: "integer", notNull: false })
    expect(media.columns.height).toMatchObject({ type: "integer", notNull: false })
    expect(media.columns.is_open_graph).toMatchObject({
      type: "boolean",
      notNull: true,
      default: false,
    })
    expect(media.indexes.uidx_product_media_open_graph).toMatchObject({
      isUnique: true,
      where: `"product_media"."is_open_graph" = true`,
    })
    expect(media.checkConstraints.chk_product_media_open_graph_image.value).toContain(
      `"product_media"."day_id" IS NULL`,
    )

    expect(migration).toContain(`ADD COLUMN "width" integer`)
    expect(migration).toContain(`ADD COLUMN "height" integer`)
    expect(migration).toContain(`ADD COLUMN "is_open_graph" boolean DEFAULT false NOT NULL`)
    expect(migration).toContain(`CREATE UNIQUE INDEX "uidx_product_media_open_graph"`)
    expect(migration).toContain(`ADD CONSTRAINT "chk_product_media_open_graph_image"`)
  })
})
