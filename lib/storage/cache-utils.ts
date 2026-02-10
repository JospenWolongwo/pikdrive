export type TrimDirection = "start" | "end";

export const trimArray = <T>(
  items: readonly T[] | null | undefined,
  max: number,
  direction: TrimDirection = "start"
): T[] => {
  if (!items || max <= 0) return [];
  const list = Array.isArray(items) ? items : [];
  if (list.length <= max) return [...list];
  return direction === "end" ? list.slice(list.length - max) : list.slice(0, max);
};

export const trimRecordArrays = <T>(
  record: Record<string, readonly T[] | undefined> | null | undefined,
  max: number,
  direction: TrimDirection = "start"
): Record<string, T[]> => {
  if (!record || max <= 0) return {};
  const next: Record<string, T[]> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!Array.isArray(value)) continue;
    next[key] = trimArray(value, max, direction);
  }
  return next;
};
