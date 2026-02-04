import { datasetsRepo } from "@/lib/repos";

export type CategoryMap = Record<string, string>;

const DATASET_KEY = "transaction_categories";

export async function getTransactionCategories(): Promise<CategoryMap> {
  try {
    return await datasetsRepo.getDataset<CategoryMap>(DATASET_KEY, {});
  } catch (err) {
    console.error("Failed to read transaction categories", err);
    return {};
  }
}

export async function setTransactionCategory(id: string, accountId: string) {
  if (!id) return;
  await datasetsRepo.updateDataset<CategoryMap>(
    DATASET_KEY,
    (current) => ({ ...(current || {}), [id]: accountId }),
    {},
  );
}
