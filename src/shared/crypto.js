import crypto from 'crypto';
import { config } from './config.js';

/**
 * Generate a signed URL for secure file access
 * @param {string} fileId - The file identifier
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {object} - Object containing the signed URL components
 */
export function generateSignedUrl(fileId, expiresIn = config.security.signedUrlExpiry) {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const data = `${fileId}:${expires}`;

    const signature = crypto
        .createHmac('sha256', config.security.jwtSecret)
        .update(data)
        .digest('hex');

    return {
        fileId,
        expires,
        signature,
        url: `/cdn/${fileId}?expires=${expires}&signature=${signature}`,
    };
}

/**
 * Verify a signed URL
 * @param {string} fileId - The file identifier
 * @param {number} expires - Expiration timestamp
 * @param {string} signature - The signature to verify
 * @returns {boolean} - True if valid, false otherwise
 */
export function verifySignedUrl(fileId, expires, signature) {
    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > expires) {
        return false;
    }

    // Verify signature
    const data = `${fileId}:${expires}`;
    const expectedSignature = crypto
        .createHmac('sha256', config.security.jwtSecret)
        .update(data)
        .digest('hex');

    return signature === expectedSignature;
}

/**
 * Generate a simple token for private file access
 * @param {string} fileId - The file identifier
 * @param {object} metadata - Additional metadata to include
 * @returns {string} - JWT-like token
 */
export function generateAccessToken(fileId, metadata = {}) {
    const payload = {
        fileId,
        ...metadata,
        iat: Math.floor(Date.now() / 1000),
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', config.security.jwtSecret)
        .update(base64Payload)
        .digest('base64url');

    return `${base64Payload}.${signature}`;
}

/**
 * Verify an access token
 * @param {string} token - The token to verify
 * @returns {object|null} - Decoded payload if valid, null otherwise
 */
export function verifyAccessToken(token) {
    try {
        const [base64Payload, signature] = token.split('.');

        const expectedSignature = crypto
            .createHmac('sha256', config.security.jwtSecret)
            .update(base64Payload)
            .digest('base64url');

        if (signature !== expectedSignature) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString());
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Generate ETag for content
 * @param {Buffer|string} content - The content to hash
 * @returns {string} - ETag value
 */
export function generateETag(content) {
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `"${hash}"`;
}
