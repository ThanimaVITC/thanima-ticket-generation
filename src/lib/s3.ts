import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3-compatible storage (AWS S3 / Cloudflare R2 / DigitalOcean Spaces / MinIO).
// The bucket is PRIVATE: the browser reads objects via short-lived presigned URLs,
// and server-side code reads bytes directly with the SDK.
//
// The database name lives outside any URI here too — every config value is its own
// env var. Reads/writes are filesystem-free so the app runs on Vercel serverless.

// Normalize the endpoint: the AWS SDK requires a full URL with scheme, but it's
// easy to paste a bare host (e.g. "s3.us-east-005.backblazeb2.com"). Default to https.
const rawEndpoint = process.env.S3_ENDPOINT?.trim();
const endpoint =
    rawEndpoint && !/^https?:\/\//i.test(rawEndpoint)
        ? `https://${rawEndpoint}`
        : rawEndpoint;
const region = process.env.S3_REGION || 'auto';
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

// Default presigned-URL lifetime (seconds). Long enough for a page to load the
// poster / for the editor to stay open a while, short enough to stay private.
const DEFAULT_PRESIGN_TTL = 60 * 30; // 30 minutes

let cachedClient: S3Client | null = null;

export function isS3Configured(): boolean {
    return Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
}

function getClient(): S3Client {
    if (!cachedClient) {
        if (!isS3Configured()) {
            throw new Error(
                'S3 is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.'
            );
        }
        cachedClient = new S3Client({
            endpoint,
            region,
            forcePathStyle,
            credentials: {
                accessKeyId: accessKeyId!,
                secretAccessKey: secretAccessKey!,
            },
        });
    }
    return cachedClient;
}

function requireBucket(): string {
    if (!bucket) throw new Error('S3_BUCKET is not set.');
    return bucket;
}

// A stored value is an S3 object key. Legacy events may still hold a local
// "/uploads/..." path — those are NOT in S3 and must be re-uploaded.
export function isS3Key(value?: string | null): value is string {
    return Boolean(value) && !value!.startsWith('/');
}

/** Upload a private object. Returns the object key (stored on the event). */
export async function uploadObject(
    key: string,
    body: Buffer,
    contentType: string
): Promise<string> {
    await getClient().send(
        new PutObjectCommand({
            Bucket: requireBucket(),
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );
    return key;
}

/** Fetch an object's bytes server-side (e.g. the poster, once per email session). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
    const res = await getClient().send(
        new GetObjectCommand({ Bucket: requireBucket(), Key: key })
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
}

/** Delete an object (best-effort callers ignore errors). */
export async function deleteObject(key: string): Promise<void> {
    await getClient().send(
        new DeleteObjectCommand({ Bucket: requireBucket(), Key: key })
    );
}

/** Presign a GET URL the browser can load directly. */
export async function presignGet(
    key: string,
    ttlSeconds: number = DEFAULT_PRESIGN_TTL
): Promise<string> {
    return getSignedUrl(
        getClient(),
        new GetObjectCommand({ Bucket: requireBucket(), Key: key }),
        { expiresIn: ttlSeconds }
    );
}

/**
 * Resolve a stored template value into a browser-loadable URL.
 * - S3 keys → presigned GET URL.
 * - Legacy local "/uploads/..." paths → returned as-is (work locally only).
 * - Missing / on error → undefined.
 */
export async function resolveTemplateUrl(
    value?: string | null
): Promise<string | undefined> {
    if (!value) return undefined;
    if (!isS3Key(value)) return value;
    try {
        return await presignGet(value);
    } catch (error) {
        console.error('Failed to presign template URL:', error);
        return undefined;
    }
}
