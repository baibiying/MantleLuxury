"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type YieldDistribution = {
  id: string;
  assetId: string;
  yieldType: string;
  totalAmount: string;
  isCompleted: boolean;
  createdAt: string;
};

type OverviewStats = {
  totalUsers: number;
  kycApprovedUsers: number;
  activeInvestors: number;
  totalAssets: number;
  fundraisingAssets: number;
  fundedAssets: number;
  soldAssets: number;
  aum: string;
  totalYield: string;
  pendingYield: string;
  yieldDistributions: number;
  totalTransactions: number;
  avgInvestment: string;
};

type FeaturedAsset = {
  id: string;
  assetType: string;
  brand: string;
  model: string;
  year: number | null;
  pricePerShare: string;
  totalSupply: string;
  remainingSupply: string;
  status: string;
  tokenAddress: string | null;
  imageUrls?: string | null;
  totalYield?: string | null;
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [recentYields, setRecentYields] = useState<YieldDistribution[]>([]);
  const [loadingYields, setLoadingYields] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [featuredAssets, setFeaturedAssets] = useState<FeaturedAsset[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadRecentYields = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/yields/recent?limit=3`);
        if (res.ok) {
          const data = await res.json();
          setRecentYields(data);
        }
      } catch (err) {
        console.error("Failed to load recent yields", err);
      } finally {
        setLoadingYields(false);
      }
    };
    loadRecentYields();
  }, []);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats/overview`);
        if (res.ok) {
          const data = await res.json();
          setOverview(data);
          // 触发数字滚动动画
          setTimeout(() => {
            animateCountUp();
          }, 100);
        }
      } catch (err) {
        console.error("Failed to load overview stats", err);
      }
    };
    loadOverview();
  }, []);

  useEffect(() => {
    const loadFeaturedAssets = async () => {
      setLoadingFeatured(true);
      try {
        const res = await fetch(`${API_BASE}/api/assets/featured?limit=6`);
        if (res.ok) {
          const data = await res.json();
          setFeaturedAssets(data);
        }
      } catch (err) {
        console.error("Failed to load featured assets", err);
      } finally {
        setLoadingFeatured(false);
      }
    };
    loadFeaturedAssets();
  }, []);

  // 自动轮播
  useEffect(() => {
    if (featuredAssets.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredAssets.length);
    }, 5000); // 每5秒切换一次
    return () => clearInterval(interval);
  }, [featuredAssets.length]);

  // 格式化大数字
  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + "K";
    }
    return num.toFixed(2);
  };

  // 数字滚动动画
  const animateCountUp = () => {
    const elements = document.querySelectorAll(".count-up");
    elements.forEach((el) => {
      const target = parseInt(el.getAttribute("data-target") || "0");
      if (target === 0) {
        el.textContent = "0";
        return;
      }
      const duration = 2000; // 2秒
      const increment = target / (duration / 16); // 60fps
      let current = 0;

      const updateCount = () => {
        current += increment;
        if (current < target) {
          el.textContent = Math.floor(current).toString();
          requestAnimationFrame(updateCount);
        } else {
          el.textContent = target.toString();
        }
      };
      updateCount();
    });
  };

  return (
    <main className="min-h-screen gradient-bg text-slate-50 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl float-animation"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl float-animation" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl glow-effect"></div>
      </div>

      <div className="relative z-10">
        {/* Hero 区域 */}
        <section className="max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="space-y-6 mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium">
              MantleLuxury
            </p>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              <span className="gradient-text">奢侈品 RWA</span>
              <br />
              投资平台
            </h1>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
              基于 <span className="text-sky-400 font-semibold">Mantle L2</span> 的奢侈品实物资产代币化平台，
              将名表、珠宝等资产拆分为可交易的份额，让更多投资者以更低门槛参与高端奢侈品投资。
            </p>
          </div>

          {/* 主要操作按钮 */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
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
            <a
              href="/kyc"
              className="px-9 py-4 glass-effect rounded-full text-base font-semibold text-slate-200 hover:bg-slate-800/80 transition-all duration-300 border border-slate-700/50 hover:border-slate-600/50"
            >
              KYC / AML
            </a>
          </div>
        </section>

        {/* 精选资产轮播 */}
        {mounted && !loadingFeatured && featuredAssets.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold gradient-text mb-3">精选资产</h2>
              <p className="text-slate-400">正在募集的优质奢侈品资产</p>
            </div>
            <div className="relative">
              {/* 轮播容器 */}
              <div className="overflow-hidden rounded-2xl">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {featuredAssets.map((asset) => {
                    const imageUrl = asset.imageUrls
                      ? (() => {
                          try {
                            const arr = JSON.parse(asset.imageUrls);
                            if (Array.isArray(arr) && arr.length > 0) {
                              const url = arr[0];
                              return url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;
                            }
                          } catch {}
                          return null;
                        })()
                      : asset.assetType === "watch"
                      ? "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"
                      : "https://images.unsplash.com/photo-1506634064465-1c59a0a51ee3?auto=format&fit=crop&w=800&q=80";

                    return (
                      <div
                        key={asset.id}
                        className="min-w-full flex-shrink-0"
                      >
                        <Link href={`/assets/${asset.id}`}>
                          <div className="group relative h-[500px] md:h-[600px] rounded-2xl overflow-hidden cursor-pointer">
                            {/* 背景图片 */}
                            <div
                              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/80 to-slate-900/60"></div>
                            </div>
                            
                            {/* 内容 */}
                            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                    {asset.assetType === "watch" ? "名表" : "珠宝"}
                                  </span>
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 border border-sky-400/40">
                                    募集中
                                  </span>
                                </div>
                                <h3 className="text-4xl md:text-5xl font-bold text-white">
                                  {asset.brand} {asset.model}
                                </h3>
                                {asset.year && (
                                  <p className="text-lg text-slate-300">{asset.year} 年</p>
                                )}
                                <div className="flex items-center gap-6 pt-4">
                                  <div>
                                    <div className="text-sm text-slate-400 mb-1">每份价格</div>
                                    <div className="text-2xl font-bold text-sky-400">
                                      {parseFloat(asset.pricePerShare).toFixed(2)} MNT
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-slate-400 mb-1">剩余份额</div>
                                    <div className="text-2xl font-bold text-emerald-400">
                                      {parseFloat(asset.remainingSupply).toFixed(0)} 份
                                    </div>
                                  </div>
                                  {asset.totalYield && parseFloat(asset.totalYield) > 0 && (
                                    <div>
                                      <div className="text-sm text-slate-400 mb-1">累计收益</div>
                                      <div className="text-2xl font-bold text-amber-400">
                                        {parseFloat(asset.totalYield).toFixed(4)} MNT
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="pt-4">
                                  <span className="inline-flex items-center gap-2 text-sky-400 font-semibold group-hover:gap-3 transition-all">
                                    查看详情
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 导航按钮 */}
              {featuredAssets.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + featuredAssets.length) % featuredAssets.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-effect border border-slate-700/50 hover:border-slate-600/50 flex items-center justify-center text-white transition-all hover:bg-slate-800/80 z-10"
                    aria-label="上一张"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % featuredAssets.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-effect border border-slate-700/50 hover:border-slate-600/50 flex items-center justify-center text-white transition-all hover:bg-slate-800/80 z-10"
                    aria-label="下一张"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* 指示器 */}
              {featuredAssets.length > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {featuredAssets.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentSlide
                          ? "w-8 bg-sky-500"
                          : "w-2 bg-slate-700 hover:bg-slate-600"
                      }`}
                      aria-label={`跳转到第 ${index + 1} 张`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 平台数据展示区域 */}
        {mounted && overview && (
          <section className="max-w-7xl mx-auto px-6 py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold gradient-text mb-3">平台数据</h2>
              <p className="text-slate-400">实时更新的关键指标</p>
            </div>
            {/* 主要指标 - 第一行 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* 注册用户数 */}
              <div className="group relative stats-card glass-effect rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-400/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="relative z-10 pr-12">
                  <div className="space-y-4">
                    <div className="text-xl md:text-2xl font-bold text-slate-100 tracking-wide">
                      注册用户
                    </div>
                    <div className="text-4xl md:text-5xl font-bold text-blue-400 count-up" data-target={overview.totalUsers}>
                      {overview.totalUsers}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>

              {/* KYC 通过数 */}
              <div className="group relative stats-card glass-effect rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-400/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 16l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
                  </svg>
                </div>
                <div className="relative z-10 pr-12">
                  <div className="space-y-4">
                    <div className="text-xl md:text-2xl font-bold text-slate-100 tracking-wide">
                      KYC 通过
                    </div>
                    <div className="text-4xl md:text-5xl font-bold text-emerald-400 count-up" data-target={overview.kycApprovedUsers}>
                      {overview.kycApprovedUsers}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>

              {/* 托管资产规模 */}
              <div className="group relative stats-card glass-effect rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center border border-amber-400/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 8h-3V6c0-1.1-.9-2-2-2H9C7.9 4 7 4.9 7 6v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6h6v2H9V6zm11 14H4V10h16v10zm-5.5-6.5L13 16l-2.5-2.5 1.41-1.41L13 13.17l2.09-2.09L16.5 11.5z"/>
                  </svg>
                </div>
                <div className="relative z-10 pr-12">
                  <div className="space-y-4">
                    <div className="text-xl md:text-2xl font-bold text-slate-100 tracking-wide">
                      托管资产 (MNT)
                    </div>
                    <div className="text-4xl md:text-5xl font-bold text-amber-400">
                      {formatLargeNumber(Number(overview.aum || "0"))}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>

              {/* 累计收益 */}
              <div className="group relative stats-card glass-effect rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-600/20 flex items-center justify-center border border-pink-400/30 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.5 21H2v-5.5h5.5V21zM13.5 21H8V10.5h5.5V21zM19.5 21H14v-9.5h5.5V21zM19.5 8.5H14V3h5.5v5.5z"/>
                  </svg>
                </div>
                <div className="relative z-10 pr-12">
                  <div className="space-y-4">
                    <div className="text-xl md:text-2xl font-bold text-slate-100 tracking-wide">
                      累计收益 (MNT)
                    </div>
                    <div className="text-4xl md:text-5xl font-bold text-pink-400">
                      {formatLargeNumber(Number(overview.totalYield || "0"))}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>
            </div>

            {/* 次要指标 - 第二行 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* 活跃投资者 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">活跃投资者</div>
                <div className="text-2xl font-bold text-sky-400 count-up" data-target={overview.activeInvestors || 0}>
                  {overview.activeInvestors || 0}
                </div>
              </div>

              {/* 上架资产 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">上架资产</div>
                <div className="text-2xl font-bold text-purple-400 count-up" data-target={overview.totalAssets || 0}>
                  {overview.totalAssets || 0}
                </div>
              </div>

              {/* 募集中 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">募集中</div>
                <div className="text-2xl font-bold text-amber-400 count-up" data-target={overview.fundraisingAssets || 0}>
                  {overview.fundraisingAssets || 0}
                </div>
              </div>

              {/* 已满额 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">已满额</div>
                <div className="text-2xl font-bold text-emerald-400 count-up" data-target={overview.fundedAssets || 0}>
                  {overview.fundedAssets || 0}
                </div>
              </div>

              {/* 总交易次数 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">总交易</div>
                <div className="text-2xl font-bold text-indigo-400 count-up" data-target={overview.totalTransactions || 0}>
                  {overview.totalTransactions || 0}
                </div>
              </div>

              {/* 收益分配次数 */}
              <div className="glass-effect rounded-xl border border-slate-700/50 p-4 text-center">
                <div className="text-xs text-slate-400 mb-1">收益分配</div>
                <div className="text-2xl font-bold text-rose-400 count-up" data-target={overview.yieldDistributions || 0}>
                  {overview.yieldDistributions || 0}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 平台特性展示 */}
        {mounted && (
          <section className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/50">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold gradient-text mb-3">平台优势</h2>
              <p className="text-slate-400">为什么选择 MantleLuxury</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="text-center space-y-3 glass-effect rounded-2xl border border-slate-700/50 p-8 hover:border-slate-600/50 transition-all duration-300">
                <div className="text-4xl font-bold gradient-text mb-2">100%</div>
                <div className="text-lg font-semibold text-slate-200 mb-1">链上透明</div>
                <div className="text-sm text-slate-400">所有交易和资产信息完全上链，公开可查</div>
              </div>
              <div className="text-center space-y-3 glass-effect rounded-2xl border border-slate-700/50 p-8 hover:border-slate-600/50 transition-all duration-300">
                <div className="text-4xl font-bold gradient-text mb-2">低门槛</div>
                <div className="text-lg font-semibold text-slate-200 mb-1">碎片化投资</div>
                <div className="text-sm text-slate-400">将高价值资产拆分为可交易份额，降低投资门槛</div>
              </div>
              <div className="text-center space-y-3 glass-effect rounded-2xl border border-slate-700/50 p-8 hover:border-slate-600/50 transition-all duration-300">
                <div className="text-4xl font-bold gradient-text mb-2">L2</div>
                <div className="text-lg font-semibold text-slate-200 mb-1">低成本交易</div>
                <div className="text-sm text-slate-400">基于 Mantle L2，享受极低的 Gas 费用</div>
              </div>
            </div>
          </section>
        )}

        {/* 最近收益分配记录 */}
        {mounted && !loadingYields && recentYields.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/50">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl font-bold gradient-text mb-2">最近收益分配</h2>
                <p className="text-slate-400">查看最新的收益分配记录</p>
              </div>
              <Link
                href="/yields"
                className="text-sm text-sky-400 hover:text-sky-300 transition flex items-center gap-2"
              >
                查看全部 <span>→</span>
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {recentYields.map((yieldItem) => (
                <div
                  key={yieldItem.id}
                  className="card-hover glass-effect rounded-2xl border border-slate-700/50 px-6 py-5 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          yieldItem.isCompleted
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                        }`}
                      >
                        {yieldItem.isCompleted ? "已完成" : "进行中"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {yieldItem.yieldType === "appreciation" ? "升值收益" : "租赁收益"}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mb-2">
                      {parseFloat(yieldItem.totalAmount).toFixed(4)} MNT
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(yieldItem.createdAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
