import { randomUUID } from "crypto";
import { datasetsRepo } from "@/lib/repos";

export type ManualPayment = {
  id: string;
  tenant_id: string;
  amount: number;
  date: string;
  description?: string;
};

const DATASET_KEY = "manual_payments";

export async function listManualPayments(): Promise<ManualPayment[]> {
  return datasetsRepo.getDataset<ManualPayment[]>(DATASET_KEY, []);
}

export async function addManualPayment(data: Omit<ManualPayment, "id">): Promise<ManualPayment> {
  const entry: ManualPayment = { id: randomUUID(), ...data };
  await datasetsRepo.updateDataset<ManualPayment[]>(
    DATASET_KEY,
    (current) => [...(current || []), entry],
    [],
  );
  return entry;
}

export async function deleteManualPayment(id: string) {
  await datasetsRepo.updateDataset<ManualPayment[]>(
    DATASET_KEY,
    (current) => (current || []).filter((entry) => entry.id !== id),
    [],
  );
}
