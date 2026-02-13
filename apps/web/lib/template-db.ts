import { existsSync } from "node:fs";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type TemplateRow = {
  html_content: string;
};

let db: Database.Database | null = null;
let initialized = false;

function resolveAppRoot(): string {
  const cwd = process.cwd();

  if (existsSync(path.join(cwd, "app"))) {
    return cwd;
  }

  const nestedApp = path.join(cwd, "apps", "web", "app");
  if (existsSync(nestedApp)) {
    return path.join(cwd, "apps", "web");
  }

  return cwd;
}

function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const appRoot = resolveAppRoot();
  const dataDir = path.join(appRoot, "data");
  const dbPath = path.join(dataDir, "pdf-templates.db");

  mkdirSync(dataDir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  return db;
}

function runMigrations() {
  const sqlite = getDb();
  const appRoot = resolveAppRoot();
  const migrationsDir = path.join(appRoot, "db", "migrations");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _pdf_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!existsSync(migrationsDir)) {
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const hasMigration = sqlite.prepare("SELECT 1 FROM _pdf_migrations WHERE filename = ? LIMIT 1");
  const markMigration = sqlite.prepare("INSERT INTO _pdf_migrations(filename) VALUES (?)");

  for (const file of files) {
    const existing = hasMigration.get(file);
    if (existing) {
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    sqlite.exec(sql);
    markMigration.run(file);
  }
}

function ensureInitialized() {
  if (initialized) {
    return;
  }

  runMigrations();
  initialized = true;
}

export function getActiveTemplateHtml(templateKey: string): string | null {
  ensureInitialized();
  const sqlite = getDb();

  const row = sqlite
    .prepare(
      `
      SELECT html_content
      FROM pdf_templates
      WHERE template_key = ? AND is_active = 1
      ORDER BY version DESC
      LIMIT 1
    `
    )
    .get(templateKey) as TemplateRow | undefined;

  return row?.html_content ?? null;
}