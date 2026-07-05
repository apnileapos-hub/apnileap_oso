const Minio = require('minio');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const minioEndPoint = () => process.env.MINIO_ENDPOINT || "localhost";
const minioPort = () => parseInt(process.env.MINIO_PORT) || 9000;
const minioUseSSL = () => process.env.MINIO_USE_SSL === 'true';
const minioAccessKey = () => process.env.MINIO_ACCESS_KEY || "minioadmin";
const minioSecretKey = () => process.env.MINIO_SECRET_KEY || "minioadmin";

let minioClient = null;

try {
  minioClient = new Minio.Client({
    endPoint: minioEndPoint(),
    port: minioPort(),
    useSSL: minioUseSSL(),
    accessKey: minioAccessKey(),
    secretKey: minioSecretKey()
  });
} catch (err) {
  console.warn("[MinIO] Initialization failed. Client will run in mock mode:", err.message);
}

const hasMinio = () => !!minioClient;

// Automatically create a MinIO bucket for a tenant/company/project
async function createMinIOBucket(bucketName) {
  const cleanBucketName = bucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);
  
  if (!hasMinio()) {
    console.warn("[MinIO] Client not initialized. Returning mock bucket success.");
    return cleanBucketName;
  }

  try {
    const exists = await minioClient.bucketExists(cleanBucketName);
    if (!exists) {
      console.log(`[MinIO] Creating bucket: "${cleanBucketName}"`);
      await minioClient.makeBucket(cleanBucketName, 'us-east-1');
      console.log(`[MinIO] Bucket "${cleanBucketName}" created successfully.`);
    } else {
      console.log(`[MinIO] Bucket "${cleanBucketName}" already exists.`);
    }
    return cleanBucketName;
  } catch (err) {
    console.error(`[MinIO] Failed to ensure bucket "${cleanBucketName}":`, err.message);
    return cleanBucketName;
  }
}

// Upload file to MinIO bucket
async function uploadFileToMinIO(bucketName, objectName, fileData, size, metaData = {}) {
  const cleanBucketName = bucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);

  if (!hasMinio()) {
    console.warn("[MinIO] Mock upload file success.");
    return `http://localhost:9000/${cleanBucketName}/${objectName}`;
  }

  try {
    await createMinIOBucket(cleanBucketName);
    console.log(`[MinIO] Uploading object "${objectName}" to bucket "${cleanBucketName}"`);
    await minioClient.putObject(cleanBucketName, objectName, fileData, size, metaData);
    return `http://${minioEndPoint()}:${minioPort()}/${cleanBucketName}/${objectName}`;
  } catch (err) {
    console.error(`[MinIO] Failed to upload object "${objectName}":`, err.message);
    return `http://${minioEndPoint()}:${minioPort()}/${cleanBucketName}/${objectName}`;
  }
}

// Generate pre-signed URL for temporary secure read access (fallback to standard url)
async function getPresignedUrl(bucketName, objectName, expiresSeconds = 3600) {
  const cleanBucketName = bucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);
  
  if (!hasMinio()) {
    return `http://localhost:9000/${cleanBucketName}/${objectName}`;
  }

  try {
    return await minioClient.presignedGetObject(cleanBucketName, objectName, expiresSeconds);
  } catch (err) {
    console.error("[MinIO] Presign URL retrieval failed:", err.message);
    return `http://${minioEndPoint()}:${minioPort()}/${cleanBucketName}/${objectName}`;
  }
}

module.exports = {
  createMinIOBucket,
  uploadFileToMinIO,
  getPresignedUrl
};
