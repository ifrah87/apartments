import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "*": ["node_modules/pdfkit/js/data/**"],
    },
  },
};

export default nextConfig;
