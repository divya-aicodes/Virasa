import path from 'node:path';
import fsp from 'node:fs/promises';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

function s3Client() {
  return new S3Client({
    region: required('S3_REGION'),
    endpoint: String(process.env.S3_ENDPOINT || '').trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return value;
}

function objectKey(file) {
  const prefix = String(process.env.S3_PREFIX || 'media').replace(/^\/+|\/+$/g, '');
  return `${prefix}/${file.filename}`;
}

export async function persistUpload(file) {
  if (storageDriver === 'local') return { url: `/uploads/${file.filename}`, removeLocal: false };
  if (storageDriver !== 's3') throw new Error(`Unsupported STORAGE_DRIVER: ${storageDriver}`);

  const bucket = required('S3_BUCKET');
  const cdnBase = required('CDN_BASE_URL').replace(/\/$/, '');
  const client = s3Client();
  const key = objectKey(file);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: await fsp.readFile(file.path),
    ContentType: file.mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { originalname: path.basename(file.originalname).slice(0, 200) },
  }));
  return { url: `${cdnBase}/${key}`, removeLocal: true, key };
}

export async function removeStored(stored) {
  if (storageDriver !== 's3' || !stored?.key) return;
  await s3Client().send(new DeleteObjectCommand({ Bucket: required('S3_BUCKET'), Key: stored.key }));
}

export function storageSummary() {
  return { driver: storageDriver, cdn: storageDriver === 's3' ? Boolean(process.env.CDN_BASE_URL) : false };
}
