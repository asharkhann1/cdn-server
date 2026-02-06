import { getFileById, getFileByFilename, deleteFile as deleteFileRecord } from '../../shared/database.js';
import { readFile, deleteFile as deleteFileStorage, getFileStats, createReadStream } from '../../shared/storage.js';
import { generateETag } from '../../shared/crypto.js';
import mime from 'mime-types';

export default async function fileRoutes(fastify, options) {
    /**
     * Get file metadata
     * GET /api/files/:id
     */
    fastify.get('/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const file = getFileById(id);

            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            return {
                id: file.id,
                filename: file.filename,
                originalFilename: file.original_filename,
                mimeType: file.mime_type,
                size: file.size,
                isPublic: file.is_public === 1,
                version: file.version,
                createdAt: file.created_at,
                updatedAt: file.updated_at,
                metadata: file.metadata,
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get file metadata' });
        }
    });

    /**
     * Download file directly from origin
     * GET /api/files/:id/download
     */
    fastify.get('/:id/download', async (request, reply) => {
        try {
            const { id } = request.params;
            const file = getFileById(id);

            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            const stats = getFileStats(file.storage_path);
            const content = readFile(file.storage_path);
            const etag = generateETag(content);

            // Set headers
            reply.header('Content-Type', file.mime_type);
            reply.header('Content-Length', stats.size);
            reply.header('ETag', etag);
            reply.header('Last-Modified', new Date(stats.mtimeMs).toUTCString());
            reply.header('Cache-Control', 'public, max-age=31536000, immutable');
            reply.header('Content-Disposition', `inline; filename="${file.original_filename}"`);

            // Check conditional requests
            const ifNoneMatch = request.headers['if-none-match'];
            const ifModifiedSince = request.headers['if-modified-since'];

            if (ifNoneMatch === etag) {
                return reply.code(304).send();
            }

            if (ifModifiedSince) {
                const modifiedSince = new Date(ifModifiedSince).getTime();
                if (stats.mtimeMs <= modifiedSince) {
                    return reply.code(304).send();
                }
            }

            // Handle range requests
            const range = request.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
                const chunkSize = (end - start) + 1;

                reply.header('Content-Range', `bytes ${start}-${end}/${stats.size}`);
                reply.header('Accept-Ranges', 'bytes');
                reply.header('Content-Length', chunkSize);
                reply.code(206);

                const stream = createReadStream(file.storage_path, { start, end });
                return reply.send(stream);
            }

            return reply.send(content);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to download file' });
        }
    });

    /**
     * Delete file
     * DELETE /api/files/:id
     */
    fastify.delete('/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const file = getFileById(id);

            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Delete from storage
            deleteFileStorage(file.storage_path);

            // Delete from database
            deleteFileRecord(id);

            return {
                success: true,
                message: 'File deleted successfully',
            };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to delete file' });
        }
    });
}
