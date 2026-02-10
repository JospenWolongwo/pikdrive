const DEFAULT_ASSET_VERSION = "v1";

const getAssetVersion = () => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ASSET_VERSION) {
    return process.env.NEXT_PUBLIC_ASSET_VERSION;
  }
  return DEFAULT_ASSET_VERSION;
};

const isSupabaseStoragePublicUrl = (url: string) =>
  url.includes("/storage/v1/object/public/");

export const withCacheBuster = (url: string): string => {
  if (!url) return url;
  if (url.startsWith("mock://")) return url;
  if (!isSupabaseStoragePublicUrl(url)) return url;
  if (url.includes("?")) return url;

  const version = getAssetVersion();
  return `${url}?v=${encodeURIComponent(version)}`;
};
