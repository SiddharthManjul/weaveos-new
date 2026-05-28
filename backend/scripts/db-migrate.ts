#!/usr/bin/env tsx
// Apply all pending Drizzle migrations from src/lib/db/migrations/.
// Bypasses drizzle-kit push's interactive prompt (which fails in non-TTY).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const MIGRATIONS_DIR = join(process.cwd(), "src/lib/db/migrations");

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }
  console.log(`Found ${files.length} migration(s): ${files.join(", ")}`);

  const d = db();
  for (const file of files) {
    const content = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    // Each migration file may contain multiple statements separated by
    // `--> statement-breakpoint` (drizzle's convention).
    const stmts = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(`Applying ${file} (${stmts.length} statements)…`);
    for (const stmt of stmts) {
      try {
        await d.execute(sql.raw(stmt));
      } catch (e) {
        const msg = (e as Error).message;
        // Idempotent re-runs: skip "already exists" errors so we can re-apply.
        if (msg.includes("already exists")) {
          console.log(`  (skipped — already exists)`);
          continue;
        }
        throw e;
      }
    }
    console.log(`  ✓ ${file}`);
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
