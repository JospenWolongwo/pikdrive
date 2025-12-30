/**
 * Storage versioning utility for Zustand persisted stores
 * 
 * When the database URL changes, this ensures all persisted stores
 * automatically use new storage keys and ignore stale data from
 * the previous database.
 */

/**
 * Generates a version hash for localStorage keys based on database URL
 * When the database URL changes, Zustand will use a new storage key
 * and automatically ignore old persisted data
 */
export const getStorageVersion = (): string => {
  if (typeof window === 'undefined') return '';
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Simple hash function - converts URL to short hash
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Creates a versioned storage key
 * @param baseKey - Base storage key name (e.g., 'rides-storage')
 * @returns Versioned key (e.g., 'rides-storage-abc123')
 */
export const getVersionedStorageKey = (baseKey: string): string => {
  const version = getStorageVersion();
  return version ? `${baseKey}-${version}` : baseKey;
};

