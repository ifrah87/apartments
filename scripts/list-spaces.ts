import fs from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Load .env.local
function loadEnv() {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* skip */ }
}

loadEnv();

const client = new S3Client({
  region: "us-east-1",
  endpoint: `https://${process.env.SPACES_ENDPOINT ?? "lon1.digitaloceanspaces.com"}`,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.SPACES_SECRET_KEY ?? "",
  },
  forcePathStyle: false,
});

const bucket = process.env.SPACES_BUCKET ?? "orfanerealestate";

async function main() {
  const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "bank-imports/" }));
  const files = res.Contents ?? [];

  if (!files.length) {
    console.log("No files found under bank-imports/");
  } else {
    console.log(`\nFiles in ${bucket}/bank-imports/\n`);
    for (const f of files) {
      const kb = ((f.Size ?? 0) / 1024).toFixed(1);
      const date = f.LastModified?.toISOString().slice(0, 10) ?? "";
      console.log(`  ${f.Key}\n    ${kb} KB  ${date}\n`);
    }
    console.log(`Total: ${files.length} file(s)`);
  }
}

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
