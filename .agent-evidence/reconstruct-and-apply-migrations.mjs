import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const plan = JSON.parse(readFileSync("/tmp/voyant-artifacts/voyant/migration-plan.generated.json","utf8"))

// map package name -> dir
const map = {}
for (const d of readdirSync(join(ROOT,"packages"))) {
  const pj = join(ROOT,"packages",d,"package.json")
  if (existsSync(pj)) { try { map[JSON.parse(readFileSync(pj,"utf8")).name] = join(ROOT,"packages",d) } catch{} }
}

let out = []
let missing = []
for (const m of plan.migrations) {
  if (m.migrationKind !== "schema") continue
  const dir = map[m.packageName]
  if (!dir) { missing.push(m.packageName+" (no host dir)"); continue }
  const migDir = join(dir,"migrations")
  const journalPath = join(migDir,"meta","_journal.json")
  if (!existsSync(journalPath)) { missing.push(m.packageName+" (no journal at "+migDir+")"); continue }
  const journal = JSON.parse(readFileSync(journalPath,"utf8"))
  for (const e of journal.entries) {
    const sqlPath = join(migDir, e.tag + ".sql")
    if (!existsSync(sqlPath)) { missing.push(sqlPath); continue }
    out.push(`\n-- ===== ${m.packageName} :: ${e.tag} =====`)
    out.push(readFileSync(sqlPath,"utf8"))
  }
}
process.stderr.write("MISSING:\n"+(missing.length?missing.join("\n"):"(none)")+"\n")
process.stderr.write("SQL_FILES_INCLUDED: "+out.filter(x=>x.startsWith("\n-- =====")).length+"\n")
process.stdout.write(out.join("\n"))
