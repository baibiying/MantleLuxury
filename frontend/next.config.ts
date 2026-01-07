import type { NextConfig } from "next";

// 为了让 Vercel 对后端图片做优化，需要在这里声明远程图片域名
const remotePatterns: NextConfig["images"]["remotePatterns"] = [];

// 1. 允许从后端加载图片（/uploads/**）
if (process.env.NEXT_PUBLIC_API_BASE_URL) {
  try {
    const backend = new URL(process.env.NEXT_PUBLIC_API_BASE_URL);
    remotePatterns.push({
      protocol: backend.protocol.replace(":", "") as "http" | "https",
      hostname: backend.hostname,
      pathname: "/uploads/**",
    });
  } catch {
    // 如果解析失败就忽略，不影响本地开发
  }
}

// 2. 本地开发环境：允许从 localhost / 127.0.0.1 加载图片
remotePatterns.push(
  {
    protocol: "http",
    hostname: "localhost",
    pathname: "/uploads/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    pathname: "/uploads/**",
  },
);

// 3. 允许从 Unsplash 加载示例图片
remotePatterns.push({
  protocol: "https",
  hostname: "images.unsplash.com",
  pathname: "/**",
});

const nextConfig: NextConfig = {
  // 修复 Turbopack 工作区根目录警告
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns,
  },
};

export default nextConfig;
