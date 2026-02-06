import path from 'path';
import mime from 'mime-types';
import { generateFileId, saveFile } from '../../shared/storage.js';
import { insertFile } from '../../shared/database.js';
import { generateSignedUrl } from '../../shared/crypto.js';

export default async function uploadRoutes(fastify, options) {
    /**
     * Upload a file
     * POST /api/upload
     */
    fastify.post('/', async (request, reply) => {
        try {
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const fileId = generateFileId();
            const originalFilename = data.filename;
            const extension = path.extname(originalFilename);
            const mimeType = data.mimetype || mime.lookup(originalFilename) || 'application/octet-stream';

            // Save file to storage
            const { path: storagePath, size } = await saveFile(data.file, fileId, extension);

            // Extract metadata from fields
            const fields = data.fields || {};
            const isPublic = fields.isPublic?.value !== 'false';
            const metadata = {};

            // Parse any additional metadata fields
            for (const [key, value] of Object.entries(fields)) {
                if (key !== 'isPublic') {
                    metadata[key] = value.value;
                }
            }

            // Generate a clean filename for URL
            const cleanFilename = originalFilename
                .toLowerCase()
                .replace(/[^a-z0-9.-]/g, '-')
                .replace(/-+/g, '-');

            // Insert into database
            const fileData = {
                id: fileId,
                filename: cleanFilename,
                originalFilename,
                mimeType,
                size,
                storagePath,
                isPublic,
                metadata,
            };

            insertFile(fileData);

            // Generate URLs
            const publicUrl = `/cdn/${cleanFilename}`;
            const signedUrl = !isPublic ? generateSignedUrl(fileId) : null;

            return reply.code(201).send({
                success: true,
                file: {
                    id: fileId,
                    filename: cleanFilename,
                    originalFilename,
                    mimeType,
                    size,
                    isPublic,
                    publicUrl: isPublic ? publicUrl : null,
                    signedUrl: signedUrl ? signedUrl.url : null,
                    metadata,
                },
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to upload file' });
        }
    });

    /**
     * Upload multiple files
     * POST /api/upload/batch
     */
    fastify.post('/batch', async (request, reply) => {
        try {
            const parts = request.parts();
            const uploadedFiles = [];
            const errors = [];

            for await (const part of parts) {
                if (part.type === 'file') {
                    try {
                        const fileId = generateFileId();
                        const originalFilename = part.filename;
                        const extension = path.extname(originalFilename);
                        const mimeType = part.mimetype || mime.lookup(originalFilename) || 'application/octet-stream';

                        const { path: storagePath, size } = await saveFile(part.file, fileId, extension);

                        const cleanFilename = originalFilename
                            .toLowerCase()
                            .replace(/[^a-z0-9.-]/g, '-')
                            .replace(/-+/g, '-');

                        const fileData = {
                            id: fileId,
                            filename: cleanFilename,
                            originalFilename,
                            mimeType,
                            size,
                            storagePath,
                            isPublic: true,
                            metadata: {},
                        };

                        insertFile(fileData);

                        uploadedFiles.push({
                            id: fileId,
                            filename: cleanFilename,
                            originalFilename,
                            size,
                            publicUrl: `/cdn/${cleanFilename}`,
                        });
                    } catch (error) {
                        errors.push({
                            filename: part.filename,
                            error: error.message,
                        });
                    }
                }
            }

            return reply.code(201).send({
                success: true,
                uploaded: uploadedFiles.length,
                files: uploadedFiles,
                errors: errors.length > 0 ? errors : undefined,
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to upload files' });
        }
    });
}
