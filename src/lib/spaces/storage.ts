import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { spacesClient, SPACES_BUCKET } from "./client";

// ---------------------------------------------------------------------------
// Stream → Buffer (Node.js readable from AWS SDK v3 GetObject)
// ---------------------------------------------------------------------------
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Upload an object (always private — bucket is private by default)
// ---------------------------------------------------------------------------
export async function uploadObject(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}): Promise<void> {
  await spacesClient.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType ?? "application/octet-stream",
      // ACL "private" is redundant on a private bucket but explicit is clearer.
      ACL: "private",
    }),
  );
}

// ---------------------------------------------------------------------------
// Download an object → Buffer
// ---------------------------------------------------------------------------
export async function downloadObject(params: { key: string }): Promise<Buffer> {
  const res = await spacesClient.send(
    new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: params.key }),
  );
  if (!res.Body) throw new Error(`Empty body for key: ${params.key}`);
  return streamToBuffer(res.Body as Readable);
}

// ---------------------------------------------------------------------------
// List objects under a prefix
// ---------------------------------------------------------------------------
export async function listObjects(params: {
  prefix: string;
}): Promise<Array<{ key: string; size: number; lastModified?: string }>> {
  const res = await spacesClient.send(
    new ListObjectsV2Command({ Bucket: SPACES_BUCKET, Prefix: params.prefix }),
  );
  return (res.Contents ?? []).map((obj) => ({
    key: obj.Key ?? "",
    size: obj.Size ?? 0,
    lastModified: obj.LastModified?.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Delete an object
// ---------------------------------------------------------------------------
export async function deleteObject(params: { key: string }): Promise<void> {
  await spacesClient.send(
    new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: params.key }),
  );
}
