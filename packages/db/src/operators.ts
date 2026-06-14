/**
 * Re-export drizzle-orm operators to ensure type compatibility
 * when used with tables from this package.
 *
 * Always import operators from this file (or @voyant-travel/db/operators)
 * when using them with @voyant-travel/db tables to avoid type conflicts.
 */
export {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  asc,
  avg,
  avgDistinct,
  between,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notBetween,
  notExists,
  notIlike,
  notInArray,
  notLike,
  or,
  sql,
  sum,
  sumDistinct,
} from "drizzle-orm"
