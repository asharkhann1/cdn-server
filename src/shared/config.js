import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  origin: {
    port: parseInt(process.env.ORIGIN_PORT || '3000', 10),
    host: process.env.ORIGIN_HOST || 'localhost',
  },
  edge: {
    port: parseInt(process.env.EDGE_PORT || '3001', 10),
    host: process.env.EDGE_HOST || 'localhost',
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'disk',
    path: process.env.STORAGE_PATH || './storage/files',
    uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '104857600', 10), // 100MB
  },
  database: {
    path: process.env.DB_PATH || './storage/metadata.db',
  },
  cache: {
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100', 10),
    ttl: parseInt(process.env.CACHE_TTL || '3600000', 10), // 1 hour
    memoryEnabled: process.env.MEMORY_CACHE_ENABLED === 'true',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10),
    adminApiKey: process.env.ADMIN_API_KEY || '',
  },
  compression: {
    gzip: process.env.ENABLE_GZIP !== 'false',
    brotli: process.env.ENABLE_BROTLI !== 'false',
  },
  originUrl: process.env.ORIGIN_URL || 'http://localhost:3000',
};
