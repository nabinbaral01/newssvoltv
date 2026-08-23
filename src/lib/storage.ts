import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Media storage with two drivers.
 *
 *   local  writes to public/uploads (the development default — no account,
 *          no network, works offline)
 *   blob   Vercel Blob (the right choice on Vercel: one click to provision)
 *   s3     any S3-compatible bucket (AWS, R2, Spaces, MinIO)
 *
 * All three return a public URL; nothing above this module knows which is in
 * use.
 *
 * `local` cannot work on Vercel. The filesystem there is read-only outside
 * /tmp, so an upload does not silently 404 — it throws. `assertDriverUsable()`
 * turns that into a clear message instead of an ENOENT deep in fs.writeFile.
 */

export const MEDIA_DRIVER = (process.env.MEDIA_DRIVER ?? 'local') as 'local' | 's3' | 'blob';

export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type StoredFile = {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

function safeName(original: string): string {
  const ext = path.extname(original).toLowerCase().slice(0, 8) || '.bin';
  const base = path
    .basename(original, path.extname(original))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}-${crypto.randomBytes(4).toString('hex')}${ext}`;
}

/**
 * Intrinsic dimensions, read from the file header. Only PNG, JPEG, GIF and SVG
 * are probed; anything else stores null and next/image falls back to layout
 * sizing rather than guessing.
 */
function probeDimensions(buffer: Buffer, mimeType: string): { width: number | null; height: number | null } {
  try {
    if (mimeType === 'image/png' && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    if (mimeType === 'image/gif' && buffer.length > 10) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }

    if (mimeType === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        // SOF0..SOF15, excluding the non-frame markers.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }

    if (mimeType === 'image/svg+xml') {
      const head = buffer.subarray(0, 2048).toString('utf8');
      const viewBox = head.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
      if (viewBox) return { width: Math.round(+viewBox[1]), height: Math.round(+viewBox[2]) };
      const width = head.match(/\bwidth\s*=\s*["'](\d+)/i);
      const height = head.match(/\bheight\s*=\s*["'](\d+)/i);
      if (width && height) return { width: +width[1], height: +height[1] };
    }
  } catch {
    /* a malformed header is not worth failing an upload over */
  }

  return { width: null, height: null };
}

async function storeLocal(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFile> {
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await fs.mkdir(dir, { recursive: true });

  const name = safeName(filename);
  await fs.writeFile(path.join(dir, name), buffer);

  return {
    url: `/uploads/${folder}/${name}`,
    filename: name,
    mimeType,
    sizeBytes: buffer.byteLength,
    ...probeDimensions(buffer, mimeType),
  };
}

async function storeS3(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFile> {
  const bucket = process.env.S3_BUCKET;
  const publicBase = process.env.S3_PUBLIC_URL;
  if (!bucket || !publicBase) {
    throw new Error('MEDIA_DRIVER=s3 needs S3_BUCKET and S3_PUBLIC_URL to be set.');
  }

  // Imported lazily so a local-driver deploy never has to install the SDK.
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });

  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${safeName(filename)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return {
    url: `${publicBase.replace(/\/$/, '')}/${key}`,
    filename: path.basename(key),
    mimeType,
    sizeBytes: buffer.byteLength,
    ...probeDimensions(buffer, mimeType),
  };
}

/** Vercel Blob. BLOB_READ_WRITE_TOKEN is injected automatically on Vercel. */
async function storeBlob(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'MEDIA_DRIVER=blob needs BLOB_READ_WRITE_TOKEN. Create a Blob store in the Vercel dashboard and it is added for you.',
    );
  }

  const { put } = await import('@vercel/blob');
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${safeName(filename)}`;

  // addRandomSuffix is off because safeName already appends entropy, and a
  // predictable key makes the "used in" lookup in the media library work.
  const blob = await put(key, buffer, {
    access: 'public',
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    filename: path.basename(key),
    mimeType,
    sizeBytes: buffer.byteLength,
    ...probeDimensions(buffer, mimeType),
  };
}

/**
 * Fails loudly at boot rather than on a user's first upload. Called from the
 * preflight check so a misconfigured deploy is caught before it ships.
 */
export function assertDriverUsable(): { ok: true } | { ok: false; reason: string } {
  if (MEDIA_DRIVER === 'local') {
    if (process.env.VERCEL) {
      return {
        ok: false,
        reason:
          'MEDIA_DRIVER=local cannot work on Vercel — the filesystem is read-only. Use "blob" or "s3".',
      };
    }
    return { ok: true };
  }

  if (MEDIA_DRIVER === 'blob' && !process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, reason: 'MEDIA_DRIVER=blob but BLOB_READ_WRITE_TOKEN is not set.' };
  }

  if (MEDIA_DRIVER === 's3' && !(process.env.S3_BUCKET && process.env.S3_PUBLIC_URL)) {
    return { ok: false, reason: 'MEDIA_DRIVER=s3 but S3_BUCKET or S3_PUBLIC_URL is not set.' };
  }

  return { ok: true };
}

export async function storeFile(file: File): Promise<StoredFile> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`);
  }

  const usable = assertDriverUsable();
  if (!usable.ok) throw new Error(usable.reason);

  const buffer = Buffer.from(await file.arrayBuffer());

  if (MEDIA_DRIVER === 'blob') return storeBlob(buffer, file.name, file.type);
  if (MEDIA_DRIVER === 's3') return storeS3(buffer, file.name, file.type);
  return storeLocal(buffer, file.name, file.type);
}

/** Local files are removed from disk; S3 objects are left to a lifecycle rule. */
export async function deleteStoredFile(url: string): Promise<void> {
  // Blob and S3 objects are left to a lifecycle rule / the Blob dashboard.
  if (MEDIA_DRIVER !== 'local' || !url.startsWith('/uploads/')) return;
  const target = path.join(process.cwd(), 'public', url);
  await fs.unlink(target).catch(() => null);
}
