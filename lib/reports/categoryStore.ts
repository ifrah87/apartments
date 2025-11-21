import fs from "fs";
import path from "path";

const CATEGORY_FILE_PATH = path.join(process.cwd(), "data", "transaction-categories.json");

export type CategoryMap = Record<string, string>;

function ensureFile() {
  if (!fs.existsSync(CATEGORY_FILE_PATH)) {
    fs.writeFileSync(CATEGORY_FILE_PATH, "{}", "utf8");
  }
}

export function getTransactionCategories(): CategoryMap {
  ensureFile();
  try {
    const text = fs.readFileSync(CATEGORY_FILE_PATH, "utf8");
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to read transaction categories", err);
    return {};
  }
}

export function setTransactionCategory(id: string, accountId: string) {
  if (!id) return;
  const map = getTransactionCategories();
  map[id] = accountId;
  fs.writeFileSync(CATEGORY_FILE_PATH, JSON.stringify(map, null, 2), "utf8");
}
