/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Cache busting for auth migration
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  // Performance optimizations
  experimental: {
    // Enable optimizations for better performance
    optimizePackageImports: ["@supabase/supabase-js", "lucide-react"],
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lvtwvyxolrjbupltmqrl.supabase.co",
      },
    ],
    // Performance optimizations
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },
  // Bundle optimization
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@/components": path.resolve(__dirname, "components/index.ts"),
    };
    if (!dev && !isServer) {
      // Optimize bundle splitting
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
          common: {
            name: "common",
            minChunks: 2,
            chunks: "all",
            enforce: true,
          },
        },
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      // Performance headers
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      // Cache hero video aggressively; version filename when updating
      {
        source: "/hero-background.mp4",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
