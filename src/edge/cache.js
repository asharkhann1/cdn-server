import { LRUCache } from 'lru-cache';
import { config } from '../shared/config.js';

let memoryCache = null;

/**
 * Initialize the memory cache
 */
export function initCache() {
    if (config.cache.memoryEnabled) {
        memoryCache = new LRUCache({
            max: config.cache.maxSize,
            ttl: config.cache.ttl,
            updateAgeOnGet: true,
            updateAgeOnHas: false,
        });

        console.log('Memory cache initialized');
    }
}

/**
 * Get item from cache
 * @param {string} key - Cache key
 * @returns {object|null} - Cached item or null
 */
export function getFromCache(key) {
    if (!memoryCache) return null;
    return memoryCache.get(key);
}

/**
 * Set item in cache
 * @param {string} key - Cache key
 * @param {object} value - Value to cache (must include content and metadata)
 */
export function setInCache(key, value) {
    if (!memoryCache) return;
    memoryCache.set(key, value);
}

/**
 * Delete item from cache
 * @param {string} key - Cache key
 */
export function deleteFromCache(key) {
    if (!memoryCache) return;
    memoryCache.delete(key);
}

/**
 * Clear entire cache
 */
export function clearCache() {
    if (!memoryCache) return;
    memoryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    if (!memoryCache) {
        return { enabled: false };
    }

    return {
        enabled: true,
        size: memoryCache.size,
        maxSize: config.cache.maxSize,
        ttl: config.cache.ttl,
    };
}

/**
 * Generate cache key from filename and version
 * @param {string} filename - File name
 * @param {number} version - File version
 * @returns {string} - Cache key
 */
export function generateCacheKey(filename, version = 1) {
    return `${filename}:v${version}`;
}
