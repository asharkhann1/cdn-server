import axios from 'axios';
import zlib from 'zlib';
import { promisify } from 'util';
import { config } from '../../shared/config.js';
import { verifySignedUrl } from '../../shared/crypto.js';
import { getFromCache, setInCache, generateCacheKey } from '../cache.js';

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

export default async function cdnRoutes(fastify, options) {
    /**
     * Serve files through CDN with caching
     * GET /cdn/:file_id
     */
    fastify.get('/cdn/:file_id', async (request, reply) => {
        try {
            const { file_id } = request.params;
            const { expires, signature } = request.query;

            // For private files, verify signature
            if (expires && signature) {
                const fileId = file_id; // In real scenario, map filename to fileId
                const isValid = verifySignedUrl(fileId, parseInt(expires), signature);

                if (!isValid) {
                    return reply.code(403).send({ error: 'Invalid or expired signature' });
                }
            }

            // Try to get from cache first
            const cacheKey = generateCacheKey(file_id);
            let cached = getFromCache(cacheKey);

            if (cached) {
                fastify.log.info(`Cache HIT: ${file_id}`);
                return serveContent(reply, cached, request);
            }

            // Cache MISS - fetch from origin
            fastify.log.info(`Cache MISS: ${file_id}`);

            try {
                // First get metadata to know the file ID
                const metadataUrl = `${config.originUrl}/api/files/${file_id}`;
                let fileMetadata;

                try {
                    const metaResponse = await axios.get(metadataUrl, { timeout: 5000 });
                    fileMetadata = metaResponse.data;
                } catch (metaError) {
                    // If metadata fetch fails, try direct download
                    fastify.log.warn('Metadata fetch failed, trying direct download');
                }

                // Fetch file from origin
                const downloadUrl = fileMetadata
                    ? `${config.originUrl}/api/files/${fileMetadata.id}/download`
                    : `${config.originUrl}/api/files/${file_id}/download`;

                const response = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    validateStatus: (status) => status === 200 || status === 304,
                });

                if (response.status === 304) {
                    return reply.code(304).send();
                }

                const content = Buffer.from(response.data);
                const metadata = {
                    contentType: response.headers['content-type'],
                    etag: response.headers['etag'],
                    lastModified: response.headers['last-modified'],
                    contentLength: response.headers['content-length'],
                    cacheControl: response.headers['cache-control'] || 'public, max-age=31536000',
                };

                // Store in cache
                const cacheEntry = { content, metadata };
                setInCache(cacheKey, cacheEntry);

                return serveContent(reply, cacheEntry, request);
            } catch (originError) {
                if (originError.response?.status === 404) {
                    return reply.code(404).send({ error: 'File not found' });
                }

                fastify.log.error('Origin fetch error:', originError.message);
                return reply.code(502).send({ error: 'Failed to fetch from origin' });
            }
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
}

/**
 * Serve content with compression and caching headers
 */
async function serveContent(reply, cacheEntry, request) {
    const { content, metadata } = cacheEntry;

    // Set caching headers
    reply.header('Content-Type', metadata.contentType);
    reply.header('Cache-Control', metadata.cacheControl);
    reply.header('X-Cache', 'HIT');

    if (metadata.etag) {
        reply.header('ETag', metadata.etag);
    }

    if (metadata.lastModified) {
        reply.header('Last-Modified', metadata.lastModified);
    }

    // Check conditional requests
    const ifNoneMatch = request.headers['if-none-match'];
    const ifModifiedSince = request.headers['if-modified-since'];

    if (ifNoneMatch && metadata.etag && ifNoneMatch === metadata.etag) {
        return reply.code(304).send();
    }

    if (ifModifiedSince && metadata.lastModified) {
        const modifiedSince = new Date(ifModifiedSince).getTime();
        const lastMod = new Date(metadata.lastModified).getTime();
        if (lastMod <= modifiedSince) {
            return reply.code(304).send();
        }
    }

    // Handle range requests
    const range = request.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : content.length - 1;
        const chunkSize = (end - start) + 1;

        reply.header('Content-Range', `bytes ${start}-${end}/${content.length}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunkSize);
        reply.code(206);

        return reply.send(content.slice(start, end + 1));
    }

    // Handle compression
    const acceptEncoding = request.headers['accept-encoding'] || '';
    const isCompressible = isCompressibleType(metadata.contentType);

    if (isCompressible && config.compression.brotli && acceptEncoding.includes('br')) {
        const compressed = await brotliCompress(content);
        reply.header('Content-Encoding', 'br');
        reply.header('Content-Length', compressed.length);
        reply.header('Vary', 'Accept-Encoding');
        return reply.send(compressed);
    }

    if (isCompressible && config.compression.gzip && acceptEncoding.includes('gzip')) {
        const compressed = await gzip(content);
        reply.header('Content-Encoding', 'gzip');
        reply.header('Content-Length', compressed.length);
        reply.header('Vary', 'Accept-Encoding');
        return reply.send(compressed);
    }

    reply.header('Content-Length', content.length);
    return reply.send(content);
}

/**
 * Check if content type is compressible
 */
function isCompressibleType(contentType) {
    const compressibleTypes = [
        'text/',
        'application/javascript',
        'application/json',
        'application/xml',
        'application/x-javascript',
        'image/svg+xml',
    ];

    return compressibleTypes.some(type => contentType.startsWith(type));
}
