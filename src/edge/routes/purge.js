import { deleteFromCache, clearCache, getCacheStats, generateCacheKey } from '../cache.js';

export default async function purgeRoutes(fastify, options) {
    /**
     * Purge specific file from cache
     * POST /api/purge/:file_id
     */
    fastify.post('/purge/:file_id', async (request, reply) => {
        try {
            const { file_id } = request.params;
            const cacheKey = generateCacheKey(file_id);

            deleteFromCache(cacheKey);

            return {
                success: true,
                message: 'Cache entry purged',
                fileId: file_id,
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to purge cache' });
        }
    });

    /**
     * Clear entire cache
     * POST /api/purge-all
     */
    fastify.post('/purge-all', async (request, reply) => {
        try {
            clearCache();

            return {
                success: true,
                message: 'All cache entries cleared',
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to clear cache' });
        }
    });

    /**
     * Get cache statistics
     * GET /api/cache-stats
     */
    fastify.get('/cache-stats', async (request, reply) => {
        try {
            const stats = getCacheStats();

            return {
                success: true,
                stats,
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get cache stats' });
        }
    });
}
