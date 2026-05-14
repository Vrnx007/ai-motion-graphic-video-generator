import { PutObjectCommand, S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim() &&
      process.env.R2_PUBLIC_BASE_URL?.trim()
  );
}

function getClient(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
    forcePathStyle: true,
  });
  return client;
}

export function publicUrlForKey(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "");
  const safeKey = key
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/${safeKey}`;
}

/** Upload bytes to R2 and return public HTTPS URL. */
export async function putObjectPublic(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return publicUrlForKey(key);
}

export async function headObjectExists(key: string): Promise<boolean> {
  try {
    const bucket = process.env.R2_BUCKET_NAME!.trim();
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
