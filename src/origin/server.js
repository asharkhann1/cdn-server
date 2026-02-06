import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { config } from '../shared/config.js';
import { initDatabase, closeDatabase } from '../shared/database.js';
import { initStorage } from '../shared/storage.js';
import uploadRoutes from './routes/upload.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const fastify = Fastify({
    logger: {
        level: 'info',
    },
    bodyLimit: config.storage.uploadMaxSize,
});

// Register plugins
await fastify.register(cors, {
    origin: true,
});

await fastify.register(multipart, {
    limits: {
        fileSize: config.storage.uploadMaxSize,
    },
});

// Initialize database and storage
initDatabase();
initStorage();

// Health check
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'origin', timestamp: Date.now() };
});

// Register routes
fastify.register(uploadRoutes, { prefix: '/api/upload' });
fastify.register(fileRoutes, { prefix: '/api/files' });
fastify.register(adminRoutes, { prefix: '/api/admin' });

// Graceful shutdown
const closeGracefully = async (signal) => {
    console.log(`Received signal to terminate: ${signal}`);

    closeDatabase();
    await fastify.close();
    process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

// Start server
try {
    await fastify.listen({
        port: config.origin.port,
        host: config.origin.host,
    });

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 CDN Origin Server Running                            ║
║                                                            ║
║   URL: http://${config.origin.host}:${config.origin.port.toString().padEnd(39)}║
║                                                            ║
║   Endpoints:                                               ║
║   - POST   /api/upload              Upload files           ║
║   - GET    /api/files/:id           Get file metadata      ║
║   - GET    /api/files/:id/download  Download file          ║
║   - DELETE /api/files/:id           Delete file            ║
║   - GET    /api/admin/files         List all files         ║
║   - POST   /api/admin/purge/:id     Purge cache            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}
