import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 修复 Turbopack 工作区根目录警告
  turbopack: {
    root: process.cwd(),
  },
  // 暂时禁用 Turbopack，使用 webpack 以避免字体加载问题
  experimental: {
    turbo: false,
  },
};

export default nextConfig;
