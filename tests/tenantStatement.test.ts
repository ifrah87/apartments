import assert from "node:assert/strict";
import { createStatement, normalizeId, TenantRecord } from "../lib/reports/tenantStatement";

function makeTenant(partial: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: "1",
    name: "Sample Tenant",
    monthly_rent: 1500,
    due_day: 1,
    ...partial,
  };
}

function date(value: string) {
  return new Date(value);
}

function testChargesAccrueMonthly() {
  const tenant = makeTenant({ monthly_rent: 1000, due_day: 5 });
  const { rows, totals } = createStatement({
    tenant,
    start: date("2024-05-01"),
    end: date("2024-07-31"),
    payments: [],
  });

  assert.equal(rows.length, 3, "Should create one charge per month");
  assert.equal(rows[0].date, "2024-05-05");
  assert.equal(rows[1].date, "2024-06-05");
  assert.equal(rows[2].date, "2024-07-05");
  assert.equal(rows[2].balance, 3000, "Balance accumulates charges");
  assert.equal(totals.charges, 3000);
  assert.equal(totals.payments, 0);
}

function testPaymentsReduceBalance() {
  const tenant = makeTenant({ monthly_rent: 1200, due_day: 1 });
  const { rows, totals } = createStatement({
    tenant,
    start: date("2024-08-01"),
    end: date("2024-09-30"),
    payments: [
      { date: "2024-08-02", amount: 1200, description: "August rent" },
      { date: "2024-09-15", amount: 600, description: "Partial September rent" },
    ],
  });

  const lastRow = rows[rows.length - 1];
  assert.equal(lastRow.balance, 600, "Partial payment should leave correct balance");
  assert.equal(totals.charges, 2400);
  assert.equal(totals.payments, 1800);
  assert.equal(totals.balance, 600);
}

function testAdditionalChargesAreIncluded() {
  const tenant = makeTenant({ monthly_rent: 1000, due_day: 1 });
  const { rows, totals } = createStatement({
    tenant,
    start: date("2024-09-01"),
    end: date("2024-09-30"),
    payments: [],
    additionalCharges: [{ date: "2024-09-10", amount: 75, description: "Water", category: "utilities" }],
  });

  const utilityRow = rows.find((row) => row.description === "Water");
  assert.ok(utilityRow, "Utility charge should appear in statement rows");
  assert.equal(utilityRow?.charge, 75);
  assert.equal(utilityRow?.source, "utilities");
  assert.equal(totals.charges, 1075);
  assert.equal(totals.balance, 1075);
}

function testNormalizeIdStripsDecimals() {
  assert.equal(normalizeId("10.0"), "10");
  assert.equal(normalizeId(5), "5");
  assert.equal(normalizeId(null), "");
}

function run() {
  testChargesAccrueMonthly();
  testPaymentsReduceBalance();
  testAdditionalChargesAreIncluded();
  testNormalizeIdStripsDecimals();
  console.log("✅ tenant statement tests passed");
}

run();
