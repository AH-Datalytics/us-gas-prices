import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const prodPath = path.join(process.cwd(), "us_energy.db");
    const localPath = path.join(process.cwd(), "..", "web", "us_energy.db");
    const dbPath = fs.existsSync(prodPath) ? prodPath : localPath;
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.pragma("cache_size = -64000");
  }
  return db;
}

const stmtCache = new Map<string, Database.Statement>();

export function cachedPrepare(sql: string): Database.Statement {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = getDb().prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}
