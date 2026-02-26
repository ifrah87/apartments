import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "*": ["node_modules/pdfkit/js/data/**", "public/fonts/**/*"],
  },
};

export default nextConfig;
