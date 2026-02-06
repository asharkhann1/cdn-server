import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { config } from './config.js';
import crypto from 'crypto';

/**
 * Initialize storage directory
 */
export function initStorage() {
    const storagePath = config.storage.path;
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
        console.log(`Storage directory created at: ${storagePath}`);
    }
}

/**
 * Generate a unique file ID
 */
export function generateFileId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Get storage path for a file
 * @param {string} fileId - The file identifier
 * @param {string} extension - File extension
 * @returns {string} - Full storage path
 */
export function getStoragePath(fileId, extension = '') {
    // Create subdirectories based on first 2 chars of ID for better file distribution
    const subDir = fileId.substring(0, 2);
    const dirPath = path.join(config.storage.path, subDir);

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const filename = extension ? `${fileId}${extension}` : fileId;
    return path.join(dirPath, filename);
}

/**
 * Save file to disk
 * @param {ReadableStream} fileStream - The file stream
 * @param {string} fileId - The file identifier
 * @param {string} extension - File extension
 * @returns {Promise<object>} - File info including path and size
 */
export async function saveFile(fileStream, fileId, extension = '') {
    const storagePath = getStoragePath(fileId, extension);
    const writeStream = fs.createWriteStream(storagePath);

    await pipeline(fileStream, writeStream);

    const stats = fs.statSync(storagePath);

    return {
        path: storagePath,
        size: stats.size,
    };
}

/**
 * Read file from disk
 * @param {string} storagePath - The storage path
 * @returns {Buffer} - File content
 */
export function readFile(storagePath) {
    return fs.readFileSync(storagePath);
}

/**
 * Create a read stream for a file
 * @param {string} storagePath - The storage path
 * @param {object} options - Stream options (start, end for range requests)
 * @returns {ReadableStream} - File stream
 */
export function createReadStream(storagePath, options = {}) {
    return fs.createReadStream(storagePath, options);
}

/**
 * Delete file from disk
 * @param {string} storagePath - The storage path
 */
export function deleteFile(storagePath) {
    if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
    }
}

/**
 * Get file stats
 * @param {string} storagePath - The storage path
 * @returns {object} - File stats
 */
export function getFileStats(storagePath) {
    return fs.statSync(storagePath);
}

/**
 * Check if file exists
 * @param {string} storagePath - The storage path
 * @returns {boolean} - True if exists
 */
export function fileExists(storagePath) {
    return fs.existsSync(storagePath);
}
