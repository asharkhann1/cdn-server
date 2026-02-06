import { listFiles, getFileById, updateFile } from '../../shared/database.js';
import axios from 'axios';
import { config } from '../../shared/config.js';

export default async function adminRoutes(fastify, options) {
    const requireAdminApiKey = async (request, reply) => {
        const expected = config.security.adminApiKey;
        
        if (!expected) {
            return;
        }

        const headerKey = request.headers['x-api-key'];
        const authHeader = request.headers.authorization;
        const bearerKey = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice('bearer '.length).trim()
            : null;
        const queryKey = request.query?.apiKey;

        const provided = headerKey || bearerKey || queryKey;
        if (typeof provided !== 'string' || provided !== expected) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    };

    /**
     * List all files with pagination
     * GET /api/admin/files
     */
    fastify.get('/files', { preHandler: requireAdminApiKey }, async (request, reply) => {
        try {
            const { limit = 50, offset = 0 } = request.query;
            const files = listFiles(parseInt(limit), parseInt(offset));

            return {
                success: true,
                count: files.length,
                files: files.map(file => ({
                    id: file.id,
                    filename: file.filename,
                    originalFilename: file.original_filename,
                    mimeType: file.mime_type,
                    size: file.size,
                    isPublic: file.is_public === 1,
                    version: file.version,
                    createdAt: file.created_at,
                    updatedAt: file.updated_at,
                })),
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to list files' });
        }
    });

    /**
     * Purge cache for a specific file on edge servers
     * POST /api/admin/purge/:id
     */
    fastify.post('/purge/:id', { preHandler: requireAdminApiKey }, async (request, reply) => {
        try {
            const { id } = request.params;
            const file = getFileById(id);

            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Increment version to invalidate cache
            const newVersion = (file.version || 1) + 1;
            updateFile(id, { version: newVersion });

            // Optionally notify edge servers (if they expose a purge endpoint)
            try {
                const edgeUrl = `http://${config.edge.host}:${config.edge.port}`;
                await axios.post(`${edgeUrl}/api/purge/${file.id}`, {}, {
                    timeout: 2000,
                });
            } catch (edgeError) {
                // Edge server might not be running, that's okay
                fastify.log.warn('Could not notify edge server:', edgeError.message);
            }

            return {
                success: true,
                message: 'Cache purged successfully',
                fileId: id,
                newVersion,
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to purge cache' });
        }
    });

    /**
     * Update file metadata
     * PATCH /api/admin/files/:id
     */
    fastify.patch('/files/:id', { preHandler: requireAdminApiKey }, async (request, reply) => {
        try {
            const { id } = request.params;
            const updates = request.body;

            const file = getFileById(id);
            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Only allow updating certain fields
            const allowedUpdates = {};
            if (updates.metadata !== undefined) {
                allowedUpdates.metadata = updates.metadata;
            }
            if (updates.isPublic !== undefined) {
                allowedUpdates.is_public = updates.isPublic ? 1 : 0;
            }

            updateFile(id, allowedUpdates);

            return {
                success: true,
                message: 'File updated successfully',
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to update file' });
        }
    });

    /**
     * Get storage statistics
     * GET /api/admin/stats
     */
    fastify.get('/stats', { preHandler: requireAdminApiKey }, async (request, reply) => {
        try {
            const files = listFiles(10000, 0); // Get all files

            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            const publicFiles = files.filter(f => f.is_public === 1).length;
            const privateFiles = files.filter(f => f.is_public === 0).length;

            // Group by mime type
            const mimeTypes = {};
            files.forEach(file => {
                const type = file.mime_type.split('/')[0];
                mimeTypes[type] = (mimeTypes[type] || 0) + 1;
            });

            return {
                success: true,
                stats: {
                    totalFiles: files.length,
                    totalSize,
                    totalSizeFormatted: formatBytes(totalSize),
                    publicFiles,
                    privateFiles,
                    filesByType: mimeTypes,
                },
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get stats' });
        }
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
