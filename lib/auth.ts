type SessionPayload = {
  sub: string;
  role: "admin" | "reception";
  phone: string;
  exp: number;
};

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

async function hmacSha256(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function signSession(payload: SessionPayload, secret: string) {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(body, secret);
  return `${body}.${signature}`;
}

export async function verifySession(token: string, secret: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacSha256(body, secret);
  if (expected !== signature) return null;
  const payload = JSON.parse(base64UrlDecode(body).toString()) as SessionPayload;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}
