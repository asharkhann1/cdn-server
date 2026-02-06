# CDN Content Delivery System

A production-ready CDN-style content delivery system built with Node.js that provides efficient file serving with caching, compression, and cache validation.

## 🌟 Features

### Origin Server
- **File Upload**: Single and batch file uploads with multipart support
- **Metadata Storage**: SQLite database for file metadata and versioning
- **Disk Storage**: Efficient file storage with directory sharding
- **Public/Private Files**: Support for both public and signed URL access
- **Cache Invalidation**: Version-based cache busting
- **Admin API**: File management, statistics, and cache purge endpoints

### Edge/CDN Layer
- **In-Memory Caching**: LRU cache with configurable TTL and size limits
- **Compression**: Automatic gzip and brotli compression for text assets
- **HTTP Caching**: Full support for Cache-Control, ETag, and Last-Modified headers
- **Conditional Requests**: 304 Not Modified responses for unchanged content
- **Range Requests**: Partial content (206) for media streaming
- **Signed URLs**: Token-based authentication for private files
- **Cache-First Strategy**: Serves from cache when available, falls back to origin

## 📁 Architecture

```
Origin Server (Port 3000)
    ↓
    ├─ File Uploads & Metadata
    ├─ SQLite Database
    └─ Disk Storage
    
Edge Server (Port 3001)
    ↓
    ├─ LRU Memory Cache
    ├─ Compression (gzip/brotli)
    ├─ Cache Validation
    └─ Serves to Clients
```

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key configuration options:
- `ORIGIN_PORT`: Origin server port (default: 3000)
- `EDGE_PORT`: Edge server port (default: 3001)
- `STORAGE_PATH`: File storage location
- `CACHE_MAX_SIZE`: Maximum cached items
- `JWT_SECRET`: Secret for signed URLs (change in production!)

### Running the Servers

**Start both servers:**
```bash
npm run start:all
```

**Or start individually:**
```bash
# Origin server
npm run start:origin

# Edge server (in another terminal)
npm run start:edge
```

**Development mode with auto-reload:**
```bash
npm run dev:all
```

## 📖 API Documentation

### Origin Server (http://localhost:3000)

#### Upload File
```bash
POST /api/upload
Content-Type: multipart/form-data

# Fields:
# - file: The file to upload
# - isPublic: true/false (optional, default: true)
# - metadata fields: Any additional metadata

Response:
{
  "success": true,
  "file": {
    "id": "abc123...",
    "filename": "my-image.jpg",
    "publicUrl": "/cdn/my-image.jpg",
    "signedUrl": "/cdn/abc123?expires=...&signature=..." // if private
  }
}
```

#### Batch Upload
```bash
POST /api/upload/batch
Content-Type: multipart/form-data

# Multiple files
```

#### Get File Metadata
```bash
GET /api/files/:id
```

#### Download File
```bash
GET /api/files/:id/download
```

#### Delete File
```bash
DELETE /api/files/:id
```

#### List Files (Admin)
```bash
GET /api/admin/files?limit=50&offset=0
```

#### Purge Cache (Admin)
```bash
POST /api/admin/purge/:id
```

#### Get Statistics (Admin)
```bash
GET /api/admin/stats
```

### Edge Server (http://localhost:3001)

#### Serve File (Public)
```bash
GET /cdn/:file_id
```

#### Serve File (Private with Signed URL)
```bash
GET /cdn/:file_id?expires=1234567890&signature=abc123...
```

#### Purge Cache Entry
```bash
POST /api/purge/:filename
```

#### Clear All Cache
```bash
POST /api/purge-all
```

#### Cache Statistics
```bash
GET /api/cache-stats
```

## 🔧 Usage Examples

### Upload a Public File

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@image.jpg" \
  -F "isPublic=true"
```

### Upload a Private File

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@document.pdf" \
  -F "isPublic=false"
```

### Access File via CDN

```bash
# Public file
curl http://localhost:3001/cdn/image.jpg

# With caching headers
curl -H "If-None-Match: \"abc123\"" http://localhost:3001/cdn/image.jpg
# Returns 304 if not modified

# Range request for streaming
curl -H "Range: bytes=0-1023" http://localhost:3001/cdn/video.mp4
# Returns 206 Partial Content
```

### Purge Cache

```bash
# Purge specific file
curl -X POST http://localhost:3000/api/admin/purge/abc123

# Or from edge
curl -X POST http://localhost:3001/api/purge/image.jpg
```

## 🔐 Security Features

### Signed URLs for Private Files

When uploading with `isPublic=false`, the system generates signed URLs:

```javascript
// URL format:
/cdn/:fileId?expires=1234567890&signature=hmac_sha256_signature

// The signature is verified on each request
// URLs expire after the configured time (default: 1 hour)
```

### Access Tokens

Alternative token-based authentication is available via the crypto utilities.

## ⚡ Performance Features

### Caching Strategy

1. **Client requests file** → Edge server
2. **Cache check**: If in memory cache → serve immediately
3. **Cache miss**: Fetch from origin → store in cache → serve to client
4. **Subsequent requests**: Served from cache (much faster)

### Compression

- **Brotli**: Best compression for modern browsers
- **Gzip**: Fallback for older browsers
- **Automatic**: Based on `Accept-Encoding` header
- **Smart**: Only compresses text-based content types

### HTTP Caching

- **ETag**: Content-based validation
- **Last-Modified**: Time-based validation
- **Cache-Control**: Browser and proxy caching directives
- **304 Not Modified**: Saves bandwidth when content unchanged

### Range Requests

- **Streaming**: Efficient media playback
- **Resume**: Download resumption support
- **206 Partial Content**: Only sends requested byte ranges

## 🏗️ Extensibility

This system is designed to be extended:

### Multiple Edge Nodes

Deploy multiple edge servers in different regions:

```bash
# Edge server in US
EDGE_PORT=3001 ORIGIN_URL=http://origin.example.com npm run start:edge

# Edge server in EU
EDGE_PORT=3002 ORIGIN_URL=http://origin.example.com npm run start:edge
```

### Integration with Real CDNs

The origin server can serve as the backend for:
- **Cloudflare**: Set as origin server
- **CloudFront**: Configure as custom origin
- **Fastly**: Use as backend service

### Object Storage

Replace disk storage with S3-compatible storage by modifying `src/shared/storage.js`:

```javascript
// Example: Use AWS S3, MinIO, or any S3-compatible service
import { S3Client } from '@aws-sdk/client-s3';
```

## 📊 Monitoring

### Cache Statistics

```bash
curl http://localhost:3001/api/cache-stats
```

Returns:
```json
{
  "enabled": true,
  "size": 42,
  "maxSize": 100,
  "ttl": 3600000
}
```

### Storage Statistics

```bash
curl http://localhost:3000/api/admin/stats
```

Returns:
```json
{
  "stats": {
    "totalFiles": 150,
    "totalSize": 52428800,
    "totalSizeFormatted": "50 MB",
    "publicFiles": 120,
    "privateFiles": 30,
    "filesByType": {
      "image": 80,
      "video": 20,
      "application": 50
    }
  }
}
```

## 🧪 Testing

### Test Upload and Retrieval

```bash
# 1. Upload a file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.jpg" \
  -F "isPublic=true"

# 2. Access via CDN (first request - cache miss)
curl -v http://localhost:3001/cdn/test.jpg

# 3. Access again (cache hit - much faster)
curl -v http://localhost:3001/cdn/test.jpg

# 4. Check cache stats
curl http://localhost:3001/api/cache-stats
```

### Test Conditional Requests

```bash
# First request - get ETag
curl -v http://localhost:3001/cdn/test.jpg

# Second request with ETag - should return 304
curl -v -H "If-None-Match: \"<etag-from-first-request>\"" \
  http://localhost:3001/cdn/test.jpg
```

### Test Range Requests

```bash
# Request first 1KB
curl -v -H "Range: bytes=0-1023" \
  http://localhost:3001/cdn/video.mp4
```

## 🔄 Cache Invalidation

### Version-Based (Recommended)

When you update a file, the system increments its version:

```bash
POST /api/admin/purge/:fileId
```

This invalidates the cache and future requests fetch the new version.

### URL-Based

Use versioned URLs in your application:

```html
<img src="/cdn/logo.jpg?v=2">
```

### Manual Purge

Explicitly purge cache entries:

```bash
# Purge specific file
POST /api/purge/:filename

# Purge all
POST /api/purge-all
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! This is a foundation that can be extended with:
- Distributed cache (Redis)
- Image transformation on-the-fly
- Video transcoding
- Geographic routing
- Advanced analytics
- Rate limiting
- DDoS protection

---

**Built with ❤️ using Node.js and Fastify**
