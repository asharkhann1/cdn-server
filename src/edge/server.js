import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../shared/config.js';
import cdnRoutes from './routes/cdn.js';
import purgeRoutes from './routes/purge.js';
import { initCache } from './cache.js';

const fastify = Fastify({
    logger: {
        level: 'info',
    },
});

// Register plugins
await fastify.register(cors, {
    origin: true,
});

// Initialize cache
initCache();

// Health check
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'edge', timestamp: Date.now() };
});

// Register routes
fastify.register(cdnRoutes);
fastify.register(purgeRoutes, { prefix: '/api' });

// Graceful shutdown
const closeGracefully = async (signal) => {
    console.log(`Received signal to terminate: ${signal}`);
    await fastify.close();
    process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

// Start server
try {
    await fastify.listen({
        port: config.edge.port,
        host: config.edge.host,
    });

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ⚡ CDN Edge Server Running                              ║
║                                                            ║
║   URL: http://${config.edge.host}:${config.edge.port.toString().padEnd(39)}║
║                                                            ║
║   Endpoints:                                               ║
║   - GET  /cdn/:file_id              Serve cached files     ║
║   - POST /api/purge/:file_id        Purge cache entry      ║
║                                                            ║
║   Origin: ${config.originUrl.padEnd(44)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}
