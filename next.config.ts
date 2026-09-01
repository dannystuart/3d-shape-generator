import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The lighting files are fetched by the block people paste into their
        // own sites, so they must be readable from any origin. vanta.supply
        // needs the same rule for /tools/3d-shape-generator/env/.
        source: "/env/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
