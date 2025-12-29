import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import GridBackground from "@/components/GridBackground";
import ParticleEffect from "@/components/ParticleEffect";
import DataStream from "@/components/DataStream";
import MouseTrail from "@/components/MouseTrail";
import WalletConnect from "@/components/WalletConnect";
import AdminNavigation from "@/components/AdminNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MantleLuxury - 奢侈品 RWA 投资平台",
  description: "基于 Mantle L2 的奢侈品实物资产代币化投资平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Provider>
          <div className="min-h-screen flex flex-col bg-slate-950 relative">
            {/* 科技感背景效果 */}
            <GridBackground />
            <ParticleEffect />
            <DataStream />
            <MouseTrail />
            
            {/* Header - 上方为 Logo，下方为整行导航栏 */}
            <header className="w-full border-b border-cyan-500/30 bg-gradient-to-r from-black via-slate-950 to-black backdrop-blur z-20 shadow-lg shadow-cyan-900/30 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"></div>
              <div className="relative z-10 max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4">
                {/* Logo 和钱包连接 */}
                <div className="flex items-center justify-between">
                  <Link href="/" className="flex items-center gap-4 text-base font-semibold text-cyan-100 hover:text-cyan-50 transition-colors">
                    <span className="relative inline-flex h-16 w-16 items-center justify-center">
                      <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600 blur-lg opacity-70 animate-pulse" />
                      <span className="relative z-10 text-4xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">M</span>
                    </span>
                    <span className="tracking-wide text-3xl font-bold gradient-text">MantleLuxury</span>
                  </Link>
                  {/* 右上角钱包连接 */}
                  <div className="flex items-center">
                    <WalletConnect />
                  </div>
                </div>
                
                {/* 导航栏 */}
                <nav className="flex items-center gap-3 text-sm justify-center overflow-x-auto">
                  {[
                    { href: "/assets", label: "资产列表" },
                    { href: "/kyc", label: "KYC / AML" },
                    { href: "/assets/submit", label: "提交资产" },
                    { href: "/portfolio", label: "我的持仓" },
                    { href: "/yields", label: "收益记录" },
                    { href: "/settings", label: "账户设置" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative overflow-hidden rounded-full border border-cyan-500/30 px-4 py-2 text-cyan-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] whitespace-nowrap flex-shrink-0"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 opacity-0 transition-opacity duration-300 hover:opacity-100" />
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  ))}
                  <AdminNavigation />
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
