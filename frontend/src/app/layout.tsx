import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

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
          <div className="min-h-screen flex flex-col bg-slate-950">
            <header className="w-full border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 backdrop-blur z-20 shadow-lg shadow-sky-900/20">
              <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-8">
                <Link href="/" className="flex items-center gap-3 text-base font-semibold text-slate-50">
                  <span className="relative inline-flex h-10 w-10 items-center justify-center">
                    <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-sky-500 via-purple-500 to-blue-500 blur-lg opacity-60" />
                    <span className="relative z-10 text-xl font-black">M</span>
                  </span>
                  <span className="tracking-wide text-lg">MantleLuxury</span>
                </Link>
                <nav className="flex items-center gap-4 text-sm">
                  {[
                    { href: "/assets", label: "资产列表" },
                    { href: "/assets/submit", label: "提交资产" },
                    { href: "/portfolio", label: "我的持仓" },
                    { href: "/yields", label: "收益记录" },
                    { href: "/kyc", label: "KYC / AML" },
                    { href: "/settings", label: "账户设置" },
                    { href: "/admin/kyc", label: "KYC管理" },
                    { href: "/admin/aml", label: "AML告警" },
                    { href: "/admin/assets", label: "资产审核" },
                    { href: "/admin/yields", label: "收益分配控制台" },
                    { href: "/admin/reports", label: "报表导出" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative overflow-hidden rounded-full border border-slate-700/60 px-5 py-2.5 text-slate-200 transition duration-300 hover:-translate-y-0.5 hover:border-sky-500/70 hover:text-sky-100"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-sky-600/10 via-purple-500/10 to-blue-600/10 opacity-0 transition-opacity duration-300 hover:opacity-100" />
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  ))}
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
