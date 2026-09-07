import "server-only";

import { Database } from "bun:sqlite";
import path from "node:path";

const globalDatabase = globalThis as typeof globalThis & { tinyNotesDatabase?: Database };

export function getDatabase() {
  if (!globalDatabase.tinyNotesDatabase) {
    const configuredPath = process.env.DB_PATH?.trim() || "./data/tinynotes.db";
    const dbPath = configuredPath === ":memory:" ? configuredPath : path.resolve(configuredPath);
    // Migrations own schema creation. A missing database should fail clearly.
    const db = new Database(dbPath, { create: false, strict: true });
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    globalDatabase.tinyNotesDatabase = db;
  }
  return globalDatabase.tinyNotesDatabase;
}
