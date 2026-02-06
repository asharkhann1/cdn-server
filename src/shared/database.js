import Database from 'better-sqlite3';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';

let db = null;

/**
 * Initialize the database
 */
export function initDatabase() {
    // Ensure storage directory exists
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.database.path);

    // Create files table
    db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      is_public INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    )
  `);

    // Create index for faster lookups
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
    CREATE INDEX IF NOT EXISTS idx_files_public ON files(is_public);
  `);

    console.log('Database initialized successfully');
    return db;
}

/**
 * Get database instance
 */
export function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

/**
 * Insert a new file record
 */
export function insertFile(fileData) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO files (
      id, filename, original_filename, mime_type, size, 
      storage_path, is_public, version, created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const now = Date.now();
    const metadata = fileData.metadata ? JSON.stringify(fileData.metadata) : null;

    return stmt.run(
        fileData.id,
        fileData.filename,
        fileData.originalFilename,
        fileData.mimeType,
        fileData.size,
        fileData.storagePath,
        fileData.isPublic ? 1 : 0,
        fileData.version || 1,
        now,
        now,
        metadata
    );
}

/**
 * Get file by ID
 */
export function getFileById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
    const file = stmt.get(id);

    if (file && file.metadata) {
        file.metadata = JSON.parse(file.metadata);
    }

    return file;
}

/**
 * Get file by filename
 */
export function getFileByFilename(filename) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM files WHERE filename = ? ORDER BY version DESC LIMIT 1');
    const file = stmt.get(filename);

    if (file && file.metadata) {
        file.metadata = JSON.parse(file.metadata);
    }

    return file;
}

/**
 * Update file metadata
 */
export function updateFile(id, updates) {
    const db = getDatabase();
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (key === 'metadata') {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates[key]));
        } else {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
}

/**
 * Delete file record
 */
export function deleteFile(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM files WHERE id = ?');
    return stmt.run(id);
}

/**
 * List all files with pagination
 */
export function listFiles(limit = 50, offset = 0) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM files ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const files = stmt.all(limit, offset);

    return files.map(file => {
        if (file.metadata) {
            file.metadata = JSON.parse(file.metadata);
        }
        return file;
    });
}

/**
 * Close database connection
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
