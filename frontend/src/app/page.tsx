"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-6 py-10 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl float-animation"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl float-animation" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl glow-effect"></div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-center space-y-10 relative z-10">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium">
            MantleLuxury
          </p>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
            <span className="gradient-text">奢侈品 RWA</span>
            <br />
            投资平台
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
            基于 <span className="text-sky-400 font-semibold">Mantle L2</span> 的奢侈品实物资产代币化平台，
            将名表、珠宝等资产拆分为可交易的份额，让更多投资者以更低门槛参与高端奢侈品投资。
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 pt-6">
          <a
            href="/assets"
            className="group relative px-10 py-4 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full text-base font-semibold text-white hover:from-sky-400 hover:to-blue-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70"
          >
            <span className="relative z-10">浏览可投资资产</span>
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </a>
          <a
            href="/assets/submit"
            className="px-9 py-4 glass-effect rounded-full text-base font-semibold text-slate-200 hover:bg-slate-800/80 transition-all duration-300 border border-slate-700/50 hover:border-slate-600/50"
          >
            提交资产
          </a>
          <a
            href="/portfolio"
            className="px-9 py-4 glass-effect rounded-full text-base font-semibold text-slate-200 hover:bg-slate-800/80 transition-all duration-300 border border-slate-700/50 hover:border-slate-600/50"
          >
            我的持仓
          </a>
        </div>

        {/* 特性展示 */}
        {mounted && (
          <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-800/50 max-w-5xl mx-auto">
            <div className="space-y-2">
              <div className="text-3xl font-bold gradient-text">100%</div>
              <div className="text-sm text-slate-400 uppercase tracking-wide">链上透明</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold gradient-text">低门槛</div>
              <div className="text-sm text-slate-400 uppercase tracking-wide">碎片化投资</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold gradient-text">L2</div>
              <div className="text-sm text-slate-400 uppercase tracking-wide">低成本交易</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
