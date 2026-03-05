import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.SPACES_ENDPOINT ?? "lon1.digitaloceanspaces.com";
const accessKeyId = process.env.SPACES_ACCESS_KEY ?? "";
const secretAccessKey = process.env.SPACES_SECRET_KEY ?? "";

let client: S3Client | null = null;

export function getSpacesClient(): S3Client {
  // Avoid throwing at module import time so Next build can collect route data
  // even when Spaces creds are intentionally absent in CI/deploy build phase.
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("SPACES_ACCESS_KEY and SPACES_SECRET_KEY must be set");
  }
  if (!client) {
    client = new S3Client({
      // AWS SDK requires a region; DO Spaces ignores it but the field is mandatory.
      region: "us-east-1",
      endpoint: `https://${endpoint}`,
      credentials: { accessKeyId, secretAccessKey },
      // DO Spaces uses virtual-hosted style (bucket.endpoint.com), not path style.
      forcePathStyle: false,
    });
  }
  return client;
}

export const SPACES_BUCKET = process.env.SPACES_BUCKET ?? "orfanerealestate";
