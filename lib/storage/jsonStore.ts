import { datasetsRepo } from "@/lib/repos";

const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>) {
  const previous = locks.get(key) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, previous.then(() => next));
  await previous;
  try {
    return await fn();
  } finally {
    release!();
    if (locks.get(key) === next) {
      locks.delete(key);
    }
  }
}

export function resolveDataPath(fileName: string) {
  return fileName.replace(/\.json$/i, "");
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const key = resolveDataPath(fileName);
  return datasetsRepo.getDataset<T>(key, fallback);
}

export async function writeJsonFile<T>(fileName: string, data: T) {
  const key = resolveDataPath(fileName);
  await datasetsRepo.setDataset<T>(key, data);
}

export async function updateJsonFile<T>(
  fileName: string,
  updater: (current: T) => T | Promise<T>,
  fallback: T,
) {
  const key = resolveDataPath(fileName);
  return withLock(key, async () => {
    const current = await datasetsRepo.getDataset<T>(key, fallback);
    const next = await updater(current);
    await datasetsRepo.setDataset<T>(key, next);
    return next;
  });
}
