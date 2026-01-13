import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

/**
 * Get or create the SQLite database connection
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) {
    return db;
  }

  // Store database in user data directory
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'supplier-tracking.db');

  console.log(`Opening database at: ${dbPath}`);

  // Ensure directory exists
  fs.mkdirSync(userDataPath, { recursive: true });

  // Initialize sql.js - load wasm file explicitly
  let wasmBinary: ArrayBuffer | undefined;
  let wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

  try {
    // Try to find the wasm file in node_modules
    console.log(`Looking for WASM file at: ${wasmPath}`);
    if (fs.existsSync(wasmPath)) {
      const buffer = fs.readFileSync(wasmPath);
      // Convert Buffer to ArrayBuffer
      wasmBinary = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      console.log('✓ WASM file loaded successfully');
    } else {
      console.warn('WASM file not found at expected location, will use locateFile callback');
    }
  } catch (error) {
    console.warn('Could not pre-load WASM file:', error);
  }

  const SQL = await initSqlJs({
    wasmBinary,
    // Provide locateFile as fallback if wasmBinary is undefined
    locateFile: (file) => {
      console.log(`sql.js requesting file: ${file}`);
      // Try multiple possible locations
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
        path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file)
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          console.log(`✓ Found WASM file at: ${testPath}`);
          return testPath;
        }
      }

      console.error('Could not locate WASM file in any expected location');
      console.error('Tried paths:', possiblePaths);
      // Return first path as fallback
      return possiblePaths[0];
    }
  });

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/**
 * Save database to disk
 */
export function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  // Create migrations table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  saveDatabase();

  // Get list of applied migrations
  const result = db.exec('SELECT name FROM migrations');
  const appliedMigrations: string[] = [];
  if (result.length > 0 && result[0].values.length > 0) {
    result[0].values.forEach((row: any[]) => {
      appliedMigrations.push(row[0] as string);
    });
  }

  // Get migration files - handle both dev and production paths
  let migrationsDir = path.join(__dirname, 'migrations');

  // In production (bundled), migrations are at the project root
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.join(process.cwd(), 'electron', 'migrations');
  }

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found, skipping migrations');
    console.log('Tried paths:', path.join(__dirname, 'migrations'), 'and', migrationsDir);
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of migrationFiles) {
    if (appliedMigrations.includes(file)) {
      console.log(`Migration ${file} already applied, skipping`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const migrationPath = path.join(migrationsDir, file);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    try {
      db.exec(migrationSQL);
      db.run('INSERT INTO migrations (name) VALUES (?)', [file]);
      saveDatabase();
      console.log(`✓ Migration ${file} applied successfully`);
    } catch (error) {
      console.error(`✗ Failed to apply migration ${file}:`, error);
      throw error;
    }
  }

  console.log('All migrations completed');
}

/**
 * Helper: Execute a query and return results as objects
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as T);
  }
  stmt.free();

  return results;
}

/**
 * Helper: Execute a query and return first result
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const results = query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Helper: Execute an INSERT/UPDATE/DELETE and return info
 */
export function run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  if (!db) {
    throw new Error('Database not initialized');
  }

  db.run(sql, params);
  saveDatabase();

  // Get last insert rowid and changes
  const lastId = query<{ id: number }>('SELECT last_insert_rowid() as id')[0]?.id || 0;
  const changes = query<{ changes: number }>('SELECT changes() as changes')[0]?.changes || 0;

  return {
    lastInsertRowid: lastId,
    changes: changes
  };
}

/**
 * Helper: Convert snake_case object keys to camelCase
 */
export function toCamelCase<T = any>(obj: any): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as any;
  }

  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = toCamelCase(obj[key]);
  }
  return result;
}

/**
 * Helper: Convert camelCase object keys to snake_case
 */
export function toSnakeCase<T = any>(obj: any): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase) as any;
  }

  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = toSnakeCase(obj[key]);
  }
  return result;
}
