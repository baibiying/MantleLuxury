"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChainId, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { mantleSepoliaTestnet } from "@/lib/web3/config";
import { luxuryTokenAbi } from "@/lib/web3/contracts";

type Asset = {
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
  totalYield?: string | null; // 累计收益
  custody?: {
    id: string;
    custodyStatus: string;
    custodyOrganization: string;
  } | null;
  insurance?: {
    id: string;
    isActive: boolean;
  } | null;
  authentications?: Array<{
    id: string;
    authenticationStatus: string;
  }>;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onchainRemaining, setOnchainRemaining] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"price" | "recent">("recent");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  const chainId = useChainId();
  const publicClient = usePublicClient();

  useEffect(() => {
    async function fetchAssets() {
      try {
        const res = await fetch(`${API_BASE}/api/assets`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: Asset[] = await res.json();
        setAssets(data);
      } catch (e: any) {
        setError(e.message ?? "Failed to load assets");
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, []);

  // 从链上读取每个资产的剩余可购份数（getAvailableTokens）
  useEffect(() => {
    const loadOnchainRemaining = async () => {
      if (!publicClient || chainId !== mantleSepoliaTestnet.id) return;
      const withToken = assets.filter(
        (a) => a.tokenAddress && a.status === "fundraising"
      );
      if (withToken.length === 0) return;

      const entries = await Promise.all(
        withToken.map(async (asset) => {
          try {
            const raw = (await publicClient.readContract({
              address: asset.tokenAddress as `0x${string}`,
              abi: luxuryTokenAbi,
              functionName: "getAvailableTokens",
              chainId: mantleSepoliaTestnet.id,
            })) as bigint;
            const formatted = formatEther(raw);
            return [asset.tokenAddress as string, formatted] as const;
          } catch {
            return null;
          }
        })
      );

      const next: Record<string, string> = {};
      for (const e of entries) {
        if (e) {
          next[e[0]] = e[1];
        }
      }
      setOnchainRemaining(next);
    };

    loadOnchainRemaining();
  }, [assets, publicClient, chainId]);

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-sm text-slate-300">加载资产列表中…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-6 py-4 max-w-md">
          <p className="text-sm font-semibold text-red-200 mb-1">
            加载失败
          </p>
          <p className="text-xs text-red-300 break-all">{error}</p>
        </div>
      </main>
    );
  }

  // 过滤与排序
  const filtered = assets
    .filter((a) => (typeFilter === "all" ? true : a.assetType === typeFilter))
    .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
    .filter((a) => {
      if (priceMin) {
        const pmin = parseFloat(priceMin);
        if (!isNaN(pmin) && parseFloat(a.pricePerShare) < pmin) return false;
      }
      if (priceMax) {
        const pmax = parseFloat(priceMax);
        if (!isNaN(pmax) && parseFloat(a.pricePerShare) > pmax) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "price") {
        return parseFloat(a.pricePerShare) - parseFloat(b.pricePerShare);
      }
      // recent: 默认按加载顺序（假定后端按创建时间）
      return 0;
    });

  const imageFor = (asset: Asset) => {
    if (asset.imageUrls) {
      try {
        const arr = JSON.parse(asset.imageUrls);
        if (Array.isArray(arr) && arr.length > 0) {
          const url = arr[0];
          // 如果是相对路径，拼接后端地址
          return url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;
        }
      } catch {
        // ignore
      }
    }
    if (asset.assetType === "watch") {
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";
    }
    if (asset.assetType === "jewelry") {
      return "https://images.unsplash.com/photo-1506634064465-1c59a0a51ee3?auto=format&fit=crop&w=800&q=80";
    }
    return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
  };

  return (
    <main className="min-h-screen gradient-bg text-slate-50 px-4 py-6 relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-6 flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
              <span className="gradient-text">可投资资产</span>
            </h1>
            <p className="text-sm text-slate-300">
              来自 MantleLuxury 的奢侈品 RWA 资产列表
            </p>
          </div>
          <Link
            href="/assets/submit"
            className="group relative px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl text-white text-sm font-semibold hover:from-sky-400 hover:to-blue-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/50"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="text-lg">+</span> 提交资产
            </span>
          </Link>
        </header>

        {/* 筛选与排序 */}
        <section className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">资产类型</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">全部</option>
              <option value="watch">名表</option>
              <option value="jewelry">珠宝</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">状态</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">全部</option>
              <option value="fundraising">募集中</option>
              <option value="funded">已满额</option>
              <option value="sold">已结束</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">价格区间 (MNT)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="最低"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="最高"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">排序</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="recent">上架时间（默认）</option>
              <option value="price">价格（从低到高）</option>
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset, index) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="group card-hover glass-effect rounded-2xl px-6 py-5 border border-slate-700/50 hover:border-sky-500/50 relative overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 卡片背景渐变 */}
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10">
        <div className="overflow-hidden rounded-xl mb-3 border border-slate-800/60 shadow-inner bg-slate-900">
                  <div
                    className="h-40 w-full bg-cover bg-center transform transition duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${imageFor(asset)})` }}
                  />
                </div>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-2 font-medium">
                      {asset.assetType === "watch"
                        ? "⌚ 名表"
                        : asset.assetType === "jewelry"
                        ? "💎 珠宝"
                        : asset.assetType}
                    </div>
                    <h2 className="text-xl font-bold mb-1 group-hover:text-sky-400 transition-colors">
                      {asset.brand} {asset.model}
                    </h2>
                    {asset.year && (
                      <p className="text-xs text-slate-400">
                        {asset.year} 年
                      </p>
                    )}
                  </div>
                  {(() => {
                    // 检查资产是否真正可以投资
                    const hasVerifiedAuth = asset.authentications && asset.authentications.some(
                      (auth) => auth.authenticationStatus === "verified"
                    );
                    const hasCustody = asset.custody != null;
                    const hasInsurance = asset.insurance != null && asset.insurance.isActive;
                    const canInvest = asset.status === "fundraising" && hasVerifiedAuth && hasCustody && hasInsurance;
                    
                    // 如果状态是 fundraising 但缺少必要条件，显示"准备中"
                    const displayStatus = asset.status === "fundraising" && !canInvest
                      ? "preparing"
                      : asset.status;
                    
                    return (
                      <span
                        className={`text-xs rounded-full px-3 py-1.5 border font-medium ${
                          displayStatus === "fundraising"
                            ? "border-amber-400/60 text-amber-200 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                            : displayStatus === "funded"
                            ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                            : displayStatus === "registered"
                            ? "border-blue-400/60 text-blue-200 bg-blue-500/20 shadow-lg shadow-blue-500/20"
                            : displayStatus === "preparing"
                            ? "border-orange-400/60 text-orange-200 bg-orange-500/20 shadow-lg shadow-orange-500/20"
                            : "border-slate-500/60 text-slate-200 bg-slate-500/20"
                        }`}
                      >
                        {displayStatus === "fundraising"
                          ? "募集中"
                          : displayStatus === "funded"
                          ? "已满额"
                          : displayStatus === "registered"
                          ? "待认证"
                          : displayStatus === "preparing"
                          ? "准备中"
                          : "已结束"}
                      </span>
                    );
                  })()}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-slate-500 text-xs">单份价格</dt>
                    <dd className="font-bold text-sky-400">{asset.pricePerShare} MNT</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-slate-500 text-xs">总份数</dt>
                    <dd className="font-semibold">{asset.totalSupply}</dd>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <dt className="text-slate-500 text-xs">剩余可购</dt>
                    <dd className="font-semibold text-emerald-400">
                      {asset.tokenAddress &&
                      onchainRemaining[asset.tokenAddress] !== undefined
                        ? `${onchainRemaining[asset.tokenAddress]} 份`
                        : `${asset.remainingSupply} 份`}
                    </dd>
                  </div>
                  {asset.totalYield && parseFloat(asset.totalYield) > 0 && (
                    <div className="space-y-1 col-span-2">
                      <dt className="text-slate-500 text-xs">累计收益</dt>
                      <dd className="font-semibold text-emerald-400">
                        {parseFloat(asset.totalYield).toFixed(4)} MNT
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
