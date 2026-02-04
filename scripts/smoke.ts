const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const endpoints = [
  "/api/health",
  "/api/tenants",
  "/api/bank-transactions",
  "/api/meter-readings",
];

async function run() {
  let failed = false;

  for (const path of endpoints) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!res.ok || payload?.ok === false) {
        failed = true;
        console.error(`FAIL ${path} (${res.status})`, payload?.error || text);
      } else {
        console.log(`OK   ${path} (${res.status})`);
      }
    } catch (err) {
      failed = true;
      console.error(`FAIL ${path}`, err);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

run();
