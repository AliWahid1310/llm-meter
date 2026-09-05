/**
 * Database connection and migration runner.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'metering.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db = null;

/**
 * Get or create the database connection.
 * Enables WAL mode and foreign keys for performance and integrity.
 */
function getDb() {
    if (db) return db;

    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');

    // Enable foreign key enforcement
    db.pragma('foreign_keys = ON');

    console.log(`[DB] Connected to SQLite at ${DB_PATH}`);
    return db;
}

/**
 * Run all migration files in order.
 * Migrations are idempotent (IF NOT EXISTS) so they can be re-run safely.
 */
function runMigrations() {
    const database = getDb();

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`[DB] Running migration: ${file}`);
        database.exec(sql);
    }

    console.log(`[DB] All migrations complete (${migrationFiles.length} files)`);
}

/**
 * Close the database connection gracefully.
 */
function closeDb() {
    if (db) {
        db.close();
        db = null;
        console.log('[DB] Connection closed');
    }
}

module.exports = { getDb, runMigrations, closeDb };
