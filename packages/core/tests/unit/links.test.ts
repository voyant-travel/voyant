import { describe, expect, it } from "vitest"

import {
  defineLink,
  generateLinkTableSql,
  type LinkableDefinition,
  type LinkDefinition,
  resolveLinkFromSpec,
} from "../../src/links.js"

const person: LinkableDefinition = {
  module: "crm",
  entity: "person",
  table: "people",
  idPrefix: "pers",
}

const product: LinkableDefinition = {
  module: "products",
  entity: "product",
  table: "products",
  idPrefix: "prod",
}

const post: LinkableDefinition = {
  module: "blog",
  entity: "post",
  table: "blog_posts",
  idPrefix: "blpo",
}

describe("defineLink", () => {
  it("builds a one-to-one definition from bare LinkableDefinitions", () => {
    const def = defineLink(person, product)

    expect(def.cardinality).toBe("one-to-one")
    expect(def.left.isList).toBe(false)
    expect(def.right.isList).toBe(false)
    expect(def.tableName).toBe("crm_person_products_product")
    expect(def.leftColumn).toBe("crm_person_id")
    expect(def.rightColumn).toBe("products_product_id")
    expect(def.deleteCascade).toBe(false)
  })

  it("builds a one-to-many when right.isList=true", () => {
    const def = defineLink(person, { linkable: product, isList: true })
    expect(def.cardinality).toBe("one-to-many")
    expect(def.right.isList).toBe(true)
  })

  it("builds a many-to-one when left.isList=true", () => {
    const def = defineLink({ linkable: person, isList: true }, product)
    expect(def.cardinality).toBe("many-to-one")
    expect(def.left.isList).toBe(true)
  })

  it("builds a many-to-many when both sides are lists", () => {
    const def = defineLink({ linkable: person, isList: true }, { linkable: product, isList: true })
    expect(def.cardinality).toBe("many-to-many")
  })

  it("honours deleteCascade option", () => {
    const def = defineLink(person, product, { deleteCascade: true })
    expect(def.deleteCascade).toBe(true)
  })

  it("honours database.tableName override", () => {
    const def = defineLink(person, product, {
      database: { tableName: "custom_link" },
    })
    expect(def.tableName).toBe("custom_link")
  })

  it("honours column name overrides", () => {
    const def = defineLink(person, product, {
      database: { leftColumn: "owner_id", rightColumn: "item_id" },
    })
    expect(def.leftColumn).toBe("owner_id")
    expect(def.rightColumn).toBe("item_id")
  })

  it("throws when column names collide", () => {
    expect(() =>
      defineLink(person, product, {
        database: { leftColumn: "entity_id", rightColumn: "entity_id" },
      }),
    ).toThrow(/collide/)
  })

  it("accepts both bare and wrapped LinkSideInput forms", () => {
    const a = defineLink(person, product)
    const b = defineLink({ linkable: person }, { linkable: product })
    expect(a.cardinality).toBe("one-to-one")
    expect(b.cardinality).toBe("one-to-one")
  })

  it("supports read-only links backed by an external resolver", () => {
    const list = async () => []
    const def = defineLink(person, product, {
      readOnly: { list },
    })
    expect(def.readOnly?.list).toBe(list)
  })
})

describe("generateLinkTableSql", () => {
  it("emits a CREATE TABLE with id / left / right / timestamps", () => {
    const def = defineLink(person, product)
    const { createTable } = generateLinkTableSql(def)
    expect(createTable).toContain('CREATE TABLE IF NOT EXISTS "crm_person_products_product"')
    expect(createTable).toContain('"id" text PRIMARY KEY NOT NULL')
    expect(createTable).toContain('"crm_person_id" text NOT NULL')
    expect(createTable).toContain('"products_product_id" text NOT NULL')
    expect(createTable).toContain('"created_at" timestamp with time zone')
    expect(createTable).toContain('"updated_at" timestamp with time zone')
    expect(createTable).toContain('"deleted_at" timestamp with time zone')
  })

  it("emits a unique pair index that ignores soft-deleted rows", () => {
    const def = defineLink(person, product)
    const { indexes } = generateLinkTableSql(def)
    const pairIdx = indexes.find((stmt) => stmt.includes("_pair_idx"))
    expect(pairIdx).toBeDefined()
    expect(pairIdx).toContain("UNIQUE")
    expect(pairIdx).toContain('("crm_person_id", "products_product_id")')
    expect(pairIdx).toContain('WHERE "deleted_at" IS NULL')
  })

  it("puts UNIQUE on both side columns for one-to-one", () => {
    const def = defineLink(person, product)
    const { indexes } = generateLinkTableSql(def)
    const leftIdx = indexes.find(
      (stmt) => stmt.includes("_l_uniq") && stmt.includes('("crm_person_id")'),
    )
    const rightIdx = indexes.find(
      (stmt) => stmt.includes("_r_uniq") && stmt.includes('("products_product_id")'),
    )
    expect(leftIdx).toContain("UNIQUE")
    expect(rightIdx).toContain("UNIQUE")
  })

  it("makes left UNIQUE but right non-unique for one-to-many", () => {
    // person has many products → each product has exactly one person,
    //                             each person can have many products.
    // ⇒ UNIQUE(products_product_id) (each right ≤1), INDEX(crm_person_id)
    const def = defineLink(person, { linkable: product, isList: true })
    const { indexes } = generateLinkTableSql(def)

    const leftStmt = indexes.find(
      (s) => !s.includes("_pair_idx") && s.includes('("crm_person_id")'),
    )
    const rightStmt = indexes.find(
      (s) => !s.includes("_pair_idx") && s.includes('("products_product_id")'),
    )
    expect(leftStmt).toContain("_l_idx")
    expect(leftStmt).not.toContain("UNIQUE")
    expect(rightStmt).toContain("UNIQUE")
    expect(rightStmt).toContain("_r_uniq")
  })

  it("makes right UNIQUE but left non-unique for many-to-one", () => {
    const def = defineLink({ linkable: person, isList: true }, product)
    const { indexes } = generateLinkTableSql(def)
    const leftStmt = indexes.find(
      (s) => !s.includes("_pair_idx") && s.includes('("crm_person_id")'),
    )
    const rightStmt = indexes.find(
      (s) => !s.includes("_pair_idx") && s.includes('("products_product_id")'),
    )
    expect(leftStmt).toContain("UNIQUE")
    expect(leftStmt).toContain("_l_uniq")
    expect(rightStmt).not.toContain("UNIQUE")
    expect(rightStmt).toContain("_r_idx")
  })

  it("uses non-unique indexes on both sides for many-to-many", () => {
    const def = defineLink({ linkable: person, isList: true }, { linkable: product, isList: true })
    const { indexes } = generateLinkTableSql(def)
    const nonUnique = indexes.filter(
      (s) => s.startsWith("CREATE INDEX") && !s.startsWith("CREATE UNIQUE INDEX"),
    )
    expect(nonUnique.length).toBe(2)
    // Only the pair idx is UNIQUE in m:n.
    const uniques = indexes.filter((s) => s.startsWith("CREATE UNIQUE INDEX"))
    expect(uniques.length).toBe(1)
    expect(uniques[0]).toContain("_pair_idx")
  })

  it("throws for read-only links because no pivot table should be materialized", () => {
    const def = defineLink(person, product, {
      readOnly: { list: async () => [] },
    })
    expect(() => generateLinkTableSql(def)).toThrow(/read-only link/)
  })

  it("escapes embedded double quotes in identifiers (defense in depth)", () => {
    const def = defineLink(person, product, {
      database: {
        tableName: 'evil"; DROP TABLE users; --',
        leftColumn: 'left" col',
        rightColumn: 'right" col',
      },
    })
    const { createTable, indexes } = generateLinkTableSql(def)

    // Embedded quotes are doubled, keeping the DDL a single well-formed
    // identifier instead of letting the name break out of quoting.
    expect(createTable).toContain('CREATE TABLE IF NOT EXISTS "evil""; DROP TABLE users; --"')
    expect(createTable).toContain('"left"" col" text NOT NULL')
    expect(createTable).toContain('"right"" col" text NOT NULL')
    expect(createTable).not.toContain('"evil"; DROP')

    for (const stmt of indexes) {
      expect(stmt).toContain('"evil""; DROP TABLE users; --')
      expect(stmt).not.toContain('"evil"; DROP')
    }
    const pairIdx = indexes.find((stmt) => stmt.includes("_pair_idx"))
    expect(pairIdx).toContain('("left"" col", "right"" col")')
  })
})

describe("resolveLinkFromSpec", () => {
  const defs: LinkDefinition[] = [defineLink(person, product), defineLink(person, post)]

  it("matches spec where module keys are in definition order", () => {
    const resolved = resolveLinkFromSpec(
      {
        crm: { person_id: "pers_abc" },
        products: { product_id: "prod_xyz" },
      },
      defs,
    )
    expect(resolved.definition.tableName).toBe("crm_person_products_product")
    expect(resolved.leftId).toBe("pers_abc")
    expect(resolved.rightId).toBe("prod_xyz")
  })

  it("matches spec where module keys are in reversed order", () => {
    const resolved = resolveLinkFromSpec(
      {
        products: { product_id: "prod_xyz" },
        crm: { person_id: "pers_abc" },
      },
      defs,
    )
    expect(resolved.definition.tableName).toBe("crm_person_products_product")
    expect(resolved.leftId).toBe("pers_abc")
    expect(resolved.rightId).toBe("prod_xyz")
  })

  it("disambiguates between multiple definitions sharing a module", () => {
    const resolved = resolveLinkFromSpec(
      {
        crm: { person_id: "pers_abc" },
        blog: { post_id: "blpo_xyz" },
      },
      defs,
    )
    expect(resolved.definition.tableName).toBe("crm_person_blog_post")
  })

  it("throws when spec does not have exactly 2 keys", () => {
    expect(() => resolveLinkFromSpec({}, defs)).toThrow(/exactly 2/)
    expect(() =>
      resolveLinkFromSpec(
        {
          crm: { person_id: "pers_abc" },
          products: { product_id: "prod_xyz" },
          blog: { post_id: "blpo_xyz" },
        },
        defs,
      ),
    ).toThrow(/exactly 2/)
  })

  it("throws when no LinkDefinition matches", () => {
    expect(() =>
      resolveLinkFromSpec(
        {
          finance: { invoice_id: "inv_1" },
          crm: { person_id: "pers_1" },
        },
        defs,
      ),
    ).toThrow(/no LinkDefinition matches/)
  })

  it("throws when IDs are missing from the spec", () => {
    expect(() =>
      resolveLinkFromSpec(
        {
          crm: { person_id: "pers_abc" },
          products: { wrong_key: "prod_xyz" },
        },
        defs,
      ),
    ).toThrow(/no LinkDefinition matches/)
  })
})
