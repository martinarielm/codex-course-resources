import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type MigrationCommand = "up" | "down" | "status";

type Migration = {
  version: string;
  upSql: string;
  downSql: string;
};

type AppliedMigration = {
  version: string;
  appliedAt: string;
};

const PROJECT_ROOT = path.resolve(import.meta.dir, "..");
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "migrations");
const DEFAULT_DB_PATH = "./data/tinynotes.db";

function printUsage() {
  console.log("Usage:");
  console.log("  bun scripts/migrate.ts up");
  console.log("  bun scripts/migrate.ts down [steps]");
  console.log("  bun scripts/migrate.ts status");
}

function parseCommand(value: string | undefined): MigrationCommand {
  if (value === "up" || value === "down" || value === "status") {
    return value;
  }

  throw new Error(`Invalid command: ${value ?? "missing"}.`);
}

function parseSteps(value: string | undefined) {
  if (value === undefined) {
    return 1;
  }

  const steps = Number(value);
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error(`Invalid rollback step count: ${value}. Use a positive integer.`);
  }

  return steps;
}

function resolveDatabasePath() {
  const configuredPath = process.env.DB_PATH?.trim() || DEFAULT_DB_PATH;
  if (configuredPath === ":memory:") {
    return configuredPath;
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(PROJECT_ROOT, configuredPath);
}

function parseMigration(source: string, version: string): Migration {
  const markerPattern = /^--!\s*(UP|DOWN)\s*$/gim;
  const markers = [...source.matchAll(markerPattern)];

  if (
    markers.length !== 2 ||
    markers[0][1].toUpperCase() !== "UP" ||
    markers[1][1].toUpperCase() !== "DOWN"
  ) {
    throw new Error(`${version} must contain one --! UP section followed by one --! DOWN section.`);
  }

  const upStart = (markers[0].index ?? 0) + markers[0][0].length;
  const downStart = (markers[1].index ?? 0) + markers[1][0].length;
  const upSql = source.slice(upStart, markers[1].index).trim();
  const downSql = source.slice(downStart).trim();

  if (!upSql || !downSql) {
    throw new Error(`${version} must have non-empty UP and DOWN sections.`);
  }

  return { version, upSql, downSql };
}

function loadMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`No numbered SQL migrations found in ${MIGRATIONS_DIR}.`);
  }

  return files.map((version) =>
    parseMigration(readFileSync(path.join(MIGRATIONS_DIR, version), "utf8"), version),
  );
}

function ensureMigrationTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedMigrations(db: Database) {
  return db
    .query(
      `
        SELECT version, applied_at AS appliedAt
        FROM schema_migrations
        ORDER BY applied_at ASC, version ASC;
      `,
    )
    .all() as AppliedMigration[];
}

function migrateUp(db: Database, migrations: Migration[]) {
  const appliedVersions = new Set(getAppliedMigrations(db).map(({ version }) => version));
  const pending = migrations.filter(({ version }) => !appliedVersions.has(version));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2);",
  );
  const applyMigration = db.transaction((migration: Migration) => {
    db.run(migration.upSql);
    recordMigration.run(migration.version, new Date().toISOString());
  });

  for (const migration of pending) {
    applyMigration.immediate(migration);
    console.log(`Applied ${migration.version}`);
  }
}

function migrateDown(db: Database, migrations: Migration[], steps: number) {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const applied = getAppliedMigrations(db).reverse().slice(0, steps);

  if (applied.length === 0) {
    console.log("No applied migrations to roll back.");
    return;
  }

  const removeMigration = db.prepare("DELETE FROM schema_migrations WHERE version = ?1;");
  const rollBackMigration = db.transaction((migration: Migration) => {
    db.run(migration.downSql);
    removeMigration.run(migration.version);
  });

  for (const appliedMigration of applied) {
    const migration = migrationsByVersion.get(appliedMigration.version);
    if (!migration) {
      throw new Error(`Cannot roll back missing migration file ${appliedMigration.version}.`);
    }

    rollBackMigration.immediate(migration);
    console.log(`Rolled back ${migration.version}`);
  }
}

function printStatus(db: Database, migrations: Migration[], dbPath: string) {
  const applied = getAppliedMigrations(db);
  const appliedVersions = new Set(applied.map(({ version }) => version));
  const knownVersions = new Set(migrations.map(({ version }) => version));
  const pending = migrations.filter(({ version }) => !appliedVersions.has(version));
  const missing = applied.filter(({ version }) => !knownVersions.has(version));

  console.log(`Database: ${dbPath}`);
  console.log(`Applied: ${applied.length}`);
  for (const migration of applied) {
    console.log(`  ${migration.version} (${migration.appliedAt})`);
  }
  console.log(`Pending: ${pending.length}`);
  for (const migration of pending) {
    console.log(`  ${migration.version}`);
  }
  console.log(`Missing files: ${missing.length}`);
  for (const migration of missing) {
    console.log(`  ${migration.version}`);
  }
}

function main() {
  const command = parseCommand(process.argv[2]);
  const dbPath = resolveDatabasePath();

  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const migrations = loadMigrations();
  const db = new Database(dbPath, { create: true, strict: true });

  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
    ensureMigrationTable(db);

    if (command === "up") {
      migrateUp(db, migrations);
    } else if (command === "down") {
      migrateDown(db, migrations, parseSteps(process.argv[3]));
    } else {
      printStatus(db, migrations, dbPath);
    }
  } finally {
    db.close(true);
  }
}

try {
  main();
} catch (error) {
  printUsage();
  console.error("");
  console.error(`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
}
