import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 修复 Turbopack 工作区根目录警告
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
