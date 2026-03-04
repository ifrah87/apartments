import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.SPACES_ENDPOINT ?? "lon1.digitaloceanspaces.com";

if (!process.env.SPACES_ACCESS_KEY || !process.env.SPACES_SECRET_KEY) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SPACES_ACCESS_KEY and SPACES_SECRET_KEY must be set");
  }
}

export const spacesClient = new S3Client({
  // AWS SDK requires a region; DO Spaces ignores it but the field is mandatory.
  region: "us-east-1",
  endpoint: `https://${endpoint}`,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.SPACES_SECRET_KEY ?? "",
  },
  // DO Spaces uses virtual-hosted style (bucket.endpoint.com), not path style.
  forcePathStyle: false,
});

export const SPACES_BUCKET = process.env.SPACES_BUCKET ?? "orfanerealestate";
