import { createJSONStorage, type PersistOptions } from "zustand/middleware";
import { getVersionedStorageKey } from "@/lib/storage-version";
import { zustandStorage } from "@/lib/storage/zustand-storage";

export const createPersistConfig = <T, U = T>(
  baseKey: string,
  options: Omit<PersistOptions<T, U>, "name" | "storage">
): PersistOptions<T, U> => ({
  ...options,
  name: getVersionedStorageKey(baseKey),
  storage: createJSONStorage(() => zustandStorage),
});
