import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type ManualPayment = {
  id: string;
  tenant_id: string;
  amount: number;
  date: string;
  description?: string;
};

const FILE_PATH = path.join(process.cwd(), "data", "manual_payments.json");

function ensureFile() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "[]", "utf8");
  }
}

export function listManualPayments(): ManualPayment[] {
  ensureFile();
  const text = fs.readFileSync(FILE_PATH, "utf8");
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

function writePayments(payments: ManualPayment[]) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(payments, null, 2), "utf8");
}

export function addManualPayment(data: Omit<ManualPayment, "id">): ManualPayment {
  const payments = listManualPayments();
  const entry: ManualPayment = { id: randomUUID(), ...data };
  payments.push(entry);
  writePayments(payments);
  return entry;
}

export function deleteManualPayment(id: string) {
  const payments = listManualPayments().filter((entry) => entry.id !== id);
  writePayments(payments);
}
