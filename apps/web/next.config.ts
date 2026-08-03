import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meet-planner/shared-types"],
};

export default nextConfig;
