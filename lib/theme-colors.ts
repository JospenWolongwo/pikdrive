/**
 * Single source of truth for brand colors (hex).
 * Used for theme-color meta, viewport, and Tailwind brand utilities.
 * Keep public/manifest.json "theme_color" in sync with primary when changing.
 */
export const BRAND = {
  primary: "#28C496",
  primaryHover: "#22a085",
} as const;
